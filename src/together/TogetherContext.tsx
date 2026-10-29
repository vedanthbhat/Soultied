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
  pinned: (kind: 'text' | 'doodle' | 'photo') => void;
  /** hang a doodle or photo in the frame over the couch (null takes it down) */
  hangArt: (art: WallArt | null) => void;
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
  const { currentUser, partnerUser, addActivity } = useApp();
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
  const pinned = useCallback<TogetherValue['pinned']>((kind) => writeBoard({ last: { [me]: { at: Date.now(), kind } } }), [me, writeBoard]);
  const hangArt = useCallback<TogetherValue['hangArt']>((art) => writeBoard({ art: art ? { ...art } : null }), [writeBoard]);

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
    }),
    [asksDoc.ready, asks, ask, answerAsk, markAskSeen, withdrawAsk, myMood, theirMood, setMood, moodNews, markMoodSeen, sendTouch, touchNews, markTouchesSeen, lastSent, roomTouch, boardDoc.doc, wallNews, markWallSeen, pinned, hangArt]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useTogether() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTogether outside TogetherProvider');
  return v;
}
