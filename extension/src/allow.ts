/**
 * The small window that asks for the camera and mic, once, for Soultied itself.
 *
 * Calls in a Plus watch party run in the extension's hidden page (so they carry on while you switch
 * shows), and a hidden page can't ask. This window does: Chrome shows its usual question, naming
 * Soultied. Once it's yes, Soultied never has to ask again, on any show.
 */

const css = `
  @font-face { font-family: 'Soultied Pixel'; src: url('fonts/PixelifySans-Variable.ttf'); font-weight: 400 700; }
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #2b1e1c;
    font-family: 'Soultied Pixel', ui-sans-serif, system-ui, sans-serif; color: #3a2a26; font-variant-ligatures: none; }
  .card { width: min(380px, calc(100vw - 32px)); background: #f4e8d0; padding: 22px 22px 20px;
    box-shadow: 0 -3px 0 0 #120c0b, 0 3px 0 0 #120c0b, -3px 0 0 0 #120c0b, 3px 0 0 0 #120c0b, 6px 6px 0 3px rgba(0,0,0,.4); }
  h1 { margin: 0 0 10px; font-size: 20px; display: flex; gap: 10px; align-items: center; }
  h1 img { width: 24px; height: 24px; image-rendering: pixelated; }
  p { margin: 0 0 12px; font-size: 15px; line-height: 1.35; }
  .muted { color: #7a6558; font-size: 13px; }
  .ok { color: #4f6b3f; }
  .bad { color: #9b3d2b; }
  button { font: inherit; cursor: pointer; border: 0; background: #b8674f; color: #fff4e2; padding: 9px 14px; font-size: 15px;
    box-shadow: 0 -2px 0 0 #2b1e1c, 0 2px 0 0 #2b1e1c, -2px 0 0 0 #2b1e1c, 2px 0 0 0 #2b1e1c; }
  button.paper { background: #fffaf0; color: #3a2a26; }
  .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
`;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

document.title = 'Soultied: camera and mic';
const style = el('style');
style.textContent = css;
document.head.append(style);

const card = el('div', 'card');
const h = el('h1');
const icon = el('img');
icon.src = 'icons/48.png';
icon.alt = '';
h.append(icon, el('span', '', 'Camera and mic'));
const what = el('p', '', 'For your Soultied Plus watch party: so you and your person can see and hear each other.');
const ASKING = 'Chrome is asking now. Press Allow (if it offers “Allow while visiting the site”, pick that one, so it’s only ever asked once).';
const status = el('p', 'muted', ASKING);
const row = el('div', 'row');
card.append(h, what, status, row);
document.body.append(card);

const tell = () => chrome.runtime.sendMessage({ kind: 'mediaAllowed' }).catch(() => undefined);

async function ask() {
  row.replaceChildren();
  status.className = 'muted';
  status.textContent = ASKING;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  } catch (err) {
    const name = (err as { name?: string })?.name || '';
    // no camera on this computer: the mic on its own is fine
    if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        stream = null;
      }
    }
    if (!stream) return void refused(name);
  }
  stream.getTracks().forEach((t) => t.stop());
  status.className = 'ok';
  status.textContent = 'All set. Back to the show: Soultied won’t need to ask again.';
  await tell();
  window.setTimeout(() => window.close(), 1600);
}

async function blocked() {
  try {
    const [cam, mic] = await Promise.all(
      (['camera', 'microphone'] as const).map((n) => navigator.permissions.query({ name: n as PermissionName }).then((p) => p.state)),
    );
    return cam === 'denied' && mic === 'denied' ? 'both' : mic === 'denied' ? 'mic' : cam === 'denied' ? 'cam' : null;
  } catch {
    return null;
  }
}

async function refused(name: string) {
  status.className = 'bad';
  const no = name === 'NotAllowedError' || name === 'SecurityError';
  const isBlocked = no ? await blocked() : null;
  status.textContent = isBlocked
    ? 'Chrome has blocked the camera and mic for Soultied. Press Open settings, set Camera and Microphone to Allow, then come back and press Try again.'
    : no
      ? 'Soultied can’t use your camera and mic yet. Press Try again and choose Allow.'
      : 'Couldn’t reach your camera or mic. If another app is using it, close that app, then try again.';
  const again = el('button', '', 'Try again');
  again.onclick = () => void ask();
  const close = el('button', 'paper', 'Not now');
  close.onclick = () => window.close();
  const buttons: HTMLElement[] = [again];
  if (isBlocked) {
    // Soultied's own page in Chrome's settings, where the block can be lifted
    const open = el('button', 'paper', 'Open settings');
    open.onclick = () =>
      void chrome.tabs.create({ url: `chrome://settings/content/siteDetails?site=${encodeURIComponent(location.origin)}` }).catch(() => undefined);
    buttons.push(open);
  }
  buttons.push(close);
  row.replaceChildren(...buttons);
}

void ask();
