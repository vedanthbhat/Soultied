import { cloud } from './firebase';

/**
 * Notifications on your person's iPhone: when you do something they'd want to know about (seal today's letter,
 * send a hug, make your move…), Soultied's server is told, and it decides whether to tell their phone (their
 * switches in the app, the time where they are, not too often) and what it says (functions/push.js). Only for
 * a place that's online, with your person moved in; never in the demo room.
 */

const ENDPOINT = 'https://asia-south1-soultied-c1543.cloudfunctions.net/pushNote';

export type NudgeKind = 'letter' | 'ask' | 'answer' | 'touch' | 'turn' | 'live' | 'watch' | 'wall' | 'voice' | 'snap' | 'pet';

export function nudge(sid: string | null | undefined, kind: NudgeKind, args: Record<string, string | number | boolean> = {}) {
  const user = sid ? cloud()?.auth.currentUser : null;
  if (!user || !sid) return;
  user
    .getIdToken()
    .then((token) =>
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ sid, kind, args }),
        // (it still goes if the tab's closing)
        keepalive: true,
      })
    )
    .catch(() => undefined);
}
