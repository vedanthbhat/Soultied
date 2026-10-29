import React, { Suspense, useEffect, useRef, useState } from 'react';
import { InvitePreview, useApp } from '../context/AppContext';
import { AvatarConfig } from '../types';
import { DEFAULT_AVATAR_A, DEFAULT_AVATAR_B } from '../pixel/character';
import { CharacterStudio } from '../lazy';
import { EXTENSION_STORE_URL } from '../stream/protocol';
import { inApp, inIosApp } from '../cloud/firebase';
import type { Seat } from '../pixel/room';

type Step = 'welcome' | 'details' | 'look' | 'invite' | 'join' | 'join-look';

interface Props {
  initialJoinCode?: string | null;
  /** goes up each time someone taps an empty seat in the room behind the welcome cards */
  nudge?: number;
  onDraftSeats: (seats: { left: Seat; right: Seat }) => void;
  onDone: () => void;
}

const empty = (name = ''): Seat => ({ avatar: null, name, status: 'empty' });
/** a dark placeholder the size of the watch-party picture, until it's here */
const BLANK = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22480%22 height=%22300%22%3E%3Crect width=%22480%22 height=%22300%22 fill=%22%231d1518%22/%3E%3C/svg%3E';

export const Welcome: React.FC<Props> = ({ initialJoinCode, nudge = 0, onDraftSeats, onDone }) => {
  const { createSpace, lookupInvite, joinWithCode, loadDemo, inviteLink, space, cloudEnabled, cloudStatus, signIn, authError, signedInEmail } = useApp();
  const [step, setStep] = useState<Step>(initialJoinCode ? 'join' : 'welcome');
  // online, you sign in with Google before building a place or taking a seat
  const needSignIn = cloudEnabled && cloudStatus === 'signedOut';
  const [signingIn, setSigningIn] = useState<false | 'google' | 'apple'>(false);
  // in the iPhone app: Apple's sign-in too, and none of the computer-only things (the Chrome extension, buying Plus on the web)
  const app = inApp();
  const apple = inIosApp();
  const [joining, setJoining] = useState(false);

  // create flow
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [together, setTogether] = useState('');
  const [placeName, setPlaceName] = useState('Our Little Place');
  const [look, setLook] = useState<AvatarConfig>(DEFAULT_AVATAR_A);

  // join flow
  const [code, setCode] = useState(initialJoinCode || '');
  const [joinName, setJoinName] = useState('');
  const [joinLook, setJoinLook] = useState<AvatarConfig>(DEFAULT_AVATAR_B);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  // the watch-party picture is a little file of its own, so the front door doesn't wait for it
  const [watchShot, setWatchShot] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!inApp()) import('../assets/watchShot').then((m) => alive && setWatchShot(m.WATCH_SHOT)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  // Tapping a "+" seat first (most people do): point them at making their character
  const [nudged, setNudged] = useState(0);
  const placeCard = useRef<HTMLElement | null>(null);
  const firstField = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (!nudge) return;
    if (step === 'welcome') {
      setNudged((n) => n + 1);
      placeCard.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else if (step === 'details') firstField.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge]);

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  useEffect(() => {
    if (!code.trim() || needSignIn || cloudStatus === 'checking') {
      setInvite(null);
      return;
    }
    let alive = true;
    const t = window.setTimeout(() => lookupInvite(code).then((i) => alive && setInvite(i)), 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, needSignIn, cloudStatus]);

  // signed in to an account that already has a place: go straight there
  // (unless you opened an invite to a different place: then you can still take that seat)
  useEffect(() => {
    if (cloudStatus !== 'ready') return;
    const otherInvite = step === 'join' && !!initialJoinCode && space?.inviteCode.toUpperCase() !== initialJoinCode.trim().toUpperCase();
    if ((step === 'welcome' || step === 'details' || step === 'join') && !otherInvite) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudStatus, step]);

  const doSignIn = async (how: 'google' | 'apple' = 'google') => {
    setSigningIn(how);
    await signIn(how);
    setSigningIn(false);
  };

  // Keep the room behind the sheet in sync with what's being built
  useEffect(() => {
    if (step === 'look') onDraftSeats({ left: { avatar: look, name: myName, status: 'online' }, right: empty(partnerName) });
    else if (step === 'invite' && space) onDraftSeats({ left: { avatar: look, name: myName, status: 'online' }, right: empty(partnerName) });
    else if ((step === 'join' || step === 'join-look') && invite)
      onDraftSeats({
        left: { avatar: invite.hostAvatar, name: invite.hostName, status: 'online' },
        right: step === 'join-look' ? { avatar: joinLook, name: joinName, status: 'online' } : empty(),
      });
    else onDraftSeats({ left: empty(), right: empty() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, look, joinLook, myName, partnerName, joinName, invite?.hostName]);

  const copy = async (what: 'link' | 'code') => {
    const text = what === 'link' ? inviteLink : space?.inviteCode || '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard blocked: the text is selectable in the box
    }
    setCopied(what);
    window.setTimeout(() => setCopied(null), 2200);
  };

  const Dots = ({ n }: { n: number }) => (
    <div className="flex gap-2 mb-4" aria-label={`Step ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="inline-block w-3 h-3" style={{ background: i <= n ? 'var(--terracotta)' : 'var(--paper-shade)' }} />
      ))}
    </div>
  );

  const wide = step === 'look' || step === 'join-look';
  const gate = needSignIn && (step === 'details' || step === 'join');

  const signInCard = (
    <div className="flex flex-col gap-5">
      <div>
        <div className="text-sm font-semibold tracking-[0.16em] uppercase text-[var(--terracotta-d)]">
          {step === 'join' ? "You're invited" : 'One quick thing'}
        </div>
        <h2 className="text-3xl font-bold leading-tight mt-1">{step === 'join' ? 'Sign in to take your seat.' : 'Sign in to save your place.'}</h2>
        <p className="text-[var(--muted)] mt-1">
          {step === 'join'
            ? `Your seat is saved to your ${apple ? '' : 'Google '}account, so you can come back from any phone or laptop.`
            : `Your place is saved to your ${apple ? '' : 'Google '}account, so your person can join you from their own phone, and you can come back from anywhere.`}
        </p>
      </div>
      <button className="px-btn text-lg" onClick={() => void doSignIn('google')} disabled={!!signingIn}>
        {signingIn === 'google' ? 'Opening Google…' : 'Continue with Google'}
      </button>
      {apple && (
        <button className="px-btn px-btn--paper text-lg" onClick={() => void doSignIn('apple')} disabled={!!signingIn}>
          {signingIn === 'apple' ? 'Opening Apple…' : 'Continue with Apple'}
        </button>
      )}
      {authError && <div className="px-inset text-sm p-3 text-[#7f3835]">{authError}</div>}
      <p className="text-xs text-[var(--muted)]">
        {apple
          ? 'Already use Soultied on a computer? Pick the same one you used there. We only use it to sign you in, and your letters stay between the two of you.'
          : 'We only use your Google account to sign you in. Your letters stay between the two of you.'}
      </p>
      <button className="px-btn px-btn--paper self-start" onClick={() => setStep('welcome')}>
        Back
      </button>
    </div>
  );

  // the front door: two small cards stacked on the left (a place for the two of you, and the watch-party extension),
  // leaving the room itself in view
  if (step === 'welcome' && cloudStatus !== 'checking')
    return (
      <div className="fixed inset-0 z-40 pointer-events-none px-ui flex items-end md:items-center p-3 md:p-6">
        <div
          className="pointer-events-auto w-full flex flex-col gap-3 short:gap-2 max-h-[78vh] md:max-h-[calc(100vh-48px)] overflow-y-auto px-scroll"
          style={{ maxWidth: 432, scrollbarGutter: 'stable' }}
        >
          <section ref={placeCard} className="px-box px-shadow px-pop flex flex-col gap-3 p-5 short:gap-2.5 short:px-5 short:py-4 min-w-0" aria-labelledby="door-place">
            <div>
              <div className="text-xs font-semibold tracking-[0.16em] uppercase text-[var(--terracotta-d)]">Our place · for two</div>
              <h1 id="door-place" className="text-4xl font-bold leading-none text-[var(--ink-soft)] mt-1 mb-0">
                Soultied
              </h1>
            </div>
            <p className="m-0 text-lg font-semibold leading-snug text-balance text-[var(--ink-soft)]">A shared home for long-distance couples.</p>
            <p className="m-0 -mt-1 leading-snug text-balance text-[var(--muted)]">
              A daily letter, games for two, a record player and movie nights.
            </p>
            {nudged > 0 && (
              <div key={nudged} className="px-inset px-nudge p-3 flex flex-col gap-3" role="status">
                <p className="m-0 leading-snug">
                  <strong>That seat’s waiting for you.</strong> First, make your little character. It takes a minute, then you can save the other seat for your person.
                </p>
                <button className="px-btn px-btn--sage px-pulse text-base" onClick={() => setStep('details')}>
                  Make my character →
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <button className="px-btn flex-1 whitespace-nowrap text-base" onClick={() => setStep('details')}>
                Build our place →
              </button>
              <button className="px-btn px-btn--paper flex-1 whitespace-nowrap text-base" onClick={() => setStep('join')}>
                I have an invite
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <button
                className="px-link"
                onClick={() => {
                  loadDemo().then(onDone);
                }}
              >
                Peek at a demo room
              </button>
              {!app && (
                <a className="px-link" href="/plus/">
                  Plus: cameras & voice →
                </a>
              )}
            </div>
          </section>

          {/* the watch-party extension is for computers: not shown in the iPhone app */}
          {!app && (
            <section className="px-box px-shadow px-pop flex flex-col gap-3 p-5 short:gap-2.5 short:px-5 short:py-4 min-w-0" aria-labelledby="door-watch">
              <div>
                <div className="text-xs font-semibold tracking-[0.16em] uppercase text-[var(--terracotta-d)]">Watch party · Netflix, Prime & more</div>
                <h2 id="door-watch" className="text-2xl font-bold leading-tight mt-1 mb-0">
                  Watch together
                </h2>
              </div>
              {/* on shorter screens (most laptops) the picture sits beside the line, so both cards fit without scrolling */}
              <div className="flex flex-col gap-3 md:[@media(max-height:860px)]:flex-row md:[@media(max-height:860px)]:items-center">
                <img
                  src={watchShot || BLANK}
                  alt="A Soultied watch party on a show: the chat beside the video and two pixel characters on a little couch in the corner."
                  width={480}
                  height={300}
                  className="block w-full h-auto shrink-0 md:[@media(max-height:860px)]:w-[50%]"
                  style={{ boxShadow: '0 0 0 3px var(--ink)' }}
                />
                <p className="m-0 leading-snug">Your shows in sync, with a chat. Free, no account.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a className="px-btn flex-1 whitespace-nowrap text-center text-base" href={EXTENSION_STORE_URL} target="_blank" rel="noopener">
                  Add to Chrome
                </a>
                <a className="px-btn px-btn--paper flex-1 whitespace-nowrap text-center text-base" href="/watch/">
                  How it works
                </a>
              </div>
            </section>
          )}

          <nav className="px-box flex flex-wrap justify-center gap-x-4 gap-y-1 px-4 py-2 text-xs text-[var(--muted)]" aria-label="About Soultied">
            <a className="px-link" href="/terms/">Terms</a>
            <a className="px-link" href="/privacy/">Privacy</a>
            <a className="px-link" href="/refunds/">Refunds</a>
            <a className="px-link" href="/contact/">Contact</a>
          </nav>
        </div>
      </div>
    );

  return (
    <div className="fixed inset-0 z-40 pointer-events-none px-ui flex items-end md:items-center p-3 md:p-6">
      <div
        className="pointer-events-auto px-box px-shadow px-pop w-full flex flex-col max-h-[72vh] md:max-h-[calc(100vh-48px)]"
        style={{ maxWidth: wide ? 560 : 470 }}
        key={step}
      >
        <div className="px-scroll overflow-y-auto p-6 md:p-8 flex-1">
          {gate && signInCard}

          {step === 'welcome' && cloudStatus === 'checking' && (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <span className="text-2xl font-bold">Opening the door…</span>
              <span className="text-[var(--muted)]">Finding your place.</span>
            </div>
          )}

          {step === 'details' && !gate && (
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                setStep('look');
              }}
            >
              <Dots n={1} />
              <div>
                <h2 className="text-3xl font-bold leading-tight">First, the two of you.</h2>
                <p className="text-[var(--muted)] mt-1">Just names for now. You can change everything later.</p>
              </div>
              <label>
                <span className="px-label">Your name</span>
                <input ref={firstField} className="px-input" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="e.g. Vedanth" required autoFocus maxLength={24} />
              </label>
              <label>
                <span className="px-label">Your person's name</span>
                <input className="px-input" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Who's the other seat for?" required maxLength={24} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <label>
                  <span className="px-label">Together since (optional)</span>
                  <input className="px-input" type="date" value={together} onChange={(e) => setTogether(e.target.value)} max={new Date().toISOString().split('T')[0]} />
                </label>
                <label>
                  <span className="px-label">Name your place</span>
                  <input className="px-input" value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={32} />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3 mt-2">
                <button type="button" className="px-btn px-btn--paper" onClick={() => setStep('welcome')}>
                  Back
                </button>
                <button type="submit" className="px-btn">
                  Make my character →
                </button>
              </div>
            </form>
          )}

          {step === 'look' && (
            <div className="flex flex-col gap-4">
              <Dots n={2} />
              <div>
                <h2 className="text-3xl font-bold leading-tight">Now make you.</h2>
                <p className="text-[var(--muted)] mt-1">Watch the couch: that's you, already sitting by the fire.</p>
              </div>
              <Suspense fallback={<div className="py-10 text-center text-[var(--muted)]">Opening the wardrobe…</div>}>
                <CharacterStudio value={look} onChange={setLook} compact />
              </Suspense>
              <div className="flex items-center justify-between gap-3 mt-2">
                <button className="px-btn px-btn--paper" onClick={() => setStep('details')}>
                  Back
                </button>
                <button
                  className="px-btn"
                  onClick={() => {
                    createSpace({ spaceName: placeName, myName, partnerName, togetherSince: together || undefined, avatar: look });
                    setStep('invite');
                  }}
                >
                  Save my seat →
                </button>
              </div>
            </div>
          )}

          {step === 'invite' && !space && (
            <div className="flex flex-col gap-4">
              <Dots n={3} />
              {authError ? (
                <>
                  <p className="text-[var(--terracotta)]">{authError}</p>
                  <button className="px-btn self-start" onClick={() => setStep('look')}>
                    Try again
                  </button>
                </>
              ) : (
                <p className="text-xl text-[var(--muted)]">Saving your place…</p>
              )}
            </div>
          )}

          {step === 'invite' && space && (
            <div className="flex flex-col gap-5">
              <Dots n={3} />
              <div>
                <h2 className="text-3xl font-bold leading-tight">Save {partnerName || 'them'} a seat.</h2>
                <p className="text-[var(--muted)] mt-1">
                  Send {partnerName || 'your person'} this link. They'll make their character and sit down right next
                  to you.
                </p>
              </div>
              <div>
                <span className="px-label">Invite link</span>
                <div className="flex gap-3 items-stretch">
                  <input className="px-input text-sm" readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
                  <button className="px-btn px-btn--sage shrink-0" onClick={() => copy('link')}>
                    {copied === 'link' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div>
                <span className="px-label">Or share the code</span>
                <div className="flex gap-3 items-stretch">
                  <div className="px-inset flex-1 text-center text-xl font-bold tracking-[0.12em] py-2 select-all">{space.inviteCode}</div>
                  <button className="px-btn px-btn--paper shrink-0" onClick={() => copy('code')}>
                    {copied === 'code' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-[var(--muted)] mt-2">Valid for 7 days. You can find it again under “Invite” in the menu.</p>
              </div>
              <button className="px-btn text-lg mt-1" onClick={onDone}>
                Step inside →
              </button>
              {!cloudEnabled && (
                <p className="text-xs text-[var(--muted)]">Preview build: invites work within this browser until the backend is connected.</p>
              )}
            </div>
          )}

          {step === 'join' && !gate && (
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (!invite) {
                  setError(
                    cloudEnabled
                      ? "We couldn't find that invite. Check the code, or ask for a fresh link."
                      : "We couldn't find that invite. Check the code, or ask for a fresh link. (In this preview, invites only work in the browser that created them.)"
                  );
                  return;
                }
                if (invite.taken) {
                  setError('That seat is already taken. This place already has two people.');
                  return;
                }
                if (invite.expired) {
                  setError('This invite has expired. Ask for a fresh one.');
                  return;
                }
                setStep('join-look');
              }}
            >
              <div>
                <div className="text-sm font-semibold tracking-[0.16em] uppercase text-[var(--terracotta-d)]">You're invited</div>
                <h2 className="text-3xl font-bold leading-tight mt-1">
                  {invite ? `${invite.hostName} saved you a seat.` : 'Come on in.'}
                </h2>
                <p className="text-[var(--muted)] mt-1">
                  {invite ? `Welcome to ${invite.spaceName}.` : 'Paste the code from your invite.'}
                </p>
                {signedInEmail && <p className="text-xs text-[var(--muted)] mt-1">Signed in as {signedInEmail}</p>}
              </div>
              <label>
                <span className="px-label">Invite code</span>
                <input className="px-input uppercase tracking-[0.1em]" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ST-XXXX-XXXX-XXXX" required />
              </label>
              <label>
                <span className="px-label">Your name</span>
                <input
                  className="px-input"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder={invite?.partnerPlaceholderName || 'Your name'}
                  required
                  maxLength={24}
                />
              </label>
              {error && <div className="px-inset text-sm p-3 text-[#7f3835]">{error}</div>}
              <div className="flex items-center justify-between gap-3 mt-2">
                <button type="button" className="px-btn px-btn--paper" onClick={() => setStep('welcome')}>
                  Back
                </button>
                <button type="submit" className="px-btn">
                  Make my character →
                </button>
              </div>
            </form>
          )}

          {step === 'join-look' && invite && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-3xl font-bold leading-tight">Now make you.</h2>
                <p className="text-[var(--muted)] mt-1">{invite.hostName} is already on the couch. Your seat's right there.</p>
              </div>
              <Suspense fallback={<div className="py-10 text-center text-[var(--muted)]">Opening the wardrobe…</div>}>
                <CharacterStudio value={joinLook} onChange={setJoinLook} compact />
              </Suspense>
              {error && <div className="px-inset text-sm p-3 text-[#7f3835]">{error}</div>}
              <div className="flex items-center justify-between gap-3 mt-2">
                <button className="px-btn px-btn--paper" onClick={() => setStep('join')}>
                  Back
                </button>
                <button
                  className="px-btn"
                  disabled={joining}
                  onClick={async () => {
                    setJoining(true);
                    setError(null);
                    const r = await joinWithCode(code, joinName, joinLook);
                    setJoining(false);
                    if (r === 'ok') onDone();
                    else setError(r === 'expired' ? 'This invite has expired. Ask for a fresh one.' : r === 'full' ? 'That seat is already taken.' : "We couldn't find that invite.");
                  }}
                >
                  {joining ? 'Sitting down…' : 'Take my seat →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
