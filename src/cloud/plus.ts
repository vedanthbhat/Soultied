import type { Timestamp } from 'firebase/firestore';
import type { CloudDb } from './firebase';
import { plusCodeKey, type PlusReply } from '../stream/protocol';

/**
 * Soultied Plus for a place: cameras and voice for both of you, here and through the extension.
 *
 * A Plus code (bought on soultied.app/plus) is checked against Soultied's list, this account is added to
 * the browsers using it (up to three), and the place gets the code and its end date. The security rules
 * check all of that again, so a place can't claim Plus it doesn't have.
 */

interface PlusCodeDoc {
  validUntil: Timestamp;
  activations?: string[];
}

/** A code the Plus page kept in this browser (soultied.app's own storage), still running. */
export interface SavedPlusCode {
  code: string;
  plan?: string;
  validUntil: number;
}

async function sha256(text: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Add a code to the place (a place that already has Plus for longer keeps what it has). */
export async function redeemForPlace(cdb: CloudDb, sid: string, uid: string, code: string, currentUntil = 0): Promise<PlusReply> {
  const key = plusCodeKey(code);
  if (key.length < 8) return { ok: false, error: 'invalid' };
  try {
    const hash = await sha256(key);
    const [{ doc, getDoc, updateDoc }, db] = await Promise.all([import('firebase/firestore'), cdb.get()]);
    const ref = doc(db, 'plusCodes', hash);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { ok: false, error: 'invalid' };
    const d = snap.data() as PlusCodeDoc;
    const until = d.validUntil?.toMillis?.() ?? 0;
    if (until <= Date.now()) return { ok: false, error: 'expired' };
    // (the place already has Plus for at least as long: nothing to add, and no browser slot used up)
    if (currentUntil >= until) return { ok: true, until: currentUntil };
    const acts = Array.isArray(d.activations) ? d.activations : [];
    if (!acts.includes(uid)) {
      if (acts.length >= 3) return { ok: false, error: 'full' };
      await updateDoc(ref, { activations: [...acts, uid] });
    }
    await updateDoc(doc(db, 'spaces', sid), { plus: { by: uid, code: hash, until: d.validUntil } });
    return { ok: true, until };
  } catch (e) {
    console.warn('[soultied] plus', e);
    return { ok: false, error: navigator.onLine === false ? 'offline' : 'failed' };
  }
}

/** Codes bought on the Plus page in this browser that still have time left (newest first). */
export function savedPlusCodes(): SavedPlusCode[] {
  try {
    const list = JSON.parse(localStorage.getItem('soultied_plus_codes') || '[]') as SavedPlusCode[];
    return (Array.isArray(list) ? list : []).filter((c) => c && typeof c.code === 'string' && Number(c.validUntil) > Date.now());
  } catch {
    return [];
  }
}

/** What adding a code said, in words. */
export function plusError(error: Exclude<PlusReply, { ok: true }>['error']) {
  switch (error) {
    case 'invalid':
      return 'That code doesn’t look right. Check it and try again.';
    case 'expired':
      return 'That code’s time is up. Get a new one on the Plus page.';
    case 'full':
      return 'That code is already used on three browsers.';
    case 'offline':
      return 'Couldn’t reach Soultied. Check your connection and try again.';
    default:
      return 'That didn’t work. Try again in a moment.';
  }
}
