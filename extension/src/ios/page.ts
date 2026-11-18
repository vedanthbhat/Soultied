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
 *   that off. Instead the player's told it's full screen, its box fills the window, and the app turns sideways,
 *   edge to edge, with its bar out of the way (and back upright when you come out of full screen).
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

  // full screen, the app's way (under Soultied's own overlay, which sits at 2147483600)
  let full: Element | null = null;
  const fullStyle = document.createElement('style');
  fullStyle.textContent =
    '[data-soultied-full]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;' +
    'max-width:none!important;max-height:none!important;margin:0!important;transform:none!important;z-index:2147483000!important;background:#000!important}';
  const keepStyle = () => {
    if (!fullStyle.isConnected) (document.head || document.documentElement).append(fullStyle);
  };
  const fullChanged = (el: Element | null) => {
    for (const type of ['fullscreenchange', 'webkitfullscreenchange']) {
      try {
        (el && el.isConnected ? el : document).dispatchEvent(new Event(type, { bubbles: true }));
      } catch {
        // nothing listening that can hear it
      }
    }
  };
  /** the page (its button) or the app (its turn-upright button) puts something full screen, or takes it out */
  const setFull = (el: Element | null, fromPage: boolean) => {
    if (full === el) return;
    const was = full;
    full = el;
    was?.removeAttribute('data-soultied-full');
    // (the page itself already fills the window)
    if (el && el !== document.documentElement && el !== document.body) {
      keepStyle();
      el.setAttribute('data-soultied-full', '');
    }
    fullChanged(el || was);
    if (fromPage) tell({ kind: 'fullscreen', on: !!el });
  };
  (w as unknown as { __soultiedFullscreen?: (on: boolean) => void }).__soultiedFullscreen = (on: boolean) => {
    if (!on) setFull(null, false);
  };
  const put = (o: object, k: string, value: unknown) => {
    try {
      Object.defineProperty(o, k, { configurable: true, writable: true, value });
    } catch {
      // locked by the browser: left as it is
    }
  };
  const reads = (o: object, k: string, get: (this: Element | Document) => unknown) => {
    try {
      Object.defineProperty(o, k, { configurable: true, get });
    } catch {
      // locked by the browser: left as it is
    }
  };
  const enter = function (this: Element) {
    setFull(this, true);
    return Promise.resolve();
  };
  const leave = () => {
    setFull(null, true);
    return Promise.resolve();
  };
  for (const k of ['requestFullscreen', 'webkitRequestFullscreen', 'webkitRequestFullScreen']) put(Element.prototype, k, enter);
  for (const k of ['exitFullscreen', 'webkitExitFullscreen', 'webkitCancelFullScreen']) put(Document.prototype, k, leave);
  // (the video's own full screen, as the iPhone's Safari has it)
  for (const k of ['webkitEnterFullscreen', 'webkitEnterFullScreen'])
    put(HTMLVideoElement.prototype, k, function (this: HTMLVideoElement) {
      setFull(this, true);
    });
  for (const k of ['webkitExitFullscreen', 'webkitExitFullScreen'])
    put(HTMLVideoElement.prototype, k, function (this: HTMLVideoElement) {
      if (full === this) setFull(null, true);
    });
  for (const k of ['fullscreenElement', 'webkitFullscreenElement', 'webkitCurrentFullScreenElement']) reads(Document.prototype, k, () => full);
  for (const k of ['fullscreen', 'webkitIsFullScreen']) reads(Document.prototype, k, () => !!full);
  for (const k of ['fullscreenEnabled', 'webkitFullscreenEnabled']) reads(Document.prototype, k, () => true);
  reads(HTMLVideoElement.prototype, 'webkitSupportsFullscreen', () => true);
  reads(HTMLVideoElement.prototype, 'webkitDisplayingFullscreen', function (this: Element | Document) {
    return full === this;
  });

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
