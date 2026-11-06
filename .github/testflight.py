# Gets one of Soultied's iPhone builds to testers outside the Apple team (friends and family) through TestFlight.
# Used by .github/workflows/testflight.yml (after the web-shell app's builds) and .github/workflows/native-ios.yml
# (after the native app's builds), so both say the same things to Apple.
#
# It fills in what Apple asks for before outside testers can get builds (the app's beta description, contact for
# Apple's beta review), puts the build in the "Friends and family" group, adds the tester, and sends the build to
# Apple's beta review when it needs one. Apple then emails the tester an invite that works with any Apple Account.
#
# Reads from the environment:
#   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8  the App Store Connect API key (see ios.yml)
#   REVIEW_PHONE, TESTER_EMAIL             secrets: a phone Apple's beta reviewer can call, and the tester's email
#   BUILD_NUMBER                           the build to use (waits for Apple to process it); else the newest one
#   APP_KIND                               "native" for the native app (so are builds numbered 1000 and up),
#                                          which changes what testers and the reviewer are told
import json, os, sys, time, urllib.error, urllib.parse, urllib.request

import jwt

API = os.environ.get('ASC_API', 'https://api.appstoreconnect.apple.com')
APP = '6827933237'  # Soultied in App Store Connect
GROUP = 'Friends and family'
PHONE = os.environ.get('REVIEW_PHONE', '').strip()
EMAIL = os.environ.get('TESTER_EMAIL', '').strip()
WANT = os.environ.get('BUILD_NUMBER', '').strip()  # set when an iPhone build just finished
SUMMARY = os.environ.get('GITHUB_STEP_SUMMARY', '/dev/null')

# what testers and Apple's reviewer are told, for the native iPhone app (native-ios.yml, builds 1000 and up) or
# the shell around soultied.app (ios.yml)
def texts(native):
    if native:
        DESCRIPTION = (
            'Soultied is a cozy pixel home for two people who live apart: a shared room you decorate together, '
            'a letter to open together every day, a wall of notes and photos, games for two and escape rooms. '
            'This is the iPhone app, made for the iPhone, with Sign in with Apple.'
        )
        WHATS_NEW = (
            'The new Soultied, made for the iPhone: the room, the daily letter, your wall, the games and the escape '
            'rooms are all built in. Sign in with the account you use on soultied.app and your place is right here. '
            'Tell us anything that feels off.'
        )
        NOTES = (
            'Soultied has no usernames or passwords: people sign in with Sign in with Apple (or Google), so any Apple '
            'Account works for review. After signing in, "Peek at a demo room first" shows a filled-in place without '
            'making anything; "Build our place" makes a new one, and a second person joins it with the invite code '
            'from the Us tab. Everything can be tried alone in a new place. Watch-together nights happen on '
            'soultied.app on a computer; the app links there.'
        )
    else:
        DESCRIPTION = (
            'Soultied is a cozy pixel home for two people who live apart: a shared room you decorate together, '
            'a letter to open together every day, games for two, and watch-together nights. '
            'This is the iPhone app, which opens your Soultied place in a native shell with Sign in with Apple.'
        )
        WHATS_NEW = (
            'Sign in with Apple or Google, open your place, and try the room, the daily letter, the games and a '
            'watch-together night with your person. Tell us anything that feels off on the iPhone.'
        )
        NOTES = (
            'Soultied has no usernames or passwords: people sign in with Sign in with Apple (or Google), so any Apple '
            'Account works for review. After signing in, the app offers to make a new place; a second person joins '
            'it with the invite link. Everything can be tried alone in a new place. The app shows soultied.app, our '
            'website, in a native shell; if the internet is off it shows an offline page.'
        )
    return DESCRIPTION, WHATS_NEW, NOTES


def say(kind, text):
    print(f'::{kind}::{text}')
    with open(SUMMARY, 'a') as f:
        f.write(f'- {text}\n')


def token():
    now = int(time.time())
    return jwt.encode(
        {'iss': os.environ['ASC_ISSUER_ID'], 'iat': now, 'exp': now + 1100, 'aud': 'appstoreconnect-v1'},
        os.environ['ASC_KEY_P8'],
        algorithm='ES256',
        headers={'kid': os.environ['ASC_KEY_ID'], 'typ': 'JWT'},
    )


class Refused(Exception):
    def __init__(self, status, body):
        self.status, self.body = status, body
        errs = (body or {}).get('errors') or []
        self.text = '; '.join(f"{e.get('title', '')}: {e.get('detail', '')}" for e in errs) or str(status)
        super().__init__(self.text)


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header('Authorization', 'Bearer ' + token())
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {'errors': [{'title': str(e.code), 'detail': raw.decode(errors='replace')[:300]}]}
        raise Refused(e.code, parsed)


def explain(kind, err, tb):
    if isinstance(err, Refused):
        say('error', f'App Store Connect said: {err.text}')
    sys.__excepthook__(kind, err, tb)


sys.excepthook = explain


def ref(kind, id_):
    return {'data': {'type': kind, 'id': id_}}


def upsert_one(list_path, kind, attrs, create_rel, match=lambda a: True, create_attrs=None):
    found = [d for d in call('GET', list_path).get('data', []) if match(d['attributes'])]
    if found:
        call('PATCH', f'/v1/{kind}/{found[0]["id"]}', {'data': {'type': kind, 'id': found[0]['id'], 'attributes': attrs}})
        return found[0]['id']
    made = call('POST', f'/v1/{kind}', {'data': {'type': kind, 'attributes': {**attrs, **(create_attrs or {})}, 'relationships': create_rel}})
    return made['data']['id']


