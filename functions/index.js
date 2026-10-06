/**
 * Soultied's small server (Firebase Cloud Functions, in Mumbai).
 *
 *   plusOrder   GET:  Plus's prices          POST {plan: 'month'|'year'}: a Razorpay order to pay
 *   plusCode    POST {orderId, paymentId?, signature?} (or just {paymentId}): the code for a paid order
 *
 * Razorpay's keys are kept in Google's Secret Manager (RAZORPAY_KEY_ID and
 * RAZORPAY_KEY_SECRET); the GitHub Action that deploys this puts them there.
 * Prices are in paise (PLUS_MONTH_PAISE, PLUS_YEAR_PAISE).
 */
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';
import { defineInt, defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { PlusError, plusService, razorpayApi } from './plus.js';

initializeApp();

const KEY_ID = defineSecret('RAZORPAY_KEY_ID');
const KEY_SECRET = defineSecret('RAZORPAY_KEY_SECRET');
const MONTH = defineInt('PLUS_MONTH_PAISE', { default: 14900, description: 'Soultied Plus for a month, in paise' });
const YEAR = defineInt('PLUS_YEAR_PAISE', { default: 119900, description: 'Soultied Plus for a year, in paise' });

/** Only Soultied's own pages (and previews of them) can ask. */
const ORIGINS = ['https://soultied.app', 'https://www.soultied.app', /\.run\.app$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

const OPTS = { region: 'asia-south1', cors: ORIGINS, secrets: [KEY_ID, KEY_SECRET], maxInstances: 5, memory: '256MiB', timeoutSeconds: 30 };

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

function service() {
  const keyId = KEY_ID.value();
  const keySecret = KEY_SECRET.value();
  return plusService({
    razorpay: razorpayApi(keyId, keySecret),
    store,
    prices: { month: paise(MONTH, 14900), year: paise(YEAR, 119900) },
    keyId,
    keySecret,
  });
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
  if (req.method === 'GET') return reply(res, async () => service().prices());
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  return reply(res, () => service().order(String(req.body?.plan || '')));
});

export const plusCode = onRequest(OPTS, (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const b = req.body || {};
  return reply(res, () => service().code({ orderId: String(b.orderId || ''), paymentId: String(b.paymentId || ''), signature: String(b.signature || '') }));
});
