import { initializeApp } from 'firebase/app';
import { type Auth, connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth/web-extension';
import {
  type Firestore,
  type Timestamp,
  arrayUnion,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  initializeFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { channelAt, type LiveChannel } from '../../src/cloud/live';
import {
  emptyLog,
  partyLink,
  SITE,
  type ExtMsg,
  type HubMsg,
  type PartyReply,
  type PlusReply,
  type Session,
  type StreamEvent,
  type TitleInfo,
} from '../../src/stream/protocol';
import type { AvatarConfig } from '../../src/types';

/**
 * A watch party's line to your person, for when there's no Soultied place.
 *
 * Chrome keeps this small hidden page open while you're in a watch party. It
 * signs in anonymously (no account), keeps the party's details current, and
 * carries play / pause / chat between the two of you: the job a Soultied tab
 * does for a couple with a place. The background script passes messages
 * between it and the Netflix / Prime tabs.
 *
 * In Firestore: parties/{id} says who's in it (two seats) and what's on;
 * parties/{id}/events holds the short-lived messages between you.
 */

export interface PartyMe {
  name: string;
  avatar: AvatarConfig;
}

interface PartyDoc {
  id: string;
  host: string;
  members: string[];
  people: Record<string, PartyMe>;
  title: TitleInfo | null;
  /** Soultied Plus for this party: whose code, and until when (cameras and voice for both of you) */
  plus?: { by: string; code: string; until: Timestamp } | null;
}

/** A Soultied Plus code, as Soultied keeps it (plusCodes/{sha-256 of the code}). */
interface PlusCodeDoc {
  validUntil: Timestamp | number;
  activations: string[];
}

/** what the background knows about this browser's Plus code */
export interface PlusMine {
  hash: string;
  until: number;
}

/** background -> here */
export type ToOffscreen = { to: 'offscreen' } & (
  | { op: 'create'; me: PartyMe; title: TitleInfo | null }
  | { op: 'peek'; id: string }
  | { op: 'join'; id: string; me: PartyMe }
  | { op: 'open'; id: string }
  | { op: 'leave' }
  | { op: 'ext'; msg: ExtMsg }
  | { op: 'players'; count: number }
  /** add a Plus code (the letters that matter, already tidied) */
  | { op: 'redeem'; key: string }
  /** this browser's Plus code, for the party you're in */
  | { op: 'plus'; plus: PlusMine | null }
);

/** here -> background */
export type FromOffscreen = { to: 'background'; from: 'party' } & (
  | { msg: HubMsg }
  | { idle: true }
  /** your person put something on: take you there if you're not on that site (the show tab, if there is one, offers it itself) */
  | { take: TitleInfo }
);

/** what create / join / open answer */
export type OpenReply =
  | { ok: true; id: string; session: Session | null; title: TitleInfo | null }
  | { ok: false; error: 'missing' | 'full' | 'gone' | 'offline' | 'failed' };

const IDLE_MS = 5 * 60_000;

/* ---------------- Firebase ---------------- */

let fb: { auth: Auth; db: Firestore } | null = null;

function cloud() {
  if (fb) return fb;
  if (!__FIREBASE__) throw Object.assign(new Error('no Firebase settings in this build'), { code: 'offline' });
  const app = initializeApp(__FIREBASE__);
  const auth = getAuth(app);
  const settings = { ignoreUndefinedProperties: true };
  const dbId = __FIREBASE__.firestoreDatabaseId;
  const db = dbId && dbId !== '(default)' ? initializeFirestore(app, settings, dbId) : initializeFirestore(app, settings);
  if (__EMULATOR__) {
    connectAuthEmulator(auth, `http://${__EMULATOR__}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, __EMULATOR__, 8080);
  }
  fb = { auth, db };
  return fb;
}

/** Signed in as this browser's anonymous Soultied user (kept between visits). */
async function signedIn() {
  const { auth } = cloud();
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser!.uid;
}

/* ---------------- the party you're in ---------------- */

let uid: string | null = null;
let current: { id: string; doc: PartyDoc | null; off: () => void } | null = null;
let chan: LiveChannel<StreamEvent> | null = null;
/** said while the line was still opening */
let queue: StreamEvent[] = [];
/** a Netflix / Prime tab is open and connected */
let active = false;
let byeTimer = 0;
let idleTimer = 0;
let lastSession = '';
let titleKey: string | null = null;

const toBackground = (m: { msg: HubMsg } | { idle: true } | { take: TitleInfo }) =>
  chrome.runtime.sendMessage({ to: 'background', from: 'party', ...m } satisfies FromOffscreen).catch(() => undefined);
const hub = (msg: HubMsg) => void toBackground({ msg });

const DEFAULT_LOOK = (people: Record<string, PartyMe>) => Object.values(people)[0]?.avatar;

const ms = (t: Timestamp | number | null | undefined) => (typeof t === 'number' ? t : t?.toMillis?.() ?? 0);

function session(): Session | null {
  const d = current?.doc;
  if (!d || !uid || !d.members.includes(uid)) return null;
  const mine = d.people[uid];
  const otherId = d.members.find((m) => m !== uid) || null;
  const other = otherId ? d.people[otherId] : null;
  return {
    me: { id: uid, name: mine?.name || 'You', avatar: mine?.avatar || DEFAULT_LOOK(d.people)! },
    partner: otherId ? { id: otherId, name: other?.name || 'Your person', avatar: other?.avatar || DEFAULT_LOOK(d.people)! } : null,
    leftId: d.host,
    place: 'Watch party',
    closeness: 0.5,
    log: emptyLog(),
    hubUrl: SITE,
    party: { id: d.id, link: partyLink(d.id), plusUntil: d.plus ? ms(d.plus.until) || null : null },
  };
}

function pushSession(force = false) {
  const s = session();
  const json = JSON.stringify(s);
  if (json === lastSession && !force) return;
  lastSession = json;
  hub({ kind: 'session', session: s });
}

/**
 * The line to your person is open whenever there's someone in the party with you, even with no
 * show open here: whatever they put on, you're brought along (the background opens it for you).
 */
function syncChannel() {
  const want = !!current?.doc && current.doc.members.length > 1;
  if (want && !chan && current) {
    const ch = channelAt<StreamEvent>(collection(cloud().db, 'parties', current.id, 'events'));
    chan = ch;
    ch.subscribe((e) => {
      if (e.by === uid) return;
      if (active) hub({ kind: 'event', e });
      if (e.type === 'title' && e.title) void toBackground({ take: e.title });
    });
    const waiting = queue;
    queue = [];
    waiting.forEach((e) => ch.send(e));
  } else if (!want && chan) {
    chan.close();
    chan = null;
  }
  if (!want) queue = [];
}

function send(e: StreamEvent) {
  if (chan) chan.send(e);
  // only worth keeping while the line is about to open (not while you're on your own)
  else if (active && (current?.doc?.members.length || 0) > 1) queue = [...queue.slice(-20), e];
}

/** What's on, so a link opened later goes to the same show (from the tab that's playing, not one left open behind it). */
function noteTitle(e: StreamEvent) {
  const t = 'title' in e ? e.title : null;
  // a new title, or one that's playing (not the every-20-seconds "still here" from any open tab)
  const live = e.type === 'title' || (e.type !== 'ping' && 'playing' in e && e.playing) || !current?.doc?.title;
  if (!t || !live || !current || t.key === titleKey || t.key === current.doc?.title?.key) return;
  titleKey = t.key;
  updateDoc(doc(cloud().db, 'parties', current.id), { title: t, updatedAt: serverTimestamp() }).catch(() => {
    titleKey = null;
  });
}

function close() {
  current?.off();
  current = null;
  chan?.close();
  chan = null;
  queue = [];
  lastSession = '';
  titleKey = null;
}

async function open(id: string): Promise<OpenReply> {
  const me = await signedIn();
  uid = me;
  if (current?.id === id && current.doc) return { ok: true, id, session: session(), title: current.doc.title || null };
  close();
  const ref = doc(cloud().db, 'parties', id);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() as PartyDoc) : null;
  // gone, or this browser isn't in it (a different anonymous sign-in)
  if (!data || !data.members.includes(me)) return { ok: false, error: 'gone' };
  const here: { id: string; doc: PartyDoc | null; off: () => void } = { id, doc: data, off: () => undefined };
  current = here;
  here.off = onSnapshot(
    ref,
    (s) => {
      if (current !== here) return;
      here.doc = s.exists() ? (s.data() as PartyDoc) : null;
      syncChannel();
      pushSession();
      void sharePlus();
    },
    () => undefined,
  );
  syncChannel();
  lastSession = JSON.stringify(session());
  return { ok: true, id, session: session(), title: data.title || null };
}

async function create(me: PartyMe, title: TitleInfo | null): Promise<OpenReply> {
  const mine = await signedIn();
  const ref = doc(collection(cloud().db, 'parties'));
  await setDoc(ref, {
    id: ref.id,
    host: mine,
    members: [mine],
    people: { [mine]: me },
    title,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const opened = await open(ref.id);
  titleKey = title?.key || null;
  return opened;
}

async function peek(id: string): Promise<PartyReply> {
  const mine = await signedIn();
  const snap = await getDoc(doc(cloud().db, 'parties', id));
  if (!snap.exists()) return { ok: false, error: 'missing' };
  const d = snap.data() as PartyDoc;
  const member = d.members.includes(mine);
  return {
    ok: true,
    op: 'peek',
    host: d.people[d.host]?.name || 'Someone',
    title: d.title || null,
    member,
    full: !member && d.members.length >= 2,
    name: d.people[mine]?.name || '',
  };
}

async function join(id: string, me: PartyMe): Promise<OpenReply> {
  const mine = await signedIn();
  const ref = doc(cloud().db, 'parties', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, error: 'missing' };
  const d = snap.data() as PartyDoc;
  if (!d.members.includes(mine)) {
    if (d.members.length >= 2) return { ok: false, error: 'full' };
    await updateDoc(ref, { members: arrayUnion(mine), [`people.${mine}`]: me, updatedAt: serverTimestamp() });
  } else if (d.people[mine]?.name !== me.name) {
    await updateDoc(ref, { [`people.${mine}`]: { ...me, avatar: d.people[mine]?.avatar || me.avatar }, updatedAt: serverTimestamp() });
  }
  return open(id);
}

/* ---------------- Soultied Plus ---------------- */

let myPlus: PlusMine | null = null;
let sharing = false;

async function sha256(text: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Check a code against Soultied's list and add this browser to it (up to three browsers per code). */
async function redeem(key: string): Promise<PlusReply> {
  const me = await signedIn();
  const hash = await sha256(key);
  const ref = doc(cloud().db, 'plusCodes', hash);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ok: false, error: 'invalid' };
  const d = snap.data() as PlusCodeDoc;
  const until = ms(d.validUntil);
  if (until <= Date.now()) return { ok: false, error: 'expired' };
  const acts = Array.isArray(d.activations) ? d.activations : [];
  if (!acts.includes(me)) {
    if (acts.length >= 3) return { ok: false, error: 'full' };
    await updateDoc(ref, { activations: [...acts, me] });
  }
  myPlus = { hash, until };
  void sharePlus();
  return { ok: true, until };
}

/**
 * One of you having Plus covers you both: put your code on the party you're in (the security rules
 * check it's real, still valid, and yours), unless it already has one that lasts as long.
 */
async function sharePlus() {
  const d = current?.doc;
  const mine = myPlus;
  if (!d || !uid || !mine || sharing || mine.until <= Date.now() || !d.members.includes(uid)) return;
  if (d.plus && ms(d.plus.until) >= mine.until) return;
  sharing = true;
  try {
    const code = await getDoc(doc(cloud().db, 'plusCodes', mine.hash));
    if (!code.exists()) return;
    const c = code.data() as PlusCodeDoc;
    if (!c.activations?.includes(uid) || ms(c.validUntil) <= Date.now()) return;
    await updateDoc(doc(cloud().db, 'parties', d.id), { plus: { by: uid, code: mine.hash, until: c.validUntil }, updatedAt: serverTimestamp() });
  } catch (err) {
    console.warn('Soultied Plus:', err);
  } finally {
    sharing = false;
  }
}

function leave() {
  if (uid && chan) chan.send({ type: 'bye', by: uid, at: Date.now() });
  close();
}

/* ---------------- the Netflix / Prime tabs (through the background) ---------------- */

function fromPlayers(msg: ExtMsg) {
  if (msg.kind === 'hello') {
    window.clearTimeout(byeTimer);
    active = true;
    syncChannel();
    pushSession(true);
    // no voice in a watch party (that's for Soultied Plus)
    hub({ kind: 'voice', mine: false, partner: false, cams: false });
  } else if (msg.kind === 'send') {
    send(msg.e);
    noteTitle(msg.e);
  } else if (msg.kind === 'bye') {
    window.clearTimeout(byeTimer);
    byeTimer = window.setTimeout(() => {
      active = false;
      syncChannel();
    }, 8000);
  }
  // 'watched' and 'ptt' belong to a Soultied place
}

/** With no show open for a while (or no party at all), let Chrome close this page (it opens again when you're back). */
function players(count: number) {
  window.clearTimeout(idleTimer);
  if (count === 0) idleTimer = window.setTimeout(() => void toBackground({ idle: true }), IDLE_MS);
}

const failed = (err: unknown): { ok: false; error: 'offline' | 'failed' } => ({
  ok: false,
  error: (err as { code?: string })?.code === 'offline' || /network|offline|unavailable/i.test(String((err as Error)?.message)) ? 'offline' : 'failed',
});

chrome.runtime.onMessage.addListener((m: ToOffscreen, _sender, reply) => {
  if (m?.to !== 'offscreen') return;
  const answer = (p: Promise<unknown>) => {
    p.then(reply, (err) => {
      console.warn('Soultied watch party:', err);
      reply(failed(err));
    });
    return true;
  };
  switch (m.op) {
    case 'create':
      window.clearTimeout(idleTimer);
      return answer(create(m.me, m.title));
    case 'peek':
      // just looking at a link: close again later unless you join
      if (!current) players(0);
      return answer(peek(m.id));
    case 'join':
      window.clearTimeout(idleTimer);
      return answer(join(m.id, m.me));
    case 'open':
      window.clearTimeout(idleTimer);
      return answer(open(m.id));
    case 'leave':
      leave();
      players(0);
      reply({ ok: true });
      return;
    case 'ext':
      fromPlayers(m.msg);
      reply({ ok: true });
      return;
    case 'players':
      players(m.count);
      reply({ ok: true });
      return;
    case 'redeem':
      return answer(redeem(m.key));
    case 'plus':
      myPlus = m.plus;
      void sharePlus();
      reply({ ok: true });
      return;
  }
});
