/**
 * The little window under the toolbar button: is everything connected, and
 * is your person watching? With buttons to open Soultied, Netflix or Prime.
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
}

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; width: 320px; background: #f4e8d0; color: #3a2a26; font: 14px/1.35 'Soultied Pixel', ui-sans-serif, system-ui, sans-serif; }
@font-face { font-family: 'Soultied Pixel'; src: url('fonts/PixelifySans-Variable.ttf'); font-weight: 400 700; }
.wrap { padding: 14px 14px 12px; display: flex; flex-direction: column; gap: 10px; }
.top { display: flex; align-items: center; gap: 8px; }
.top img { width: 24px; height: 24px; image-rendering: pixelated; }
.kicker { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: #8f4b3a; }
.name { font-weight: 700; font-size: 17px; }
.row { display: flex; gap: 8px; align-items: flex-start; }
.dot { width: 9px; height: 9px; margin-top: 5px; background: #b9a98f; flex: none; }
.dot.on { background: #8a9a72; }
.dot.warn { background: #c9843a; }
.muted { color: #7a5a48; font-size: 12px; }
.btns { display: flex; gap: 8px; flex-wrap: wrap; }
button { font: inherit; cursor: pointer; border: 0; background: #b8674f; color: #fff4e2; padding: 5px 10px; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #8f4b3a; margin: 3px; }
button.paper { background: #eadbbd; color: #3a2a26; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #d6c29c; }
hr { border: 0; border-top: 3px dashed #d6c29c; margin: 0; }
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

function button(text: string, onClick: () => void, paper = false) {
  const b = el('button', paper ? 'paper' : '', text);
  b.onclick = () => {
    onClick();
    window.close();
  };
  return b;
}

const site = (p: PlayerStatus['platform']) => (p === 'netflix' ? 'Netflix' : 'Prime Video');

function render(s: Snapshot) {
  const style = el('style');
  style.textContent = CSS;
  const wrap = el('div', 'wrap');

  const top = el('div', 'top');
  const icon = el('img');
  icon.src = 'icons/48.png';
  icon.alt = '';
  const title = el('div');
  title.append(el('div', 'kicker', s.place ? `Soultied · ${s.place}` : 'Soultied'), el('div', 'name', 'Watch together'));
  top.append(icon, title);
  wrap.append(top, el('hr'));

  const partner = s.partner || 'your person';
  const openHub = () => void chrome.runtime.sendMessage({ kind: 'openHub' });

  // 1. the Soultied tab, which carries everything between the two of you
  if (s.hub) {
    wrap.append(line('on', s.partner || !s.me ? 'Your Soultied tab is open.' : 'Your Soultied tab is open. Invite your person there first.'));
  } else {
    const b = el('div', 'btns');
    b.append(button('Open Soultied', openHub));
    wrap.append(line('warn', 'Open your Soultied place and keep that tab open while you watch. It carries everything between you two.', b));
  }

  // 2. the show (the tab in front of you comes first)
  const p = s.players[0];
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
    if (!p.connected) wrap.append(line('warn', 'Not connected to Soultied yet: open it (above), then this page connects by itself.'));
    else if (!p.partnerHere) wrap.append(line('off', `${partner} isn't here yet. They need their Soultied tab and ${site(p.platform)} open too.`));
    else if (!p.partnerWatching) wrap.append(line('on', `${partner} is here, picking something. When you're both on the same thing, you're in sync.`));
    else if (!p.watching || p.partnerWatching !== p.watching)
      wrap.append(line('warn', `${partner} is watching ${p.partnerWatching}. Press "Join them" (or "Go there") on the show to catch up.`));
    else wrap.append(line('on', `${partner} is watching with you. Play, pause and skipping stay in sync.`));
  }

  const opens = el('div', 'btns');
  opens.append(
    button('Open Netflix', () => void chrome.tabs.create({ url: 'https://www.netflix.com/browse', active: true }), true),
    button('Open Prime Video', () => void chrome.tabs.create({ url: 'https://www.primevideo.com/', active: true }), true),
  );
  wrap.append(el('hr'), opens, el('div', 'muted', 'You each open the same show on your own account. Hold T to talk while you watch.'));
  document.body.replaceChildren(style, wrap);
}

chrome.runtime.sendMessage({ kind: 'popup' }).then(
  (s) => render(s as Snapshot),
  () => render({ hub: false, me: null, partner: null, place: null, players: [] }),
);
