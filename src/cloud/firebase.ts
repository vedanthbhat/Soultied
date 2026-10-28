import { FirebaseApp, initializeApp } from 'firebase/app';
import {
  Auth,
  GoogleAuthProvider,
  OAuthProvider,
  User,
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

/**
 * Firebase, if this build has it. The config comes from
 * firebase-applet-config.json (what Google AI Studio writes when Firebase is
 * switched on) or a VITE_FIREBASE_CONFIG variable. Without one, Soultied runs
 * exactly as before: everything stays in this browser.
 */

export interface CloudConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  /** AI Studio gives each app its own named database */
  firestoreDatabaseId?: string;
}

const files = import.meta.glob('../../firebase-applet-config.json', { eager: true, import: 'default' }) as Record<string, CloudConfig>;

function readConfig(): CloudConfig | null {
  const env = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
  if (env) {
    try {
      return JSON.parse(env) as CloudConfig;
    } catch {
      // fall through to the file
    }
  }
  const file = Object.values(files)[0];
  return file && file.apiKey && file.projectId ? file : null;
}

export const cloudConfig = readConfig();
export const cloudEnabled = !!cloudConfig;
/** local emulators, for development and tests */
const EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR as string | undefined;

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

/**
 * Running inside the Soultied iPhone app? The app is a thin native shell (Capacitor) that shows this very
 * site, and adds what a website can't do on a phone: signing in through iOS itself (Google, or Apple).
 */
type CapacitorGlobal = { isNativePlatform?: () => boolean; getPlatform?: () => string };
const capacitor = () => (typeof window !== 'undefined' ? (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor : undefined);
export const inApp = () => !!capacitor()?.isNativePlatform?.();
export const inIosApp = () => inApp() && capacitor()?.getPlatform?.() === 'ios';
/**
 * The app's native sign-in (loaded only inside the app). Hand back the module, never the plugin itself:
 * a Capacitor plugin answers to every name, so a promise that resolved to it would try to call its "then".
 */
const nativeAuth = () => import('@capacitor-firebase/authentication');

/**
 * The place's database, loaded the first time something needs it rather than with the page: a first
 * visit to the front door never downloads Firestore. Someone who's signed in on this browser gets it
 * fetched straight away, alongside the page (see `ONLINE_KEY`).
 */
export interface CloudDb {
  get(): Promise<Firestore>;
}
let dbReady: Promise<Firestore> | null = null;
const db: CloudDb = {
  get() {
    if (!dbReady)
      dbReady = import('firebase/firestore').then(
        (F) => {
          const settings = { ignoreUndefinedProperties: true };
          const d =
            cloudConfig!.firestoreDatabaseId && cloudConfig!.firestoreDatabaseId !== '(default)'
              ? F.initializeFirestore(app!, settings, cloudConfig!.firestoreDatabaseId)
              : F.initializeFirestore(app!, settings);
          if (EMULATOR) F.connectFirestoreEmulator(d, EMULATOR === '1' ? '127.0.0.1' : EMULATOR, 8080);
          return d;
        },
        (e) => {
          dbReady = null; // (couldn't download it: try again next time)
          throw e;
        }
      );
    return dbReady;
  },
};
/** set while someone's signed in on this browser, so the database can be fetched as the page opens */
const ONLINE_KEY = 'soultied_online';
const remember = (on: boolean) => {
  try {
    if (on) localStorage.setItem(ONLINE_KEY, '1');
    else localStorage.removeItem(ONLINE_KEY);
  } catch {
    // storage blocked: it just loads a moment later
  }
};
const warmUp = () => void db.get().catch(() => undefined);

/**
 * Served from Firebase Hosting itself? Then Google sign-in can go the long way
 * round (a full-page redirect) and still find its way back. Anywhere else,
 * browsers now drop that hand-off between the two sites, so we stick to the popup.
 */
const onFirebaseHosting = () =>
  !!cloudConfig && typeof window !== 'undefined' && [`${cloudConfig.projectId}.web.app`, `${cloudConfig.projectId}.firebaseapp.com`].includes(window.location.hostname);

export function cloud() {
  if (!cloudConfig) return null;
  if (!app) {
    app = initializeApp(onFirebaseHosting() ? { ...cloudConfig, authDomain: window.location.hostname } : cloudConfig);
    // in the app there are no pop-ups or redirects (iOS signs you in), so keep sign-in in the app's own storage
    auth = inApp() ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] }) : getAuth(app);
    if (EMULATOR) connectAuthEmulator(auth, `http://${EMULATOR === '1' ? '127.0.0.1' : EMULATOR}:9099`, { disableWarnings: true });
    // signed in here last time: fetch the database now, alongside everything else
    try {
      if (localStorage.getItem(ONLINE_KEY)) warmUp();
    } catch {
      // storage blocked
    }
  }
  return { app: app!, auth: auth!, db };
}

