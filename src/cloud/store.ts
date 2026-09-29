import {
  Firestore,
  Timestamp,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { ActivityItem, AvatarConfig, CoupleSpace } from '../types';
import type { CardAnswer, LetterDay, LetterKind } from '../letters/engine';
import type { CouchState } from '../couch';
import type { TitleInfo, TogetherLog } from '../stream/protocol';
import type { GameKind, Match } from '../games/types';

/**
 * Where a couple's things live in Firestore:
 *
 *   spaces/{spaceId}                     the place: name, both members, invite
 *   spaces/{spaceId}/members/{uid}       each person's name + look
 *   spaces/{spaceId}/letters/{kind_date} one letter day (each person writes only their own answers)
 *   spaces/{spaceId}/meta/letters        After dark switches, streak mends
 *   spaces/{spaceId}/meta/couch          who showed up when
 *   spaces/{spaceId}/meta/game-{kind}    the current game of Fireflies, Paper Boats… and the win tally
 *   spaces/{spaceId}/activities/{id}     the little "what happened" feed
 *   spaces/{spaceId}/live/{topic}/events play/pause, chat, calls, escape rooms (short-lived)
 *   invites/{code}                       lets a partner find the place from an invite code
 */

export interface MemberDoc {
  name: string;
  avatar: AvatarConfig;
  lastActive: string;
}

export interface SpaceDoc extends CoupleSpace {
  members: string[];
  /** the invite expiry again, as a number the security rules can compare */
  inviteExpiresAtMs: number;
  joinCode?: string;
}

export interface InviteDoc {
  spaceId: string;
  creatorId: string;
  spaceName: string;
  hostName: string;
  hostAvatar: AvatarConfig;
  partnerPlaceholderName: string;
  expiresAt: Timestamp;
}

export interface CloudData {
  space: SpaceDoc | null;
  members: Record<string, MemberDoc>;
  daily: Record<string, LetterDay>;
  afterDark: Record<string, LetterDay>;
  afterDarkOn: Record<string, boolean>;
  repairs: string[];
  couch: CouchState;
  activities: ActivityItem[];
  /** which listeners have delivered at least once */
  loaded: { space: boolean; members: boolean; letters: boolean };
}

export const emptyCloudData = (): CloudData => ({
  space: null,
  members: {},
  daily: {},
  afterDark: {},
  afterDarkOn: {},
  repairs: [],
  couch: { seen: {}, together: [], shown: {} },
  activities: [],
  loaded: { space: false, members: false, letters: false },
});

const spaceRef = (db: Firestore, sid: string) => doc(db, 'spaces', sid);
const memberRef = (db: Firestore, sid: string, uid: string) => doc(db, 'spaces', sid, 'members', uid);
const letterRef = (db: Firestore, sid: string, kind: LetterKind, dateKey: string) => doc(db, 'spaces', sid, 'letters', `${kind}_${dateKey}`);
const metaRef = (db: Firestore, sid: string, which: 'letters' | 'couch') => doc(db, 'spaces', sid, 'meta', which);
const activityRef = (db: Firestore, sid: string, id: string) => doc(db, 'spaces', sid, 'activities', id);
const inviteRef = (db: Firestore, code: string) => doc(db, 'invites', code.trim().toUpperCase());

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ---------- finding and making a place ---------- */

/** The place this person belongs to, if any (a place you share beats one you started alone). */
export async function findSpaceFor(db: Firestore, uid: string): Promise<string | null> {
  const snap = await getDocs(query(collection(db, 'spaces'), where('members', 'array-contains', uid), limit(10)));
  if (snap.empty) return null;
  const rank = (d: SpaceDoc) => (d.partnerId ? 2 : 0) + (d.creatorId === uid ? 0 : 1);
  const all = snap.docs.map((d) => d.data() as SpaceDoc).sort((a, b) => rank(b) - rank(a) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return all[0].id;
}

export async function createSpace(db: Firestore, uid: string, space: CoupleSpace, me: MemberDoc, first: ActivityItem) {
  const b = writeBatch(db);
  const expiresMs = new Date(space.inviteExpiresAt).getTime();
  const sd: SpaceDoc = { ...space, creatorId: uid, members: [uid], inviteExpiresAtMs: expiresMs };
  delete (sd as Partial<SpaceDoc>).partnerId;
  b.set(spaceRef(db, space.id), sd);
  b.set(memberRef(db, space.id, uid), me);
  b.set(inviteRef(db, space.inviteCode), invitePayload(sd, me));
  b.set(activityRef(db, space.id, first.id), { ...first, at: new Date().toISOString() });
  await b.commit();
}

function invitePayload(space: SpaceDoc, host: MemberDoc): InviteDoc {
  return {
    spaceId: space.id,
    creatorId: space.creatorId,
    spaceName: space.name,
    hostName: host.name,
    hostAvatar: host.avatar,
    partnerPlaceholderName: space.partnerPlaceholderName,
    expiresAt: Timestamp.fromMillis(space.inviteExpiresAtMs),
  };
}

export async function lookupInvite(db: Firestore, code: string): Promise<InviteDoc | null> {
  if (!code.trim()) return null;
  try {
    const snap = await getDoc(inviteRef(db, code));
    return snap.exists() ? (snap.data() as InviteDoc) : null;
  } catch {
    return null;
  }
}

export type CloudJoinResult = 'ok' | 'not_found' | 'full' | 'expired';

/** Take the empty seat in someone's place, using their invite code. */
export async function joinSpace(db: Firestore, uid: string, code: string, me: MemberDoc, joined: ActivityItem): Promise<{ result: CloudJoinResult; spaceId?: string }> {
  const invite = await lookupInvite(db, code);
  if (!invite) return { result: 'not_found' };
  if (invite.expiresAt.toMillis() < Date.now()) return { result: 'expired' };
  const sid = invite.spaceId;
  try {
    await updateDoc(spaceRef(db, sid), {
      partnerId: uid,
      members: arrayUnion(uid),
      joinCode: code.trim().toUpperCase(),
      partnerPlaceholderName: me.name,
    });
  } catch {
    // the rules turn us away if the seat is taken (or we're already in: then we can read it)
    const already = await getDoc(spaceRef(db, sid))
      .then((s) => ((s.data() as SpaceDoc | undefined)?.members || []).includes(uid))
      .catch(() => false);
    return already ? { result: 'ok', spaceId: sid } : { result: 'full' };
  }
  await setDoc(memberRef(db, sid, uid), me);
  await setDoc(activityRef(db, sid, joined.id), { ...joined, at: new Date().toISOString() });
  return { result: 'ok', spaceId: sid };
}

/* ---------- listening ---------- */

function relTime(iso: string) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 2) return 'Just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  const w = Math.round(d / 7);
  return w < 5 ? `${w} ${w === 1 ? 'week' : 'weeks'} ago` : new Date(t).toLocaleDateString();
}

