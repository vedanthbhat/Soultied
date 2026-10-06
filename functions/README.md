# Soultied's server side

Two small Firebase Cloud Functions, in Mumbai (`asia-south1`), for **Soultied Plus**:

- `plusOrder`: `GET` gives the prices; `POST {plan: "month" | "year"}` makes a Razorpay order at that price.
- `plusCode`: `POST {orderId, paymentId, signature}` (or just the order's or payment's number, from the receipt) asks Razorpay whether the order is paid. If it is, it makes a unique code once and puts it in Firestore under `plusCodes/{sha-256 of the code}`. The same order always gets the same code back, so a closed tab can't lose it.

The page at **soultied.app/plus/** runs the checkout and shows the code. The browser extension checks a code against `plusCodes` before it turns cameras and voice on. The Firestore rules decide who can use a code: anyone who has it can add up to three browsers while it's valid, and nobody can list the codes.

`.github/workflows/firebase.yml` deploys these functions and `firestore.rules` whenever they change on `main`.

## Switching payments on (once)

1. **Firebase on the Blaze plan.** Go to Firebase console → soultied-c1543 → *Upgrade*. Cloud Functions and Secret Manager need it. At Soultied's size it costs about nothing, and you can set a budget alert.
2. **Razorpay.** Create the account, complete KYC, then open *Account & Settings → API Keys* and generate a key. Start with *Test mode* keys if you like; switch to *Live* keys when you're ready.
3. **A deploy key for GitHub.**
   1. Go to Google Cloud console → IAM & Admin → Service accounts (project soultied-c1543) → *Create service account* (e.g. `github-deploy`).
   2. Give it these roles: *Firebase Admin*, *Cloud Functions Admin*, *Cloud Run Admin*, *Service Account User*, *Secret Manager Admin*, *Service Usage Admin*, *Artifact Registry Administrator* and *Cloud Build Editor*.
   3. Open it → *Keys* → *Add key* → JSON. A file downloads. Keep it private.
4. **GitHub.** In vedanthbhat/Soultied → *Settings → Secrets and variables → Actions*, add three **secrets**:
   - `FIREBASE_SERVICE_ACCOUNT`: the whole JSON file's contents.
   - `RAZORPAY_KEY_ID`: from Razorpay.
   - `RAZORPAY_KEY_SECRET`: from Razorpay.

   Optionally, add two **variables** for the prices, in paise. `PLUS_MONTH_PAISE` defaults to `14900` (₹149) and `PLUS_YEAR_PAISE` to `119900` (₹1,199).
5. Run *Actions → Deploy to Firebase → Run workflow* (or push any change). When it's green, soultied.app/plus/ takes payments.

## Testing it

With *Test mode* keys, pay using Razorpay's test cards or UPI `success@razorpay`. The page shows a real code, and the extension accepts it. Codes made with test keys work like any other, so delete them in Firestore (`plusCodes`, `plusOrders`) before you switch to Live keys.