export function watchAuth(fn: (user: User | null) => void) {
  const c = cloud();
  if (!c) {
    fn(null);
    return () => undefined;
  }
  return onAuthStateChanged(c.auth, (user) => {
    remember(!!user);
    if (user) warmUp();
    fn(user);
  });
}

/** iOS's own sign-in sheets, closed without signing in */
const cancelledInApp = (err: unknown) => {
  const e = err as { code?: string; message?: string };
  return /cancel|1001|-5\b/i.test(`${e?.code || ''} ${e?.message || ''}`);
};

export function describeAuthError(err: unknown) {
  const code = (err as { code?: string })?.code || '';
  if (inApp() && cancelledInApp(err)) return null;
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null;
  if (code === 'auth/unauthorized-domain')
    return 'This web address isn’t allowed to sign in yet. Add it under Firebase → Authentication → Settings → Authorized domains.';
  if (code === 'auth/network-request-failed') return 'Couldn’t reach Google. Check your connection and try again.';
  if (code === 'auth/popup-blocked')
    return 'Your browser blocked the Google sign-in window. Allow pop-ups for this page and try again, or open the link in Chrome or Safari.';
  if (code === 'auth/operation-not-supported-in-this-environment')
    return 'This browser can’t open Google sign-in. Open the link in Chrome or Safari instead.';
  if (code === 'auth/operation-not-allowed') return 'That way of signing in isn’t switched on for this app yet (Firebase → Authentication → Sign-in method).';
  if (code === 'auth/account-exists-with-different-credential')
    return 'You’ve signed in with Google before, with this same email. Continue with Google instead, and you’ll be back in your place.';
  return 'Sign-in didn’t work. Please try again.';
}

export async function signInWithGoogle() {
  const c = cloud();
  if (!c) throw new Error('Firebase is not set up');
  if (inApp()) {
    // Google won't sign in inside an app's web view: iOS shows Google's own sheet, and hands us the result
    const { FirebaseAuthentication } = await nativeAuth();
    const r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const idToken = r.credential?.idToken;
    if (!idToken) throw Object.assign(new Error('Sign-in was cancelled'), { code: 'cancelled' });
    await signInWithCredential(c.auth, GoogleAuthProvider.credential(idToken, r.credential?.accessToken));
    return;
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(c.auth, provider);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    // popups blocked (some in-app browsers): go the long way round, where that can work
    if ((code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') && onFirebaseHosting()) {
      await signInWithRedirect(c.auth, provider);
      return;
    }
    throw err;
  }
}

/** Sign in with Apple (in the iPhone app). */
export async function signInWithApple() {
  const c = cloud();
  if (!c) throw new Error('Firebase is not set up');
  if (!inIosApp()) throw Object.assign(new Error('Sign in with Apple is only in the iPhone app'), { code: 'auth/operation-not-supported-in-this-environment' });
  const { FirebaseAuthentication } = await nativeAuth();
  const r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
  const idToken = r.credential?.idToken;
  if (!idToken) throw Object.assign(new Error('Sign-in was cancelled'), { code: 'cancelled' });
  // (your name comes from the place itself, where you type it, so Apple doesn't need to share it)
  await signInWithCredential(c.auth, new OAuthProvider('apple.com').credential({ idToken, rawNonce: r.credential?.nonce }));
}

/** Emulator only: sign in as a made-up Google user (used by the automated tests). */
export async function signInAsTestUser(email: string, name: string) {
  const c = cloud();
  if (!c || !EMULATOR) throw new Error('Test sign-in only works against the emulator');
  const token = JSON.stringify({ sub: email, email, email_verified: true, name });
  await signInWithCredential(c.auth, GoogleAuthProvider.credential(token));
}

export async function signOut() {
  const c = cloud();
  if (inApp()) await nativeAuth().then((m) => m.FirebaseAuthentication.signOut()).catch(() => undefined);
  if (c) await fbSignOut(c.auth);
}

export type CloudUser = User;
