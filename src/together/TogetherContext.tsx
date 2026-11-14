import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { newKey, useSharedDoc } from './useSharedDoc';
import { type Ask, type AskAnswer, type AsksView, DEMO_REPLIES, demoAsks, normalizeAsks, viewAsks } from './asks';
import {
  type MoodEntry,
  type MoodId,
  type Touch,
  type TouchKind,
  MOOD_TEXT_MAX,
  currentMood,
  demoMoods,
  demoTouch,
  normalizeMoods,
  normalizeTouch,
  touchesToDrop,
  unseenTouches,
} from './moods';
import { tone } from '../escape/sfx';
import { type BoardDoc, type WallArt, demoBoard, normalizeBoard } from './board';
import { type VisitDoc, VISIT_WHAT_MAX, demoVisit, normalizeVisit } from './visit';
import { type SnapShot, type SnapStage, SNAP_CAPTION_MAX, demoSnap, normalizeSnap, snapDocName, snapPrompt, snapStage } from './snap';
import { HOLD_BEAT_MS, demoHold, isHolding, normalizeHold } from './hold';
import { demoAbout, normalizeAbout } from './about';
import { type WhereEntry, apartKm, demoWhere, deviceZone, normalizeWhere, roundCoord } from './where';
import { type BucketDoc, BUCKET_MAX, bucketOverflow, cleanText, demoBucket, normalizeBucket } from './bucket';

/**
 * The little shared things of a place that aren't letters, games or decor: the questions you write
 * for each other, how you're each feeling, and the touches you send. (Each lives in its own small
 * document; see useSharedDoc.)
 */

interface TogetherValue {
  asksReady: boolean;
  asks: AsksView;
  /** ask your person something (and give your own answer, which stays hidden until they've answered) */
  ask: (prompt: string, options: string[], mine: Omit<AskAnswer, 'at'>) => void;
  answerAsk: (id: string, mine: Omit<AskAnswer, 'at'>) => void;
  markAskSeen: (id: string) => void;
  /** take back a question they haven't answered yet */
  withdrawAsk: (id: string) => void;

  /** how you're each feeling (nothing once it's a day old) */
  myMood: MoodEntry | null;
  theirMood: MoodEntry | null;
  /** say how you're feeling; no mood and no words takes it down */
  setMood: (mood: MoodId | null, text: string) => void;
  /** your person's mood, when it's changed since you last looked */
  moodNews: MoodEntry | null;
  markMoodSeen: () => void;

  /** a hug, a kiss, a high five… (`reply` when it's one sent straight back) */
  sendTouch: (kind: TouchKind, reply?: boolean) => void;
  /** touches from your person you haven't seen yet, newest first */
  touchNews: Touch[];
  markTouchesSeen: () => void;
  /** the last one you sent */
  lastSent: Touch | null;
  /** the touch the room is playing (or just played): one you sent, or the newest one that came in */
  roomTouch: Touch | null;

  /** our wall: who pinned what last, and the picture in the frame over the couch */
  board: BoardDoc;
  /** what your person pinned since you last looked at the wall */
  wallNews: { at: number; kind: 'text' | 'doodle' | 'photo' } | null;
  markWallSeen: () => void;
  /** say you've just pinned something up (so your person sees there's something new) */
  pinned: (kind: 'text' | 'doodle' | 'photo', ref?: string) => void;
  /** hang a doodle or photo in the frame over the couch (null takes it down) */
  hangArt: (art: WallArt | null) => void;

  /** the next time you'll be together (its date is '' when none's set) */
  visit: VisitDoc;
  /** set the day you'll be together next, and where or what for ('' for the date takes it down) */
  setVisit: (date: string, what: string) => void;

  /** today's photo: the prompt, where it's at, and the two photos (theirs only once you've posted yours) */
  snap: { day: string; prompt: string; stage: SnapStage; mine: SnapShot | null; theirs: SnapShot | null };
  /** post (or retake) your photo for today */
  postSnap: (shot: Omit<SnapShot, 'at'>) => void;

  /** holding the couch: you, your person, and both of you at once (and since when) */
  hold: { mine: boolean; theirs: boolean; together: boolean; since: number };
  /** press and hold (true), or let go (false) */
  setHolding: (on: boolean) => void;

  /** what you said about the two of you (question id to answer id; null until you've answered), once it's loaded */
  about: { ready: boolean; mine: Record<string, string> | null };
  /** keep what you said about the two of you */
  saveAbout: (answers: Record<string, string>) => void;

