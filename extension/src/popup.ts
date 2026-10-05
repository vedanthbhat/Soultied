/**
 * The little window under the toolbar button. Without a Soultied place: start
 * a watch party (or join one from a link), copy the link, leave. With one:
 * is everything connected, and is your person watching? With buttons to open
 * Netflix, Prime Video, or Soultied itself.
 */

interface PlayerStatus {
  platform: 'netflix' | 'prime';
  video: boolean;
  connected: boolean;
  watching: string | null;
  partnerHere: boolean;
  partnerWatching: string | null;
}

interface Snapshot {
  hub: boolean;
  me: string | null;
  partner: string | null;
  place: string | null;
  players: PlayerStatus[];
  /** the Netflix / Prime tab in front of you was opened before the extension was, so it can't see it */
  stale?: boolean;
  /** the tab in front of you is Netflix or Prime Video */
  onShow?: boolean;
  party?: { link: string; partner: string | null } | null;
  /** your name from last time */
  name?: string;
  site?: string;
}

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; width: 330px; background: #f4e8d0; color: #3a2a26; font: 14px/1.35 'Soultied Pixel', ui-sans-serif, system-ui, sans-serif; font-variant-ligatures: none; -webkit-font-smoothing: antialiased; }
@font-face { font-family: 'Soultied Pixel'; src: url('fonts/PixelifySans-Variable.ttf'); font-weight: 400 700; font-display: block; }
.wrap { padding: 14px 14px 12px; display: flex; flex-direction: column; gap: 10px; }
.top { display: flex; align-items: center; gap: 8px; }
.top img { width: 24px; height: 24px; image-rendering: pixelated; }
.kicker { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #8f4b3a; }
.name { font-weight: 700; font-size: 17px; }
.row { display: flex; gap: 8px; align-items: flex-start; }
.dot { width: 9px; height: 9px; margin-top: 5px; background: #b9a98f; flex: none; }
.dot.on { background: #8a9a72; }
.dot.warn { background: #c9843a; }
.muted { color: #7a5a48; font-size: 13px; }
.err { color: #a84f4b; font-size: 13px; }
.label { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: #8f4b3a; }
.btns { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
form { display: flex; gap: 8px; align-items: center; margin: 0; }
input { font: inherit; font-size: 13px; flex: 1; min-width: 0; border: 0; padding: 5px 7px; background: #fff8ea; color: #2b1e1c; box-shadow: inset 0 0 0 2px #2b1e1c; outline: none; margin: 3px; }
button { font: inherit; cursor: pointer; border: 0; background: #b8674f; color: #fff4e2; padding: 5px 10px; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #8f4b3a; margin: 3px; white-space: nowrap; }
button.paper { background: #eadbbd; color: #3a2a26; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #d6c29c; }
button.sage { background: #8a9a72; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #6a7856; }
button.link { background: none; box-shadow: none; color: #8f4b3a; padding: 0; margin: 0; text-decoration: underline; font-size: 13px; }
button[disabled] { opacity: .6; cursor: default; }
hr { border: 0; border-top: 3px dashed #d6c29c; margin: 0; }
.plus { background: #eadbbd; padding: 7px 9px; font-size: 13px; box-shadow: inset 0 0 0 2px #d6c29c; }
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

function line(state: 'on' | 'off' | 'warn', text: string, extra?: HTMLElement) {
  const r = el('div', 'row');
  r.append(el('span', `dot ${state === 'off' ? '' : state}`));
  const body = el('div');
  body.append(el('div', '', text));
  if (extra) body.append(extra);
  r.append(body);
  return r;
}

function button(text: string, onClick: () => void, kind: '' | 'paper' | 'sage' | 'link' = '', close = true) {
  const b = el('button', kind, text);
  b.onclick = () => {
    onClick();
    if (close) window.close();
  };
  return b;
}

const ask = <T = { ok: boolean; error?: string; link?: string }>(msg: object) => chrome.runtime.sendMessage(msg) as Promise<T>;
const site = (p: PlayerStatus['platform']) => (p === 'netflix' ? 'Netflix' : 'Prime Video');
const ERRORS: Record<string, string> = {
  offline: 'Couldn’t reach Soultied. Check your connection and try again.',
  missing: 'That watch party doesn’t exist any more. Ask for a new link.',
  full: 'That watch party already has two people in it.',
  link: 'That doesn’t look like a Soultied watch party link.',
};
const errorText = (e?: string) => ERRORS[e || ''] || 'That didn’t work. Try again in a moment.';

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** your name, a button, and somewhere to say what went wrong */
function nameForm(s: Snapshot, label: string, extra: HTMLInputElement | null, onGo: (name: string, extra: string, done: (err?: string) => void) => void) {
  const box = el('div');
  const form = el('form');
  const name = el('input');
  name.placeholder = 'Your name';
  name.maxLength = 40;
  name.value = s.name || '';
  name.setAttribute('aria-label', 'Your name');
  const go = el('button', '', label);
  go.type = 'submit';
  form.append(name, go);
  const err = el('div', 'err');
  form.onsubmit = (ev) => {
    ev.preventDefault();
    const n = name.value.trim();
    if (!n) return name.focus();
    if (extra && !extra.value.trim()) return extra.focus();
    go.disabled = true;
    err.textContent = '';
    onGo(n, extra?.value.trim() || '', (e) => {
      go.disabled = false;
      if (e) err.textContent = errorText(e);
    });
  };
  if (extra) box.append(extra);
  box.append(form, err);
  return box;
}

function showLines(s: Snapshot, wrap: HTMLElement, name: string) {
  const p = s.players[0];
  // starts a sentence
  const partner = name.charAt(0).toUpperCase() + name.slice(1);
  if (s.stale) {
    wrap.append(line('warn', 'Refresh this tab so Soultied can see the show (it was open before the extension was).'));
  } else if (!p) {
    wrap.append(line('off', 'Now open Netflix or Prime Video and start something.'));
  } else {
    wrap.append(
      line(
        p.video ? 'on' : 'off',
        !p.video ? `${site(p.platform)} is open. Start something to watch.` : p.watching ? `You're watching ${p.watching} on ${site(p.platform)}.` : `You're watching ${site(p.platform)}.`,
      ),
    );
    if (!p.connected) wrap.append(line('warn', s.party ? 'Connecting to your watch party…' : 'Not connected to Soultied yet: open it (above), then this page connects by itself.'));
    else if (!p.partnerHere)
      wrap.append(line('off', s.party ? `${partner} isn't watching right now.` : `${partner} isn't here yet. They need their Soultied tab and ${site(p.platform)} open too.`));
    else if (!p.partnerWatching) wrap.append(line('on', `${partner} is here, picking something. When you're both on the same thing, you're in sync.`));
    else if (!p.watching || p.partnerWatching !== p.watching)
      wrap.append(line('warn', `${partner} is watching ${p.partnerWatching}. Press "Join them" (or "Go there") on the show to catch up.`));
    else wrap.append(line('on', `${partner} is watching with you. Play, pause and skipping stay in sync.`));
  }
}

/** the link to send, with a copy button */
function linkBox(link: string, copiedAlready: boolean) {
  const box = el('div');
  const form = el('form');
  const field = el('input');
  field.readOnly = true;
  field.value = link;
  field.setAttribute('aria-label', 'Watch party link');
  field.onfocus = () => field.select();
  const b = el('button', 'sage', copiedAlready ? 'Copied ✓' : 'Copy link');
  b.type = 'submit';
  form.append(field, b);
  form.onsubmit = (ev) => {
    ev.preventDefault();
    void copy(link).then((ok) => {
      if (!ok) field.select();
      b.textContent = ok ? 'Copied ✓' : `Press ${/Mac/i.test(navigator.platform) ? '⌘C' : 'Ctrl+C'}`;
    });
  };
  box.append(form);
  return box;
}

function render(s: Snapshot, opts: { copied?: boolean } = {}) {
  const style = el('style');
  style.textContent = CSS;
  const wrap = el('div', 'wrap');
  const party = s.party || null;

  const top = el('div', 'top');
  const icon = el('img');
  icon.src = 'icons/48.png';
  icon.alt = '';
  const title = el('div');
  title.append(el('div', 'kicker', party ? 'Soultied · Watch party' : s.place ? `Soultied · ${s.place}` : 'Soultied'), el('div', 'name', 'Watch together'));
  top.append(icon, title);
  wrap.append(top, el('hr'));

  const partner = s.partner || 'your person';
  const openHub = () => void ask({ kind: 'openHub' });
  const openSite = () => void ask({ kind: 'openSite' });
  const refresh = (o?: { copied?: boolean }) => void ask<Snapshot>({ kind: 'popup' }).then((n) => render(n, o));

  if (party) {
    // 1. in a watch party: who's here, the link, and how to leave
    wrap.append(
      line(
        party.partner ? 'on' : 'warn',
        party.partner ? `You and ${party.partner} are in this watch party.` : 'Waiting for your person to join. Send them this link; it takes them to the same show.',
      ),
    );
    wrap.append(linkBox(party.link, !!opts.copied));
    showLines(s, wrap, party.partner || 'Your person');
    wrap.append(el('div', 'plus', 'Voice and cameras are coming with Soultied Plus. For now, there’s the chat on the show.'));
    const leave = el('div', 'btns');
    leave.append(
      button(
        'Leave the party',
        () => void ask({ kind: 'leaveParty' }).then(() => refresh()),
        'paper',
        false,
      ),
    );
    wrap.append(leave);
  } else if (s.hub || s.place) {
    // 2. your Soultied place, which carries everything between the two of you
    if (s.hub) {
      wrap.append(line('on', s.partner || !s.me ? 'Your Soultied tab is open.' : 'Your Soultied tab is open. Invite your person there first.'));
    } else {
      const b = el('div', 'btns');
      b.append(button('Open Soultied', openHub));
      wrap.append(line('warn', 'Open your Soultied place and keep that tab open while you watch. It carries everything between you two.', b));
    }
    showLines(s, wrap, partner);
    // or watch with someone without a place
    const more = el('div');
    const toggle = button('Or start a watch party link (no place needed)', () => {
      toggle.remove();
      more.append(
        nameForm(s, 'Start', null, (name, _x, done) =>
          void ask({ kind: 'startParty', name }).then((r) => {
            if (!r?.ok) return done(r?.error);
            void copy(r.link || '').then((ok) => refresh({ copied: ok }));
          }),
        ),
      );
    }, 'link', false);
    more.append(toggle);
    wrap.append(more);
  } else {
    // 3. no Soultied place: start a watch party, or join one
    wrap.append(el('div', '', 'Watch Netflix or Prime Video in sync with your person, wherever they are, with a chat and a little couch on the show.'));
    wrap.append(el('div', 'label', 'Start a watch party'));
    if (!s.onShow) wrap.append(el('div', 'muted', 'Tip: open the show first, so the link takes them straight to it.'));
    wrap.append(
      nameForm(s, 'Start', null, (name, _x, done) =>
        void ask({ kind: 'startParty', name }).then((r) => {
          if (!r?.ok) return done(r?.error);
          void copy(r.link || '').then((ok) => refresh({ copied: ok }));
        }),
      ),
    );
    wrap.append(el('div', 'label', 'Got a link?'));
    const linkIn = el('input');
    linkIn.placeholder = 'Paste the watch party link';
    linkIn.setAttribute('aria-label', 'Watch party link');
    wrap.append(
      nameForm(s, 'Join', linkIn, (name, link, done) =>
        void ask({ kind: 'joinParty', link, name }).then((r) => {
          if (!r?.ok) return done(r?.error);
          window.close();
        }),
      ),
    );
  }

  const opens = el('div', 'btns');
  opens.append(
    button('Open Netflix', () => void chrome.tabs.create({ url: 'https://www.netflix.com/browse', active: true }), 'paper'),
    button('Open Prime Video', () => void chrome.tabs.create({ url: 'https://www.primevideo.com/', active: true }), 'paper'),
  );
  wrap.append(el('hr'), opens);
  if (party || !(s.hub || s.place)) {
    // where the extension comes from
    const about = el('div', 'muted');
    about.append(
      'You each need your own Netflix or Prime account. New to Soultied? It’s a little home online for two people who live apart: daily letters, games and a room you share. ',
      button('Visit soultied.app', openSite, 'link'),
    );
    wrap.append(about);
  } else wrap.append(el('div', 'muted', 'You each open the same show on your own account. Hold T to talk while you watch.'));
  document.body.replaceChildren(style, wrap);
}

chrome.runtime.sendMessage({ kind: 'popup' }).then(
  (s) => render(s as Snapshot),
  () => render({ hub: false, me: null, partner: null, place: null, players: [] }),
);
