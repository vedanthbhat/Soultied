/**
 * Soultied Plus bought in the iPhone app (an App Store subscription), checked here before a place gets it.
 *
 * The app sends the transaction Apple signed for it (a JWS). Apple signs with a certificate chain that ends
 * in Apple Root CA - G3, so this checks: the chain's root is that one (by its SHA-256 fingerprint, as Apple
 * publishes it), each certificate is signed by the next and was valid when Apple signed, the leaf and the
 * intermediate are the kind Apple uses for the App Store (their marker extensions), and the leaf signed
 * this JWS (ES256). The same check reads App Store Server Notifications.
 *
 * Kept free of Firebase, so it can be tested on its own.
 */
import { X509Certificate, createHash, verify } from 'node:crypto';

/** Apple Root CA - G3's SHA-256 fingerprint (support.apple.com's list of root certificates) */
export const APPLE_ROOT_G3 = '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179';

/** what Soultied sells in the app */
export const APPLE = {
  bundleId: 'app.soultied',
  products: { 'app.soultied.plus.month': 'month', 'app.soultied.plus.year': 'year' },
};

/** Apple's marker extensions: the App Store receipt-signing leaf, and Apple's WWDR intermediate (DER-encoded OIDs) */
const OID_LEAF = Buffer.from('060a2a864886f76364060b01', 'hex'); // 1.2.840.113635.100.6.11.1
const OID_INTERMEDIATE = Buffer.from('060a2a864886f76364060201', 'hex'); // 1.2.840.113635.100.6.2.1

export class AppleError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

const part = (s) => {
  try {
    return JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
  } catch {
    throw new AppleError('format');
  }
};

/**
 * The payload of a JWS Apple signed, once it's checked (throws AppleError if anything's off).
 * `root` is the fingerprint the chain must end in (the tests use their own).
 */
export function verifyAppleJws(jws, { root = APPLE_ROOT_G3, markers = true } = {}) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3) throw new AppleError('format');
  const header = part(parts[0]);
  if (header.alg !== 'ES256' || !Array.isArray(header.x5c) || header.x5c.length < 3) throw new AppleError('header');
  let certs;
  try {
    certs = header.x5c.slice(0, 3).map((c) => new X509Certificate(Buffer.from(String(c), 'base64')));
  } catch {
    throw new AppleError('certificate');
  }
  const [leaf, middle, top] = certs;
  if (top.fingerprint256.replace(/:/g, '').toUpperCase() !== root.toUpperCase()) throw new AppleError('root');
  if (!middle.verify(top.publicKey) || !leaf.verify(middle.publicKey)) throw new AppleError('chain');
  if (markers && (!leaf.raw.includes(OID_LEAF) || !middle.raw.includes(OID_INTERMEDIATE))) throw new AppleError('marker');
  const ok = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(parts[2], 'base64url'));
  if (!ok) throw new AppleError('signature');
  const payload = part(parts[1]);
  // valid when Apple signed it (Apple's own library checks the same date)
  const at = Number(payload.signedDate) || Date.now();
  for (const c of certs) {
    if (at < Date.parse(c.validFrom) || at > Date.parse(c.validTo)) throw new AppleError('expired-certificate');
  }
  return payload;
}

/**
 * The UUID the app tags each purchase with (StoreKit's appAccountToken), from the Soultied account's id:
 * the first 16 bytes of its SHA-256, marked as a version 5 UUID. native/Soultied/Plus.swift makes the same one.
 */
export function accountToken(uid) {
  const h = createHash('sha256').update(String(uid), 'utf8').digest().subarray(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

/** A checked transaction that gives Plus: which plan, until when, and its numbers. */
export function checkTransaction(tx, { uid, now = Date.now() } = {}) {
  if (!tx || tx.bundleId !== APPLE.bundleId) throw new AppleError('bundle');
  const plan = APPLE.products[tx.productId];
  if (!plan) throw new AppleError('product');
  if (tx.revocationDate) throw new AppleError('refunded', 402);
  const expires = Number(tx.expiresDate) || 0;
  if (expires <= now) throw new AppleError('expired', 402);
  if (uid && tx.appAccountToken && String(tx.appAccountToken).toLowerCase() !== accountToken(uid)) throw new AppleError('account', 403);
  return {
    plan,
    expires,
    originalTransactionId: String(tx.originalTransactionId || tx.transactionId || ''),
    transactionId: String(tx.transactionId || ''),
    environment: tx.environment === 'Sandbox' ? 'Sandbox' : 'Production',
  };
}