/**
 * Keep a live copy of a place. `sinceKey` limits letters to recent days so a
 * long-running couple doesn't reload years of letters on every visit.
 */
export function subscribeSpace(db: Firestore, sid: string, sinceKey: string, onPatch: (fn: (d: CloudData) => CloudData) => void, onError: (e: unknown) => void) {
  const offs = [
    onSnapshot(
      spaceRef(db, sid),
      (s) => onPatch((d) => ({ ...d, space: s.exists() ? (s.data() as SpaceDoc) : null, loaded: { ...d.loaded, space: true } })),
      onError
    ),
    onSnapshot(
      collection(db, 'spaces', sid, 'members'),
      (s) => {
        const members: Record<string, MemberDoc> = {};
        s.forEach((m) => (members[m.id] = m.data() as MemberDoc));
        onPatch((d) => ({ ...d, members, loaded: { ...d.loaded, members: true } }));
      },
      onError
    ),
    onSnapshot(
      query(collection(db, 'spaces', sid, 'letters'), where('dateKey', '>=', sinceKey)),
      (s) => {
        const daily: Record<string, LetterDay> = {};
        const afterDark: Record<string, LetterDay> = {};
        s.forEach((x) => {
          const v = x.data() as LetterDay & { kind: LetterKind };
          const day: LetterDay = { dateKey: v.dateKey, cardIds: v.cardIds || [], by: v.by || {}, revealedAt: v.revealedAt };
          (v.kind === 'afterDark' ? afterDark : daily)[v.dateKey] = day;
        });
        onPatch((d) => ({ ...d, daily, afterDark, loaded: { ...d.loaded, letters: true } }));
      },
      onError
    ),
    onSnapshot(
      metaRef(db, sid, 'letters'),
      (s) => {
        const v = (s.data() || {}) as { afterDarkOn?: Record<string, boolean>; repairs?: string[] };
        onPatch((d) => ({ ...d, afterDarkOn: v.afterDarkOn || {}, repairs: v.repairs || [] }));
      },
      onError
    ),
    onSnapshot(
      metaRef(db, sid, 'couch'),
      (s) => {
        const v = (s.data() || {}) as Partial<CouchState>;
        onPatch((d) => ({ ...d, couch: { seen: v.seen || {}, together: v.together || [], shown: v.shown || {} } }));
      },
      onError
    ),
    onSnapshot(
      query(collection(db, 'spaces', sid, 'activities'), orderBy('at', 'desc'), limit(30)),
      (s) => {
        const activities: ActivityItem[] = [];
        s.forEach((x) => {
          const v = x.data() as ActivityItem & { at: string };
          activities.push({ id: x.id, type: v.type, title: v.title, description: v.description, timestamp: relTime(v.at) });
        });
        onPatch((d) => ({ ...d, activities }));
      },
      onError
    ),
  ];
  return () => offs.forEach((off) => off());
}

