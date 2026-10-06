# Soultied's server side

Two small Firebase Cloud Functions, in Mumbai (`asia-south1`), for **Soultied Plus**. There are two ways to pay, and both give the same kind of code:

- **In India: Razorpay**, in rupees (UPI, Indian cards, netbanking). The cheapest way to take Indian payments.
- **Anywhere else: Dodo Payments**, in the buyer's own currency. Dodo is the *merchant of record*: it sells Plus on Soultied's behalf and handles VAT, GST and sales tax around the world.

The functions:

- `plusOrder`: `GET` gives the prices (rupees from the settings below, and Dodo's from its products). `POST {plan: "month" | "year"}` makes a Razorpay order; `POST {plan, provider: "dodo"}` makes a Dodo checkout page that sends you back to soultied.app/plus/ with `?payment_id=…`.
- `plusCode`: asks Razorpay (`{orderId, paymentId, signature}`) or Dodo (`{provider: "dodo", paymentId}`) whether the payment went through. If it did, it makes a unique code once and puts it in Firestore under `plusCodes/{sha-256 of the code}`. The same payment always gets the same code back, so a closed tab can't lose it. Just the payment or order number from a receipt works too (that's "Lost your code?" on the page).

The page at **soultied.app/plus/** picks Razorpay or Dodo from where you are (you can switch), runs the checkout and shows the code. The browser extension checks a code against `plusCodes` before it turns cameras and voice on. The Firestore rules decide who can use a code: anyone who has it can add up to three browsers while it's valid, and nobody can list the codes.

`.github/workflows/firebase.yml` deploys these functions and `firestore.rules` whenever they change on `main`. With only one of Razorpay or Dodo set up, the other way to pay shows "opens soon" on the page.

## Switching payments on (once)

1. **Firebase on the Blaze plan.** Firebase console → soultied-c1543 → *Upgrade*. Cloud Functions and Secret Manager need it. At Soultied's size it costs about nothing; set a budget alert anyway.
2. **Razorpay (India).** Create the account and complete KYC (it checks soultied.app for the Terms, Privacy, Refunds and Contact pages). Then *Account & Settings → API Keys* → generate a key. Test-mode keys first if you like.
3. **Dodo Payments (everywhere else).** Sign up at dodopayments.com as an *Individual*, fill in the product form (describe Plus exactly as the Plus page does), do KYC (PAN) and add your bank. In the dashboard:
   - *Products → Create*: "Soultied Plus: 1 month" and "Soultied Plus: 1 year", each a **one-time** payment (not a subscription), priced in USD ($3.99 and $29.99). Copy each product id (`pdt_…`).
   - *Settings*: turn on *Adaptive currency*, so people abroad pay in their own currency.
   - *Developer → API Keys*: create a key.
   - Dodo has separate **test** and **live** modes, each with its own key and products. Start in test mode; when you go live, make the products again in live mode and swap the key and product ids.
4. **A deploy key for GitHub.**
   1. Google Cloud console → IAM & Admin → Service accounts (project soultied-c1543) → *Create service account* (e.g. `github-deploy`).
   2. Give it these roles: *Firebase Admin*, *Cloud Functions Admin*, *Cloud Run Admin*, *Service Account User*, *Secret Manager Admin*, *Service Usage Admin*, *Artifact Registry Administrator* and *Cloud Build Editor*.
   3. Open it → *Keys* → *Add key* → JSON. A file downloads. Keep it private.
5. **GitHub.** In vedanthbhat/Soultied → *Settings → Secrets and variables → Actions*:
   - **Secrets:** `FIREBASE_SERVICE_ACCOUNT` (the whole JSON file), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `DODO_API_KEY`.
   - **Variables:** `DODO_MODE` (`test` or `live`), `DODO_PRODUCT_MONTH` and `DODO_PRODUCT_YEAR` (the `pdt_…` ids). Optional: `PLUS_MONTH_PAISE` (default `14900`, ₹149) and `PLUS_YEAR_PAISE` (default `119900`, ₹1,199).
6. Run *Actions → Deploy to Firebase → Run workflow* (it also runs on any change here). When it's green, soultied.app/plus/ takes payments.

## Testing it

- Razorpay test mode: pay with Razorpay's test cards or UPI `success@razorpay`.
- Dodo test mode: on the Plus page choose *Anywhere else* and pay with Dodo's test card from its docs.

Either way the page shows a real code and the extension accepts it. Codes made in test mode work like any other, so delete them in Firestore (`plusCodes`, `plusOrders`) before going live.

## Refunds

The policy is a full refund within 7 days (soultied.app/refunds). Refund in the Razorpay or Dodo dashboard, then delete that payment's code in Firestore: find its `plusOrders` record (the id is the Razorpay order id, or `dodo_` + the Dodo payment id) and delete the `plusCodes` document named by its `hash`.