  /** how far apart you are (km, once you've both shared roughly where), your time zone and theirs */
  where: { ready: boolean; mine: WhereEntry | null; theirs: WhereEntry | null; km: number | null; myZone: string };
  /** share roughly where you are (asks the browser), or stop sharing it */
  shareWhere: (on: boolean) => Promise<'ok' | 'denied' | 'unavailable'>;

  /** our list: the things you want to do together */
  bucket: BucketDoc;
  /** add something (for next time, or some day); tick it done (or not); star it for next time; take it off */
  addWish: (text: string, next?: boolean) => void;
  tickWish: (id: string, done: boolean) => void;
  starWish: (id: string, next: boolean) => void;
  dropWish: (id: string) => void;
}

const Ctx = createContext<TogetherValue | null>(null);

/** a soft little chime for each kind of touch */
export function touchSound(kind: TouchKind) {
  try {
    const v = 0.03;
    if (kind === 'highfive') {
      tone(1568, 0.04, 0, 'square', v * 0.7);
      tone(2093, 0.08, 0.04, 'triangle', v);
    } else if (kind === 'boop') {
      tone(1319, 0.05, 0, 'triangle', v);
    } else if (kind === 'kiss' || kind === 'forehead') {
      tone(988, 0.08, 0, 'triangle', v);
      tone(1319, 0.14, 0.08, 'triangle', v);
    } else {
      [523, 659, 784].forEach((f, i) => tone(f, 0.16, i * 0.09, 'triangle', v));
    }
  } catch {
    // no sound is fine
  }
}

