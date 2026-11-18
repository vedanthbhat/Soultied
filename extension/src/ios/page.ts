/**
 * Runs first in the page itself (the page's own script world) in the Soultied iPhone app's Netflix / Prime
 * Video browser, before the site's code:
 *
 * - Netflix and Prime Video's web players feed the video through Media Source Extensions, which the iPhone
 *   has as ManagedMediaSource (iOS 17.1+) under its own name. Give it the usual name too, and switch off
 *   AirPlay on the video before a source is attached (ManagedMediaSource asks for that, or an AirPlay
 *   alternative).
 * - Tell the app what this phone offers and how the video's doing (window.webkit.messageHandlers.soultiedPage),
 *   so it can say plainly when a site won't play here.
 * - Answer the players' full-screen button. On the iPhone it would hand the video to a full-screen window of
 *   WebKit's own, which goes black with these players and fights the app turning sideways, so the app switches
 *   that off. Instead the button turns the app sideways, edge to edge, with its bar out of the way, and pressed
 *   again turns it back upright. The page itself isn't touched.
 */
type W = Window & {
  ManagedMediaSource?: typeof MediaSource;
  ManagedSourceBuffer?: typeof SourceBuffer;
  MediaSource?: typeof MediaSource;
  WebKitMediaKeys?: unknown;
  webkit?: { messageHandlers?: Record<string, { postMessage(m: unknown): void }> };
  __soultiedPage?: boolean;
};
const w = window as W;

if (!w.__soultiedPage) {
  w.__soultiedPage = true;
  const nativeMse = typeof w.MediaSource === 'function';
  const managed = typeof w.ManagedMediaSource === 'function';
  if (!nativeMse && managed) {
    try {
      Object.defineProperty(w, 'MediaSource', { value: w.ManagedMediaSource, configurable: true, writable: true });
      if (w.ManagedSourceBuffer && typeof (w as unknown as { SourceBuffer?: unknown }).SourceBuffer !== 'function')
        Object.defineProperty(w, 'SourceBuffer', { value: w.ManagedSourceBuffer, configurable: true, writable: true });
    } catch {
      // a site that locked its globals: it'll say it can't play, and the app says why
    }
    // (AirPlay off before a managed source goes on the video)
    const proto = HTMLMediaElement.prototype;
    for (const prop of ['src', 'srcObject'] as const) {
      const d = Object.getOwnPropertyDescriptor(proto, prop);
      if (!d?.set || !d.get) continue;
      const set = d.set;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: d.enumerable,
        get: d.get,
        set(this: HTMLMediaElement, v: unknown) {
          try {
            if (!this.disableRemotePlayback) this.disableRemotePlayback = true;
          } catch {
            // older WebKit: nothing to switch off
          }
          set.call(this, v);
        },
      });
    }
  }

  const tell = (m: Record<string, unknown>) => {
    try {
      w.webkit?.messageHandlers?.soultiedPage?.postMessage(m);
    } catch {
      // the app's closing
    }
  };

  // The players' full-screen button turns the app sideways, edge to edge (or back upright), and that's all: the
  // page itself is left exactly as it is, and the player's never told it went full screen. Anything that moves
  // the picture into a new layer (WebKit's own full screen, or restyling the player's box to fill the window)
  // turns these protected pictures black while the sound and subtitles carry on.
  const put = (o: object, k: string, value: unknown) => {
    try {
      Object.defineProperty(o, k, { configurable: true, writable: true, value });
    } catch {
      // locked by the browser: left as it is
    }
  };
  const reads = (o: object, k: string, get: () => unknown) => {
    try {
      Object.defineProperty(o, k, { configurable: true, get });
    } catch {
      // locked by the browser: left as it is
    }
  };
  /** the button: sideways if upright, upright if sideways (the app decides which) */
  const flip = () => {
    tell({ kind: 'fullscreen', toggle: true });
    return Promise.resolve();
  };
  const upright = () => {
    tell({ kind: 'fullscreen', on: false });
    return Promise.resolve();
  };
  for (const k of ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen']) put(Element.prototype, k, flip);
  for (const k of ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen']) put(Document.prototype, k, upright);
  // (the video's own full screen, as the iPhone's Safari has it)
  for (const k of ['webkitEnterFullscreen', 'webkitEnterFullScreen']) put(HTMLVideoElement.prototype, k, flip);
  for (const k of ['webkitExitFullscreen', 'webkitExitFullScreen']) put(HTMLVideoElement.prototype, k, upright);
  // the button's there to press, and nothing's ever full screen
  for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) reads(Document.prototype, k, () => true);
  for (const k of ['fullscreenElement', 'webkitFullscreenElement', 'webkitCurrentFullScreenElement']) reads(Document.prototype, k, () => null);
  for (const k of ['fullscreen', 'webkitIsFullScreen']) reads(Document.prototype, k, () => false);
  reads(HTMLVideoElement.prototype, 'webkitSupportsFullscreen', () => true);
  reads(HTMLVideoElement.prototype, 'webkitDisplayingFullscreen', () => false);

  // what this phone offers the site
  const eme = typeof navigator.requestMediaKeySystemAccess === 'function';
  const probe = async () => {
    let fps: string = 'none';
    if (eme) {
      try {
        await navigator.requestMediaKeySystemAccess('com.apple.fps', [
          { initDataTypes: ['sinf', 'skd', 'cenc'], videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.640028"' }] },
        ]);
        fps = 'ok';
      } catch (e) {
        fps = (e as Error)?.name || 'no';
      }
    }
    tell({ kind: 'offers', mse: nativeMse, managed, eme, fps, legacyKeys: typeof w.WebKitMediaKeys === 'function' });
  };
  void probe();

  // how the video's doing (once a second, and when it errors)
  let last = '';
  window.setInterval(() => {
    const vids = Array.from(document.querySelectorAll('video'));
    const v = vids.find((x) => x.readyState > 0) || vids[0];
    const now = v
      ? { kind: 'video', at: Math.round(v.currentTime), paused: v.paused, ready: v.readyState, error: v.error?.code ?? 0, w: v.videoWidth }
      : { kind: 'video', none: true };
    const s = JSON.stringify(now);
    if (s === last) return;
    last = s;
    tell(now);
  }, 1000);
  document.addEventListener(
    'error',
    (ev) => {
      const t = ev.target;
      if (t instanceof HTMLVideoElement) tell({ kind: 'videoError', code: t.error?.code ?? 0, message: t.error?.message ?? '' });
    },
    true,
  );
}

export {};
