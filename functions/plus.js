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
 * Two ways to pay, one kind of code:
 *   - Razorpay, in rupees (UPI, Indian cards): steps 1 to 3 above.
 *   - Dodo Payments, from anywhere else, in the buyer's own currency (Dodo is the
 *     seller of record, so it handles their sales taxes): dodoCheckout(plan) gives a
 *     Dodo checkout page; it sends you back to soultied.app/plus/ with a payment id,
 *     and code({provider: 'dodo', paymentId}) checks it with Dodo the same way.
 *
 * Kept free of Firebase, Razorpay and Dodo themselves (they're passed in), so it can
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
export function plusService({ razorpay, dodo = null, dodoProducts = {}, store, prices, keyId, keySecret, now = Date.now, random = randomBytes }) {
  /** a code for a paid order, made once (the same order always gets the same code) */
  const claim = (orderId, plan, paymentId) =>
    store
      .claim(orderId, () => {
        const code = makeCode(random(12));
        return {
          code,
          hash: codeHash(code),
          plan,
          days: PLANS[plan].days,
          validUntil: now() + PLANS[plan].days * DAY,
          paymentId: PAYMENT_ID.test(String(paymentId || '')) ? paymentId : null,
        };
      })
      .then((made) => ({ code: made.code, plan: made.plan, validUntil: made.validUntil }));

  /** which plan a Dodo product is (null: not one of Plus's) */
  const dodoPlan = (productId) => (productId && productId === dodoProducts.month ? 'month' : productId && productId === dodoProducts.year ? 'year' : null);

  /** The code for a Dodo payment: it has to be for a Plus product, and have gone through. */
  async function dodoCode(paymentId) {
    if (!dodo) throw new PlusError(404, 'order', 'That isn’t a Soultied Plus payment.');
    if (!PAYMENT_ID.test(String(paymentId || ''))) throw new PlusError(400, 'order', 'That isn’t a Soultied Plus payment.');
    let p;
    try {
      p = await dodo.getPayment(paymentId);
    } catch (err) {
      if (err?.status === 400 || err?.status === 404) throw new PlusError(404, 'order', 'That isn’t a Soultied Plus payment.');
      throw err;
    }
    const plan = (p?.product_cart || []).map((x) => dodoPlan(x?.product_id)).find(Boolean);
    if (!plan) throw new PlusError(404, 'order', 'That isn’t a Soultied Plus payment.');
    if (p.status === 'failed' || p.status === 'cancelled') throw new PlusError(409, 'failed', 'That payment didn’t go through, so you haven’t been charged. Try again.');
    if (p.status !== 'succeeded') throw new PlusError(402, 'unpaid', 'That payment hasn’t gone through yet.');
    return claim(`dodo_${paymentId}`, plan, paymentId);
  }

  return {
    /** what Plus costs: in rupees (Razorpay) and, from anywhere else, in Dodo's currency; null where that way to pay isn't set up */
    async prices() {
      const inr = razorpay ? { currency: 'INR', month: prices.month, year: prices.year } : null;
      let intl = null;
      if (dodo && dodoProducts.month && dodoProducts.year) {
        try {
          const [m, y] = await Promise.all([dodo.getProduct(dodoProducts.month), dodo.getProduct(dodoProducts.year)]);
          const mp = m?.price?.price;
          const yp = y?.price?.price;
          if (Number.isFinite(mp) && Number.isFinite(yp)) intl = { currency: m.price.currency || 'USD', month: mp, year: yp };
        } catch (err) {
          // a wrong product id or key: paying from outside India stays closed until it's fixed
          console.error('Soultied Plus: Dodo products', err?.message || err);
        }
      }
      // the older shape too (month, year in paise), for pages from before Dodo
      return { currency: 'INR', month: prices.month, year: prices.year, inr, intl };
    },

    /** A Dodo checkout page for one plan (from outside India). It comes back to returnUrl with ?payment_id=…&status=… */
    async dodoCheckout(plan, returnUrl) {
      if (!PLANS[plan]) throw new PlusError(400, 'plan', 'Pick a month or a year.');
      const productId = dodoProducts[plan];
      if (!dodo || !productId) throw new PlusError(404, 'closed', 'Paying from outside India isn’t open just yet.');
      const s = await dodo.createCheckout({
        product_cart: [{ product_id: productId, quantity: 1 }],
        return_url: returnUrl,
        metadata: { product: 'soultied-plus', plan },
      });
      if (!s?.checkout_url) throw new Error('Dodo gave no checkout page');
      return { url: s.checkout_url, plan, label: PLANS[plan].label };
    },

    /** A Razorpay order for one plan, for the checkout to pay. */
    async order(plan) {
      if (!PLANS[plan]) throw new PlusError(400, 'plan', 'Pick a month or a year.');
      if (!razorpay) throw new PlusError(404, 'closed', 'Paying in rupees isn’t open just yet.');
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
    async code({ provider, orderId, paymentId, signature }) {
      if (provider === 'dodo') return dodoCode(paymentId);
      if (!orderId && PAYMENT_ID.test(String(paymentId || ''))) {
        // only the payment number (it's on the receipt): Razorpay's or Dodo's. Razorpay's has to be paid already.
        let p = null;
        if (razorpay) {
          try {
            p = await razorpay.getPayment(paymentId);
          } catch (err) {
            if (err?.status !== 400 && err?.status !== 404) throw err;
          }
        }
        if (!p?.order_id) {
          if (dodo) return dodoCode(paymentId);
          throw new PlusError(404, 'order', 'That isn’t a Soultied Plus payment.');
        }
        orderId = p.order_id;
        signature = '';
      }
      if (!razorpay) throw new PlusError(404, 'order', 'That isn’t a Soultied Plus order.');
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

      return claim(orderId, plan, paymentId);
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

/** Dodo Payments' API, with your key ('test' or 'live' mode: each has its own keys and products). */
export function dodoApi(apiKey, mode = 'test', fetchImpl = fetch) {
  const base = mode === 'live' ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com';
  async function call(method, path, body) {
    const r = await fetchImpl(base + path, {
      method,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) {
      const e = new Error(j?.message || j?.error?.message || `Dodo said ${r.status}`);
      e.status = r.status;
      throw e;
    }
    return j;
  }
  return {
    createCheckout: (b) => call('POST', '/checkouts', b),
    getPayment: (id) => call('GET', `/payments/${encodeURIComponent(id)}`),
    getProduct: (id) => call('GET', `/products/${encodeURIComponent(id)}`),
  };
}