export const TogetherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, partnerUser, addActivity, today, space } = useApp();
  const me = currentUser.id;
  const them = partnerUser?.id || null;

  /* ---------- questions you ask each other ---------- */

  const asksDoc = useSharedDoc('asks', normalizeAsks, demoAsks);
  const { write } = asksDoc;
  const asks = useMemo(() => viewAsks(asksDoc.doc, me, them), [asksDoc.doc, me, them]);

  const ask = useCallback<TogetherValue['ask']>(
    (prompt, options, mine) => {
      const id = newKey('ask-');
      const at = Date.now();
      const item: Ask = { id, by: me, prompt: prompt.trim(), options, at, answers: { [me]: { ...mine, at } }, seen: {} };
      write({ items: { [id]: item } });
      // the demo room: Rohan answers a moment later
      if (asksDoc.mode === 'demo' && them) {
        window.setTimeout(() => {
          const reply: AskAnswer = options.length
            ? { pick: Math.floor(Math.random() * options.length), at: Date.now() }
            : { text: DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)], at: Date.now() };
          write({ items: { [id]: { answers: { [them]: reply } } } });
        }, 3500);
      }
    },
    [me, them, write, asksDoc.mode]
  );

  const answerAsk = useCallback<TogetherValue['answerAsk']>(
    (id, mine) => {
      const item = asksDoc.doc.items[id];
      if (!item || item.answers[me]) return;
      write({ items: { [id]: { answers: { [me]: { ...mine, at: Date.now() } } } } });
      if (them && item.answers[them] && partnerUser) {
        addActivity({ type: 'question_revealed', title: 'A question, answered', description: `“${item.prompt}”` });
      }
    },
    [asksDoc.doc, me, them, write, addActivity, partnerUser]
  );

  const markAskSeen = useCallback<TogetherValue['markAskSeen']>(
    (id) => {
      const item = asksDoc.doc.items[id];
      if (!item || item.seen[me]) return;
      write({ items: { [id]: { seen: { [me]: Date.now() } } } });
    },
    [asksDoc.doc, me, write]
  );

  const withdrawAsk = useCallback<TogetherValue['withdrawAsk']>(
    (id) => {
      const item = asksDoc.doc.items[id];
      if (!item || item.by !== me || (them && item.answers[them])) return;
      write({ items: { [id]: null } });
    },
    [asksDoc.doc, me, them, write]
  );

  /* ---------- how you're feeling ---------- */

  const moodsDoc = useSharedDoc('moods', normalizeMoods, demoMoods);
  const writeMoods = moodsDoc.write;
  const myMood = currentMood(moodsDoc.doc, me);
  const theirMood = currentMood(moodsDoc.doc, them);
  const moodNews = theirMood && theirMood.at > (moodsDoc.doc.seen[me] ?? 0) ? theirMood : null;

  const setMood = useCallback<TogetherValue['setMood']>(
    (mood, text) => {
      const words = text.trim().slice(0, MOOD_TEXT_MAX);
      writeMoods({ by: { [me]: mood || words ? { mood, text: words, at: Date.now() } : null } });
    },
    [me, writeMoods]
  );

  const theirMoodAt = theirMood?.at ?? 0;
  const markMoodSeen = useCallback(() => {
    if (theirMoodAt && theirMoodAt > (moodsDoc.doc.seen[me] ?? 0)) writeMoods({ seen: { [me]: theirMoodAt } });
  }, [theirMoodAt, moodsDoc.doc.seen, me, writeMoods]);

  /* ---------- touches ---------- */

  const touchDoc = useSharedDoc('touch', normalizeTouch, demoTouch);
  const writeTouch = touchDoc.write;
  const touchNews = useMemo(() => unseenTouches(touchDoc.doc, me, them), [touchDoc.doc, me, them]);
  const lastSent = useMemo(
    () => Object.values(touchDoc.doc.items).filter((t) => t.by === me).sort((a, b) => b.at - a.at)[0] || null,
    [touchDoc.doc, me]
  );
  const [roomTouch, setRoomTouch] = useState<Touch | null>(null);

  const docRef = useRef(touchDoc.doc);
  docRef.current = touchDoc.doc;
  const sendTouch = useCallback<TogetherValue['sendTouch']>(
    (kind, reply = false) => {
      const t: Touch = { id: newKey('t-'), by: me, kind, at: Date.now() };
      const drop = Object.fromEntries(touchesToDrop(docRef.current).map((id) => [id, null]));
      writeTouch({ items: { ...drop, [t.id]: t } });
      setRoomTouch(t);
      touchSound(kind);
      // the demo room: Rohan sends one straight back (but doesn't answer a reply, or you'd go on forever)
      if (touchDoc.mode === 'demo' && them && !reply) {
        window.setTimeout(() => {
          const back: Touch = { id: newKey('t-'), by: them, kind, at: Date.now() };
          writeTouch({ items: { [back.id]: back } });
        }, 2800);
      }
    },
    [me, them, writeTouch, touchDoc.mode]
  );

  // a touch just came in (or was waiting when you arrived): the room plays it once
  const newest = touchNews[0] || null;
  const playedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!newest || playedRef.current === newest.id) return;
    playedRef.current = newest.id;
    setRoomTouch(newest);
    touchSound(newest.kind);
  }, [newest]);

  const newestAt = newest?.at ?? 0;
  const markTouchesSeen = useCallback(() => {
    if (newestAt) writeTouch({ seen: { [me]: newestAt } });
  }, [newestAt, me, writeTouch]);

  /* ---------- our wall ---------- */

  const boardDoc = useSharedDoc('board', normalizeBoard, demoBoard);
  const writeBoard = boardDoc.write;
  const theirLast = them ? boardDoc.doc.last[them] : undefined;
  const wallNews = theirLast && theirLast.at > (boardDoc.doc.seen[me] ?? 0) ? theirLast : null;
  const wallNewsAt = wallNews?.at ?? 0;
  const markWallSeen = useCallback(() => {
    if (wallNewsAt) writeBoard({ seen: { [me]: wallNewsAt } });
  }, [wallNewsAt, me, writeBoard]);
  const pinned = useCallback<TogetherValue['pinned']>(
    (kind, ref) => {
      const at = Date.now();
      writeBoard({ last: { [me]: { at, kind } }, ...(kind === 'doodle' && ref ? { drew: { [me]: { id: ref, at } } } : {}) });
    },
    [me, writeBoard]
  );
  const hangArt = useCallback<TogetherValue['hangArt']>((art) => writeBoard({ art: art ? { ...art } : null }), [writeBoard]);

  /* ---------- the next time you're together ---------- */

  const visitDoc = useSharedDoc('visit', normalizeVisit, demoVisit);
  const writeVisit = visitDoc.write;
  const setVisit = useCallback<TogetherValue['setVisit']>(
    (date, what) => writeVisit({ date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '', what: date ? what.trim().slice(0, VISIT_WHAT_MAX) : '', by: me, at: Date.now() }),
    [me, writeVisit]
  );

  /* ---------- today's photo ---------- */

  const snapDoc = useSharedDoc(snapDocName(today), normalizeSnap, demoSnap);
  const writeSnap = snapDoc.write;
  const snap = useMemo<TogetherValue['snap']>(() => {
    const stage = snapStage(snapDoc.doc, me, them);
    return {
      day: today,
      prompt: snapPrompt(space?.id || 'solo', today),
      stage,
      mine: snapDoc.doc.by[me] ?? null,
      // (theirs stays hidden until you've posted yours)
      theirs: stage === 'open' && them ? (snapDoc.doc.by[them] ?? null) : null,
    };
  }, [snapDoc.doc, me, them, today, space?.id]);
  const postSnap = useCallback<TogetherValue['postSnap']>(
    (shot) => writeSnap({ by: { [me]: { ...shot, caption: shot.caption.trim().slice(0, SNAP_CAPTION_MAX), at: Date.now() } } }),
    [me, writeSnap]
  );

  /* ---------- holding the couch ---------- */

  const holdDoc = useSharedDoc('hold', normalizeHold, demoHold);
  const writeHold = holdDoc.write;
  const isDemoRoom = holdDoc.mode === 'demo';
  const [holding, setHolding] = useState(false);
  const wasHolding = useRef(false);
  // while you hold, a beat about once a second (and one to say you've let go)
  useEffect(() => {
    if (!holding) {
      if (wasHolding.current) writeHold({ by: { [me]: { holding: false, beat: Date.now() } } });
      wasHolding.current = false;
      return;
    }
    wasHolding.current = true;
    const beat = () => writeHold({ by: { [me]: { holding: true, beat: Date.now() } } });
    beat();
    const id = window.setInterval(beat, HOLD_BEAT_MS);
    return () => window.clearInterval(id);
  }, [holding, me, writeHold]);
  // the demo room: Rohan holds back a moment after you do, and lets go when you do
  useEffect(() => {
    if (!isDemoRoom || !them) return;
    let id = 0;
    const beat = (on: boolean) => writeHold({ by: { [them]: { holding: on, beat: Date.now() } } });
    const t = window.setTimeout(
      () => {
        beat(holding);
        if (holding) id = window.setInterval(() => beat(true), HOLD_BEAT_MS);
      },
      holding ? 1200 : 400
    );
    return () => {
      window.clearTimeout(t);
      window.clearInterval(id);
    };
  }, [holding, isDemoRoom, them, writeHold]);
  // when each of their beats arrives (by this computer's clock), and a tick to notice when they stop
  const theirHold = them ? holdDoc.doc.by[them] : undefined;
  const [theirSeen, setTheirSeen] = useState(0);
  useEffect(() => {
    if (theirHold?.holding) setTheirSeen(Date.now());
  }, [theirHold?.holding, theirHold?.beat]);
  const [holdNow, setHoldNow] = useState(() => Date.now());
  const theirsMaybe = !!theirHold?.holding;
  useEffect(() => {
    if (!theirsMaybe && !holding) return;
    const id = window.setInterval(() => setHoldNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [theirsMaybe, holding]);
  const theirsHolding = isHolding(theirHold, theirSeen, Math.max(holdNow, theirSeen));
  const together = holding && theirsHolding;
  const [since, setSince] = useState(0);
  useEffect(() => setSince(together ? Date.now() : 0), [together]);
  const hold = useMemo(() => ({ mine: holding, theirs: theirsHolding, together, since }), [holding, theirsHolding, together, since]);

  /* ---------- about the two of you ---------- */

  const aboutDoc = useSharedDoc('about', normalizeAbout, demoAbout);
  const writeAbout = aboutDoc.write;
  const about = useMemo(() => ({ ready: aboutDoc.ready, mine: aboutDoc.doc.by[me] ?? null }), [aboutDoc.ready, aboutDoc.doc, me]);
  const saveAbout = useCallback<TogetherValue['saveAbout']>((answers) => writeAbout({ by: { [me]: { ...answers, at: String(Date.now()) } } }), [me, writeAbout]);

  /* ---------- how far apart ---------- */

  const whereDoc = useSharedDoc('where', normalizeWhere, demoWhere);
  const writeWhere = whereDoc.write;
  const demoWhereRoom = whereDoc.mode === 'demo';
  const zone = useMemo(deviceZone, []);
  const myWhere = whereDoc.doc.by[me] ?? null;
  // your time zone, kept up to date (so your person can see what time it is for you)
  useEffect(() => {
    if (!whereDoc.ready || demoWhereRoom || !zone || myWhere?.tz === zone) return;
    writeWhere({ by: { [me]: { tz: zone, at: Date.now() } } });
  }, [whereDoc.ready, demoWhereRoom, zone, myWhere?.tz, me, writeWhere]);
  const shareWhere = useCallback<TogetherValue['shareWhere']>(
    async (on) => {
      if (!on) {
        writeWhere({ by: { [me]: { lat: null, lon: null, at: Date.now() } } });
        return 'ok';
      }
      if (typeof navigator === 'undefined' || !navigator.geolocation) return 'unavailable';
      return new Promise((resolve) =>
        navigator.geolocation.getCurrentPosition(
          (p) => {
            writeWhere({ by: { [me]: { lat: roundCoord(p.coords.latitude), lon: roundCoord(p.coords.longitude), ...(zone ? { tz: zone } : {}), at: Date.now() } } });
            resolve('ok');
          },
          (e) => resolve(e.code === 1 ? 'denied' : 'unavailable'),
          { enableHighAccuracy: false, maximumAge: 30 * 60e3, timeout: 20000 }
        )
      );
    },
    [me, zone, writeWhere]
  );
  // once you're sharing, where you are follows you (quietly, when the browser already allows it, twice a day at most)
  const whereStale = !demoWhereRoom && !!myWhere && myWhere.lat !== null && Date.now() - myWhere.at > 12 * 3600e3;
  useEffect(() => {
    if (!whereStale || typeof navigator === 'undefined' || !navigator.permissions) return;
    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((s) => (s.state === 'granted' ? shareWhere(true) : undefined))
      .catch(() => undefined);
  }, [whereStale, shareWhere]);
  const where = useMemo(
    () => ({
      ready: whereDoc.ready,
      mine: myWhere,
      theirs: them ? (whereDoc.doc.by[them] ?? null) : null,
      km: apartKm(whereDoc.doc, me, them),
      myZone: demoWhereRoom ? (myWhere?.tz ?? zone) : zone,
    }),
    [whereDoc.ready, whereDoc.doc, myWhere, me, them, demoWhereRoom, zone]
  );

  /* ---------- our list ---------- */

  const bucketDoc = useSharedDoc('bucket', normalizeBucket, demoBucket);
  const writeBucket = bucketDoc.write;
  const addWish = useCallback<TogetherValue['addWish']>(
    (text, next = false) => {
      const t = cleanText(text);
      if (!t) return;
      const id = newKey('wish-');
      const item = { id, text: t, by: me, at: Date.now(), next, done: 0, doneBy: '' };
      // (a long list loses its oldest done things first)
      const over = bucketOverflow({ items: { ...bucketDoc.doc.items, [id]: item } }).slice(0, BUCKET_MAX);
      writeBucket({ items: { [id]: item, ...Object.fromEntries(over.map((o) => [o, null])) } });
    },
    [me, bucketDoc.doc.items, writeBucket]
  );
  const tickWish = useCallback<TogetherValue['tickWish']>(
    (id, done) => writeBucket({ items: { [id]: { done: done ? Date.now() : 0, doneBy: done ? me : '' } } }),
    [me, writeBucket]
  );
  const starWish = useCallback<TogetherValue['starWish']>((id, next) => writeBucket({ items: { [id]: { next } } }), [writeBucket]);
  const dropWish = useCallback<TogetherValue['dropWish']>((id) => writeBucket({ items: { [id]: null } }), [writeBucket]);

  const value = useMemo<TogetherValue>(
    () => ({
      asksReady: asksDoc.ready,
      asks,
      ask,
      answerAsk,
      markAskSeen,
      withdrawAsk,
      myMood,
      theirMood,
      setMood,
      moodNews,
      markMoodSeen,
      sendTouch,
      touchNews,
      markTouchesSeen,
      lastSent,
      roomTouch,
      board: boardDoc.doc,
      wallNews,
      markWallSeen,
      pinned,
      hangArt,
      visit: visitDoc.doc,
      setVisit,
      snap,
      postSnap,
      hold,
      setHolding,
      about,
      saveAbout,
      where,
      shareWhere,
      bucket: bucketDoc.doc,
      addWish,
      tickWish,
      starWish,
      dropWish,
    }),
    [asksDoc.ready, asks, ask, answerAsk, markAskSeen, withdrawAsk, myMood, theirMood, setMood, moodNews, markMoodSeen, sendTouch, touchNews, markTouchesSeen, lastSent, roomTouch, boardDoc.doc, wallNews, markWallSeen, pinned, hangArt, visitDoc.doc, setVisit, snap, postSnap, hold, about, saveAbout, where, shareWhere, bucketDoc.doc, addWish, tickWish, starWish, dropWish]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useTogether() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTogether outside TogetherProvider');
  return v;
}