/* ---------- writing (each person only writes their own bits) ---------- */

export const writeMember = (db: Firestore, sid: string, uid: string, patch: Partial<MemberDoc>) =>
  setDoc(memberRef(db, sid, uid), patch, { merge: true });

export const writeSpace = (db: Firestore, sid: string, patch: Partial<SpaceDoc>) => updateDoc(spaceRef(db, sid), patch);

export async function writeNewInvite(db: Firestore, space: SpaceDoc, host: MemberDoc, code: string, expiresAt: string) {
  const ms = new Date(expiresAt).getTime();
  await setDoc(inviteRef(db, code), invitePayload({ ...space, inviteCode: code, inviteExpiresAt: expiresAt, inviteExpiresAtMs: ms }, host));
  await updateDoc(spaceRef(db, space.id), { inviteCode: code, inviteExpiresAt: expiresAt, inviteExpiresAtMs: ms });
}

/** Save one of my answers (creating the day, with its cards, if it's the first touch). */
export const writeAnswer = (db: Firestore, sid: string, uid: string, kind: LetterKind, day: LetterDay, cardId: string, answer: CardAnswer) =>
  setDoc(letterRef(db, sid, kind, day.dateKey), { kind, dateKey: day.dateKey, cardIds: day.cardIds, by: { [uid]: { cards: { [cardId]: answer } } } }, { merge: true });

export const writeMyLetter = (
  db: Firestore,
  sid: string,
  uid: string,
  kind: LetterKind,
  day: LetterDay,
  mine: { sealedAt?: string; seenAt?: string },
  revealedAt?: string
) =>
  setDoc(
    letterRef(db, sid, kind, day.dateKey),
    // (an empty {} here would *replace* my answers under merge, so only send what changed)
    { kind, dateKey: day.dateKey, cardIds: day.cardIds, ...(Object.keys(mine).length ? { by: { [uid]: mine } } : {}), ...(revealedAt ? { revealedAt } : {}) },
    { merge: true }
  );

export const writeAfterDark = (db: Firestore, sid: string, uid: string, on: boolean) =>
  setDoc(metaRef(db, sid, 'letters'), { afterDarkOn: { [uid]: on } }, { merge: true });

export const writeRepair = (db: Firestore, sid: string, dateKey: string) =>
  setDoc(metaRef(db, sid, 'letters'), { repairs: arrayUnion(dateKey) }, { merge: true });

export const writeCouchSeen = (db: Firestore, sid: string, uid: string, today: string, togetherToo: boolean) =>
  setDoc(metaRef(db, sid, 'couch'), { seen: { [uid]: today }, ...(togetherToo ? { together: arrayUnion(today) } : {}) }, { merge: true });

export const writeCouchShown = (db: Firestore, sid: string, uid: string, level: number) =>
  setDoc(metaRef(db, sid, 'couch'), { shown: { [uid]: level } }, { merge: true });

/* ---------- Netflix / Prime together: what you've watched as a pair ---------- */

const streamRef = (db: Firestore, sid: string) => doc(db, 'spaces', sid, 'meta', 'stream');

export const subscribeStreamLog = (db: Firestore, sid: string, fn: (log: TogetherLog) => void) =>
  onSnapshot(
    streamRef(db, sid),
    (s) => {
      const v = (s.data() || {}) as Partial<TogetherLog>;
      fn({ seen: v.seen || {}, shows: v.shows || {} });
    },
    () => undefined
  );

export const writeWatched = (db: Firestore, sid: string, t: TitleInfo, pos: number) =>
  setDoc(
    streamRef(db, sid),
    {
      seen: { [t.key]: { show: t.show, episode: t.episode, at: Date.now() } },
      shows: { [t.showKey]: { show: t.show, episode: t.episode, key: t.key, url: t.url, pos, at: Date.now() } },
    },
    { merge: true }
  );

export const writeActivity = (db: Firestore, sid: string, a: Omit<ActivityItem, 'id' | 'timestamp'>) => {
  const id = newId('act');
  return setDoc(activityRef(db, sid, id), { ...a, id, timestamp: '', at: new Date().toISOString() });
};

/* ---------- games ---------- */

const gameRef = (db: Firestore, sid: string, kind: GameKind) => doc(db, 'spaces', sid, 'meta', `game-${kind}`);

export const subscribeGame = (db: Firestore, sid: string, kind: GameKind, fn: (m: Match | null) => void) =>
  onSnapshot(
    gameRef(db, sid, kind),
    (s) => fn(s.exists() ? (s.data() as Match) : null),
    () => undefined
  );

/** The whole match is written each move (Firestore doesn't take `undefined`, so it's dropped first). */
export const writeGame = (db: Firestore, sid: string, m: Match) => setDoc(gameRef(db, sid, m.kind), JSON.parse(JSON.stringify(m)));