# 1. the build: the one that just finished, or the newest one Apple has processed
build = None
deadline = time.time() + (35 * 60 if WANT else 0)
while True:
    q = f'/v1/builds?filter[app]={APP}&sort=-uploadedDate&limit=10&fields[builds]=version,processingState,expired'
    if WANT:
        q += f'&filter[version]={WANT}'
    rows = [b for b in call('GET', q).get('data', []) if not b['attributes'].get('expired')]
    ready = [b for b in rows if b['attributes'].get('processingState') == 'VALID']
    if ready:
        build = ready[0]
        break
    if any(b['attributes'].get('processingState') in ('FAILED', 'INVALID') for b in rows):
        say('error', f'Apple could not process build {WANT or "(latest)"}')
        sys.exit(1)
    if time.time() > deadline:
        say('error', f'Build {WANT or "(latest)"} is not ready in App Store Connect yet; run this again in a few minutes')
        sys.exit(1)
    time.sleep(30)
bid, number = build['id'], build['attributes']['version']

native = os.environ.get('APP_KIND', '').strip() == 'native' or (number.isdigit() and int(number) >= 1000)
DESCRIPTION, WHATS_NEW, NOTES = texts(native)

# 2. what testers see about the app (needed before outside testers can get builds)
contact = EMAIL or 'hello@soultied.app'
upsert_one(
    f'/v1/apps/{APP}/betaAppLocalizations', 'betaAppLocalizations',
    {'description': DESCRIPTION, 'feedbackEmail': contact, 'marketingUrl': 'https://soultied.app/',
     'privacyPolicyUrl': 'https://soultied.app/privacy/'},
    {'app': ref('apps', APP)}, match=lambda a: a.get('locale') == 'en-US', create_attrs={'locale': 'en-US'},
)

# 3. who Apple's beta reviewer can contact, and how to sign in
detail = call('GET', f'/v1/apps/{APP}/betaAppReviewDetail')['data']
review = {'contactFirstName': 'Vedanth', 'contactLastName': 'Bhat', 'contactEmail': contact,
          'demoAccountRequired': False, 'notes': NOTES}
if PHONE:
    review['contactPhone'] = PHONE
call('PATCH', f'/v1/betaAppReviewDetails/{detail["id"]}', {'data': {'type': 'betaAppReviewDetails', 'id': detail['id'], 'attributes': review}})
say('notice', 'Test information and beta review details are filled in' + ('' if PHONE else ' (no contact phone yet: add the REVIEW_PHONE secret)'))

upsert_one(
    f'/v1/builds/{bid}/betaBuildLocalizations', 'betaBuildLocalizations', {'whatsNew': WHATS_NEW},
    {'build': ref('builds', bid)}, match=lambda a: a.get('locale') == 'en-US', create_attrs={'locale': 'en-US'},
)

# 4. the group for people outside the Apple team, and the build in it
groups = call('GET', f'/v1/apps/{APP}/betaGroups?limit=50').get('data', [])
group = next((g for g in groups if g['attributes']['name'] == GROUP and not g['attributes'].get('isInternalGroup')), None)
if not group:
    group = call('POST', '/v1/betaGroups', {'data': {'type': 'betaGroups', 'attributes': {'name': GROUP, 'feedbackEnabled': True}, 'relationships': {'app': ref('apps', APP)}}})['data']
gid = group['id']
in_group = {b['id'] for b in call('GET', f'/v1/betaGroups/{gid}/relationships/builds?limit=200').get('data', [])}
if bid not in in_group:
    call('POST', f'/v1/betaGroups/{gid}/relationships/builds', {'data': [{'type': 'builds', 'id': bid}]})

# 5. the tester (an invite email goes out once Apple approves the build; any Apple Account can accept it)
if EMAIL:
    existing = call('GET', f'/v1/betaTesters?filter[email]={urllib.parse.quote(EMAIL)}&filter[apps]={APP}&limit=5').get('data', [])
    if existing:
        tid = existing[0]['id']
        mine = {t['id'] for t in call('GET', f'/v1/betaGroups/{gid}/relationships/betaTesters?limit=200').get('data', [])}
        if tid not in mine:
            call('POST', f'/v1/betaGroups/{gid}/relationships/betaTesters', {'data': [{'type': 'betaTesters', 'id': tid}]})
    else:
        call('POST', '/v1/betaTesters', {'data': {'type': 'betaTesters', 'attributes': {'email': EMAIL, 'firstName': 'Vedanth', 'lastName': 'Bhat'}, 'relationships': {'betaGroups': {'data': [{'type': 'betaGroups', 'id': gid}]}}}})
    say('notice', f'You are a tester in "{GROUP}"')
else:
    say('warning', 'No tester email yet: add the TESTER_EMAIL secret and run this again')

# 6. send it to Apple's beta review if it hasn't been
state = call('GET', f'/v1/builds/{bid}/buildBetaDetail')['data']['attributes'].get('externalBuildState')
if state == 'READY_FOR_BETA_SUBMISSION':
    try:
        call('POST', '/v1/betaAppReviewSubmissions', {'data': {'type': 'betaAppReviewSubmissions', 'relationships': {'build': ref('builds', bid)}}})
        state = call('GET', f'/v1/builds/{bid}/buildBetaDetail')['data']['attributes'].get('externalBuildState')
    except Refused as e:
        say('error', f'Apple did not take build {number} for beta review: {e.text}')
        sys.exit(1)
say('notice', f'Build {number} for outside testers: {state}')
