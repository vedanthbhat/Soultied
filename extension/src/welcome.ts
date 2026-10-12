/**
 * The page Soultied opens once, right after it's added to Chrome: what it does and how to start.
 * (Not when it was added from a watch party link: that page carries on by itself.)
 */

const css = `
  @font-face { font-family: 'Soultied Pixel'; src: url('fonts/PixelifySans-Variable.ttf'); font-weight: 400 700; }
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 32px 16px; background: #2b1e1c;
    font-family: 'Soultied Pixel', ui-sans-serif, system-ui, sans-serif; color: #3a2a26; font-variant-ligatures: none; }
  .card { width: min(560px, 100%); background: #f4e8d0; padding: 28px 28px 24px;
    box-shadow: 0 -3px 0 0 #120c0b, 0 3px 0 0 #120c0b, -3px 0 0 0 #120c0b, 3px 0 0 0 #120c0b, 8px 8px 0 3px rgba(0,0,0,.4); }
  .kicker { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #8f4b3a; margin: 0 0 8px; }
  h1 { margin: 0 0 12px; font-size: 30px; line-height: 1.15; color: #2b1e1c; display: flex; gap: 12px; align-items: center; }
  h1 img { width: 32px; height: 32px; image-rendering: pixelated; }
  p { margin: 0 0 14px; font-size: 16px; line-height: 1.45; }
  ol { margin: 6px 0 18px; padding: 0; list-style: none; counter-reset: s; display: flex; flex-direction: column; gap: 10px; }
  li { counter-increment: s; display: grid; grid-template-columns: 30px 1fr; gap: 10px; align-items: start; font-size: 16px; line-height: 1.4; }
  li::before { content: counter(s); display: grid; place-items: center; width: 26px; height: 26px; background: #b8674f; color: #fff4e2; font-size: 14px;
    box-shadow: 0 -2px 0 0 #2b1e1c, 0 2px 0 0 #2b1e1c, -2px 0 0 0 #2b1e1c, 2px 0 0 0 #2b1e1c; }
  .pill { display: inline-block; background: #fff8ea; padding: 1px 7px; box-shadow: inset 0 0 0 2px #2b1e1c; white-space: nowrap; }
  .row { display: flex; gap: 14px; flex-wrap: wrap; margin: 4px 0 18px; }
  a.btn { text-decoration: none; display: inline-block; background: #b8674f; color: #fff4e2; padding: 10px 16px; font-size: 16px;
    box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #8f4b3a; }
  a.btn.paper { background: #eadbbd; color: #3a2a26; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #d6c29c; }
  a.btn:hover { filter: brightness(1.06); }
  a.btn:focus-visible { outline: 2px solid #b8674f; outline-offset: 5px; }
  .tip { background: #fff8ea; padding: 12px 14px; font-size: 14px; line-height: 1.45; box-shadow: inset 0 0 0 2px #d6c29c; margin: 0 0 14px; }
  .muted { color: #7a6558; font-size: 13px; margin: 0; }
  .muted a { color: inherit; }
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

document.title = 'Soultied is ready';
const style = el('style');
style.textContent = css;
document.head.append(style);

const card = el('main', 'card');
const h = el('h1');
const icon = el('img');
icon.src = 'icons/48.png';
icon.alt = '';
h.append(icon, el('span', '', 'Soultied is ready'));

const steps = el('ol');
const step = (...parts: (string | HTMLElement)[]) => {
  const li = el('li');
  const span = el('span');
  span.append(...parts);
  li.append(span);
  steps.append(li);
};
step('Open Netflix or Prime Video.');
step('Hover any show and press ', el('span', 'pill', '♥ Watch together'), '. (Or start one from the show itself.)');
step('Send your person the link (it’s copied for you). When they open it, they’re on the couch with you, in sync.');

const row = el('div', 'row');
const open = (label: string, url: string, cls = 'btn') => {
  const a = el('a', cls, label);
  a.href = url;
  row.append(a);
};
open('Open Netflix', 'https://www.netflix.com/browse');
open('Open Prime Video', 'https://www.primevideo.com/', 'btn paper');

const tip = el('p', 'tip', 'Keep Soultied handy: click the puzzle piece at the top right of Chrome, then the pin next to Soultied. Its button shows your watch party and its link.');

const foot = el('p', 'muted');
const privacy = el('a', '', 'what Soultied keeps');
privacy.href = 'https://soultied.app/privacy/';
foot.append('You each need your own Netflix or Prime Video account. See ', privacy, '.');

card.append(
  el('p', 'kicker', 'Soultied · Watch together'),
  h,
  el('p', '', 'Watch with someone far away: play, pause and skipping stay in sync, with a chat and a little pixel couch on the show.'),
  steps,
  row,
  tip,
  foot,
);
document.body.append(card);
