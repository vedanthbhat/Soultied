import { EXT_SOURCE, HUB_SOURCE, type BridgeBody, type ExtMsg, type PageToBridge, type PartyReply, type PlusReply } from '../../src/stream/protocol';

/**
 * Runs on the Soultied page. It stays silent until the page says it's
 * Soultied (so it does nothing on any other site it happens to match), then
 * passes messages between the page and the extension. The watch-party join
 * page uses it too, to hand a party link to the extension.
 */

const w = window as unknown as { __soultiedBridge?: () => boolean };
let running = false;
try {
  // after the extension updates it puts this into pages that were already open; a copy from before is cut off
  running = !!w.__soultiedBridge?.();
} catch {
  running = false;
}
if (!running) {
  w.__soultiedBridge = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };
  start();
}

function start() {
  const version = chrome.runtime.getManifest().version;
  let port: chrome.runtime.Port | null = null;
  let isHub = false;

  const post = (m: BridgeBody) => window.postMessage({ source: EXT_SOURCE, ...m }, location.origin);

  function connect() {
    try {
      port = chrome.runtime.connect({ name: 'hub' });
    } catch {
      // the extension was updated or removed: this page needs a reload to reconnect
      port = null;
      return;
    }
    port.onMessage.addListener((msg: ExtMsg) => post({ kind: 'msg', msg }));
    port.onDisconnect.addListener(() => {
      port = null;
      if (isHub) window.setTimeout(connect, 1000);
    });
  }

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const d = ev.data as PageToBridge | undefined;
    if (!d || d.source !== HUB_SOURCE) return;
    if (d.kind === 'probe') post({ kind: 'present', version });
    else if (d.kind === 'hub') {
      if (!isHub) {
        isHub = true;
        connect();
      }
    } else if (d.kind === 'msg') port?.postMessage(d.msg);
    else if (d.kind === 'party') {
      const rid = d.rid;
      const failed: PartyReply = { ok: false, error: 'failed' };
      chrome.runtime.sendMessage({ kind: 'party', req: d.req }).then(
        (res: PartyReply | undefined) => post({ kind: 'party', rid, res: res || failed }),
        () => post({ kind: 'party', rid, res: failed }),
      );
    } else if (d.kind === 'plus') {
      // the Plus page, handing over the code you just bought
      const rid = d.rid;
      const failed: PlusReply = { ok: false, error: 'failed' };
      chrome.runtime.sendMessage({ kind: 'plusCode', code: String(d.code || '').slice(0, 40) }).then(
        (res: PlusReply | undefined) => post({ kind: 'plus', rid, res: res || failed }),
        () => post({ kind: 'plus', rid, res: failed }),
      );
    }
  });

  // say hello even if the page asked before we got here (we're put into pages that were already open)
  post({ kind: 'present', version });
}
