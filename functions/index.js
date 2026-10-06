/**
 * Soultied's small server (Firebase Cloud Functions, in Mumbai).
 *
 *   plusOrder   GET:  Plus's prices (in rupees, and from anywhere else)
 *               POST {plan: 'month'|'year'}: a Razorpay order to pay (India, in rupees)
 *               POST {plan, provider: 'dodo'}: a Dodo Payments checkout page (anywhere else)
 *   plusCode    POST {orderId, paymentId?, signature?} (or just {paymentId}),
 *               or {provider: 'dodo', paymentId}: the code for a paid order
 *
 * Keys live in Google's Secret Manager (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and
 * DODO_API_KEY); the GitHub Action that deploys this puts them there ("unset" for a
 * way to pay that isn't set up yet). Rupee prices are in paise (PLUS_MONTH_PAISE,
 * PLUS_YEAR_PAISE); Dodo's prices are the ones on its products (DODO_PRODUCT_MONTH,
 * DODO_PRODUCT_YEAR), in DODO_MODE 'test' or 'live'.
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineInt, defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { dodoApi, PlusError, plusService, razorpayApi } from './plus.js';

initializeApp();

const KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const MONTH = defineInt('PLUS_MONTH_PAISE', { default: 14900, description: 'Soultied Plus for a month, in paise' });
const YEAR = defineInt('PLUS_YEAR_PAISE', { default: 119900, description: 'Soultied Plus for a year, in paise' });
const DODO_KEY = defineSecret('DODO_API_KEY');
const DODO_MODE = defineString('DODO_MODE', { default: 'test', description: "Dodo Payments: 'test' or 'live'" });
const DODO_MONTH = defineString('DODO_PRODUCT_MONTH', { default: 'unset', description: 'Dodo product id (pdt_…) for a month of Plus' });
const DODO_YEAR = defineString('DODO_PRODUCT_YEAR', { default: 'unset', description: 'Dodo product id (pdt_…) for a year of Plus' });

/** Only Soultied's own pages (and previews of them) can ask. */
const ORIGINS = ['https://soultied.app', 'https://www.soultied.app', /\.run\.app$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

const OPTS = { region: 'asia-south1', cors: ORIGINS, secrets: [KEY_ID, KEY_SECRET, DODO_KEY], maxInstances: 5, memory: '256MiB', timeoutSeconds: 30 };

/** where Dodo's checkout sends you back to: the Plus page you came from (only Soultied's own) */
const PLUS_PAGE = 'https://soultied.app/plus/';
function plusPage(req) {
  const o = String(req.get('origin') || '');
  return ORIGINS.some((x) => (typeof x === 'string' ? x === o : x.test(o))) && /^https?:\/\/[^/]+$/.test(o) ? `${o}/plus/` : PLUS_PAGE;
}

/** Makes each order's code once, in one go: the order's record and the code in Soultied's list. */
const store = {
  async claim(orderId, mint) {
    const db = getFirestore();
    const orderRef = db.collection('plusOrders').doc(orderId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (snap.exists) {
        const d = snap.data();
        return { code: d.code, plan: d.plan, validUntil: d.validUntil.toMillis() };
      }
      const m = mint();
      const until = Timestamp.fromMillis(m.validUntil);
      tx.create(db.collection('plusCodes').doc(m.hash), {
        plan: m.plan,
        days: m.days,
        validUntil: until,
        activations: [],
        orderId,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.create(orderRef, {
        code: m.code,
        hash: m.hash,
        plan: m.plan,
        validUntil: until,
        paymentId: m.paymentId,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { code: m.code, plan: m.plan, validUntil: m.validUntil };
    });
  },
};

/** A price setting, or Plus's usual price if it isn't set (at least ₹1). */
function paise(param, usual) {
  const v = Number(param.value());
  return Number.isInteger(v) && v >= 100 ? v : usual;
}

/** a key that's really there (the deploy puts "unset" for a way to pay that isn't set up yet) */
const real = (v) => {
  const t = String(v || '').trim();
  return t && t.toLowerCase() !== 'unset' ? t : '';
};

/** Dodo's product prices change rarely: ask again every ten minutes. */
let pricesCache = { at: 0, value: null };

function service() {
  const keyId = real(KEY_ID.value());
  const keySecret = real(KEY_SECRET.value());
  const dodoKey = real(DODO_KEY.value());
  return plusService({
    razorpay: keyId && keySecret ? razorpayApi(keyId, keySecret) : null,
    dodo: dodoKey ? dodoApi(dodoKey, DODO_MODE.value() === 'live' ? 'live' : 'test') : null,
    dodoProducts: { month: real(DODO_MONTH.value()), year: real(DODO_YEAR.value()) },
    store,
    prices: { month: paise(MONTH, 14900), year: paise(YEAR, 119900) },
    keyId,
    keySecret,
  });
}

async function prices() {
  if (pricesCache.value && Date.now() - pricesCache.at < 10 * 60 * 1000) return pricesCache.value;
  const value = await service().prices();
  pricesCache = { at: Date.now(), value };
  return value;
}

function reply(res, work) {
  return work().then(
    (body) => res.json(body),
    (err) => {
      if (err instanceof PlusError) return res.status(err.status).json({ error: err.code, message: err.message });
      logger.error('Soultied Plus', err);
      return res.status(502).json({ error: 'failed', message: 'Something went wrong on our side. Try again in a moment.' });
    },
  );
}

export const plusOrder = onRequest(OPTS, (req, res) => {
  if (req.method === 'GET') return reply(res, prices);
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const plan = String(req.body?.plan || '');
  if (req.body?.provider === 'dodo') return reply(res, () => service().dodoCheckout(plan, plusPage(req)));
  return reply(res, () => service().order(plan));
});

export const plusCode = onRequest(OPTS, (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = req.body || {};
  return reply(res, () =>
    service().code({
      provider: b.provider === 'dodo' ? 'dodo' : 'razorpay',
      orderId: String(b.orderId || ''),
      paymentId: String(b.paymentId || ''),
      signature: String(b.signature || ''),
    }),
  );
});
