/**
 * Soultied Plus: what happens between "Pay" and "here's your code".
 *
 * 1. order(plan): ask Razorpay for an order at Plus's price (the price is set
 *    here, on the server, never by the page).
 * 2. The page opens Razorpay's checkout for that order; you pay.
 * 3. code(orderId, or the payment's id): ask Razorpay whether that order is paid. If it is, make a
 *    unique code once (asking again for the same order gives the same code),
 *    and put it in Soultied's list: plusCodes/{sha-256 of the code}. The
 *    extension checks a code against that list before it turns cameras on.
 *
 * Kept free of Firebase and Razorpay themselves (they're passed in), so it can
 * be tested on its own.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** 32 letters and digits that can't be mistaken for each other (no 0/O, 1/I). */
export const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export const PLANS = {
  month: { days: 30, label: '1 month' },
  year: { days: 365, label: '1 year' },
};

const DAY = 24 * 60 * 60 * 1000;

/** A new code: 12 random letters (60 bits), shown as XXXX-XXXX-XXXX. */
export function makeCode(bytes = randomBytes(12)) {
  let s = '';
  for (let i = 0; i < 12; i++) s += ALPHABET[bytes[i] & 31];
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** The letters that matter, however it was typed (same as plusCodeKey in src/stream/protocol.ts). */
export const codeKey = (code) => String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');

/** Where a code lives in Soultied's list: the code itself is never stored there. */
export const codeHash = (code) => createHash('sha256').update(codeKey(code)).digest('hex');

/** Razorpay's proof that a payment went through for an order (sent to the page after checkout). */
export function signatureOk(orderId, paymentId, signature, secret) {
  if (!orderId || !paymentId || !signature || !secret) return false;
  const want = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(want);
  const b = Buffer.from(String(signature));
  return a.length === b.length && timingSafeEqual(a, b);
}

export class PlusError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

const ORDER_ID = /^order_[A-Za-z0-9]{6,40}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{6,40}$/;

/**
 * @param {object} deps
 * @param {{ createOrder(b: object): Promise<any>, getOrder(id: string): Promise<any>, getPayment(id: string): Promise<any>, capture(id: string, amount: number, currency: string): Promise<any> }} deps.razorpay
 * @param {{ claim(orderId: string, mint: () => object): Promise<object> }} deps.store  makes the code once per order
 * @param {{ month: number, year: number }} deps.prices  in paise
 * @param {string} deps.keyId  Razorpay's public key id (the checkout needs it)
 * @param {string} deps.keySecret  for checking checkout signatures
 * @param {() => number} [deps.now]
 */
export function plusService({ razorpay, store, prices, keyId, keySecret, now = Date.now, random = randomBytes }) {
  return {
    prices() {
      return { currency: 'INR', month: prices.month, year: prices.year };
    },

    /** A Razorpay order for one plan, for the checkout to pay. */
    async order(plan) {
      if (!PLANS[plan]) throw new PlusError(400, 'plan', 'Pick a month or a year.');
      const amount = plan === 'year' ? prices.year : prices.month;
      const o = await razorpay.createOrder({
        amount,
        currency: 'INR',
        receipt: `plus-${plan}-${now()}`,
        notes: { product: 'soultied-plus', plan },
      });
      return { orderId: o.id, amount: o.amount, currency: o.currency, keyId, plan, label: PLANS[plan].label };
    },

    /** The code for a paid order (made the first time it's asked for). */
    async code({ orderId, paymentId, signature }) {
      if (!orderId && PAYMENT_ID.test(String(paymentId || ''))) {
        // only the payment number (it's on Razorpay's receipt): find its order; it has to be paid already
        let p;
        try {
          p = await razorpay.getPayment(paymentId);
        } catch (err) {
          if (err?.status === 400 || err?.status === 404) throw new PlusError(404, 'order', 'That isn’t a Soultied Plus payment.');
          throw err;
        }
        orderId = p?.order_id || '';
        signature = '';
      }
      if (!ORDER_ID.test(String(orderId || ''))) throw new PlusError(400, 'order', 'That isn’t a Soultied Plus order.');
      let order;
      try {
        order = await razorpay.getOrder(orderId);
      } catch (err) {
        if (err?.status === 400 || err?.status === 404) throw new PlusError(404, 'order', 'That isn’t a Soultied Plus order.');
        throw err;
      }
      if (order?.notes?.product !== 'soultied-plus') throw new PlusError(404, 'order', 'That isn’t a Soultied Plus order.');
      const plan = PLANS[order.notes.plan] ? order.notes.plan : 'month';

      let paid = order.status === 'paid';
      // Just paid: checkout's signature says so. If the payment is only authorised (not captured yet), capture it now.
      if (!paid && PAYMENT_ID.test(String(paymentId || '')) && signatureOk(orderId, paymentId, signature, keySecret)) {
        const p = await razorpay.getPayment(paymentId);
        if (p?.order_id === orderId) {
          if (p.status === 'captured') paid = true;
          else if (p.status === 'authorized') {
            await razorpay.capture(paymentId, p.amount, p.currency);
            paid = true;
          }
        }
      }
      if (!paid) throw new PlusError(402, 'unpaid', 'That payment hasn’t gone through yet.');

      const made = await store.claim(orderId, () => {
        const code = makeCode(random(12));
        return {
          code,
          hash: codeHash(code),
          plan,
          days: PLANS[plan].days,
          validUntil: now() + PLANS[plan].days * DAY,
          paymentId: PAYMENT_ID.test(String(paymentId || '')) ? paymentId : null,
        };
      });
      return { code: made.code, plan: made.plan, validUntil: made.validUntil };
    },
  };
}

/** Razorpay's API, with your key. */
export function razorpayApi(keyId, keySecret, fetchImpl = fetch) {
  const auth = 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  async function call(method, path, body) {
    const r = await fetchImpl(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const e = new Error(j?.error?.description || `Razorpay said ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return j;
  }
  return {
    createOrder: (b) => call('POST', '/orders', b),
    getOrder: (id) => call('GET', `/orders/${encodeURIComponent(id)}`),
    getPayment: (id) => call('GET', `/payments/${encodeURIComponent(id)}`),
    capture: (id, amount, currency) => call('POST', `/payments/${encodeURIComponent(id)}/capture`, { amount, currency }),
  };
}
