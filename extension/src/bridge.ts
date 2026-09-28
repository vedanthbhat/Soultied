import { EXT_SOURCE, HUB_SOURCE, type BridgeBody, type ExtMsg, type PageToBridge } from '../../src/stream/protocol';

/**
 * Runs on the Soultied page. It stays silent until the page says it's
 * Soultied (so it does nothing on any other site it happens to match), then
 * passes messages between the page and the extension.
 */

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
});

post({ kind: 'present', version });
