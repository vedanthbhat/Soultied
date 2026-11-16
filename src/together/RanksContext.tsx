import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useGames } from '../games/GamesContext';
import * as store from '../cloud/store';
import { useSharedDoc } from './useSharedDoc';
import { loadSave } from '../escape/sync';
import type { RoomId } from '../escape/types';
import { DEFAULT_AVATAR_A, DEFAULT_AVATAR_B } from '../pixel/character';
import {
  type BestsDoc,
  type BoardId,
  type BoardRow,
  type RankEntry,
  type RankName,
  type RankStage,
  BOARD_LIMIT,
  bestsPatch,
  boardQuery,
  boardRows,
  demoBests,
  demoBoards,
  demoRanks,
  entryKey,
  escapePatch,
  normalizeBests,
  normalizeRanks,
  rankEntry,
} from './ranks';

/**
 * The couples board (see ranks.ts): saying yes to it together, your bests, and your line on it, kept up to date
 * while you're both on it. Online only (and in the demo room, with made-up couples); a place kept in just this
 * browser has nobody to compare with.
 */

interface RanksValue {
  /** the board works here (online, or the demo room) */
  available: boolean;
  stage: RankStage;
  name: RankName | null;
  bests: BestsDoc;
  /** say yes to the board under this name (your person says yes too before you're on it) */
  ask: (name: RankName) => void;
  /** your person asked: yes (you're both on it), or not now (neither of you is) */
  answer: (yes: boolean) => void;
  /** a new name on the board */
  rename: (name: RankName) => void;
  /** take the two of you off the board (and take back an ask) */
  leave: () => void;
  /** a way out of an escape room (kept if it's your fastest) */
  noteEscape: (room: RoomId, ms: number) => void;
  /** your line as it would be now (null without a name, or without your person) */
  mine: RankEntry | null;
  /** one of the boards, best first (null if it couldn't be fetched) */
  fetchBoard: (id: BoardId) => Promise<BoardRow[] | null>;
}

const Ctx = createContext<RanksValue | null>(null);

export const RanksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, partnerUser, space, today, cloudTarget, cloudMode, demo, togetherDays: together } = useApp();
  const { matches } = useGames();
  const me = currentUser.id;
  const them = partnerUser?.id || null;
  const sid = space?.id || 'solo';
  const isDemo = demo || sid === 'space-demo';

  const ranksDoc = useSharedDoc('ranks', normalizeRanks, () => demoRanks(them || 'user-rohan'));
  const bestsDoc = useSharedDoc('bests', normalizeBests, () => demoBests(Date.now()));
  const writeRanks = ranksDoc.write;
  const writeBests = bestsDoc.write;
  const ranks = ranksDoc.doc;
  const bests = bestsDoc.doc;
  const available = isDemo || cloudMode;

  const stage: RankStage = useMemo(() => {
    if (!ranks.name) return 'off';
    const mine = !!ranks.yes[me];
    const theirs = !!them && !!ranks.yes[them];
    return mine && theirs ? 'on' : mine ? 'asked' : theirs ? 'askedMe' : 'off';
  }, [ranks, me, them]);

  /** the line last written to the board (so it's only written again when something on it changes) */
  const published = useRef<string | null>(null);

  /* ---------- saying yes ---------- */

  const ask = useCallback<RanksValue['ask']>(
    (name) => {
      writeRanks({ yes: { [me]: Date.now() }, name: [name[0], name[1]] });
      // the demo room: Rohan says yes a moment later
      if (isDemo && them) window.setTimeout(() => writeRanks({ yes: { [them]: Date.now() } }), 2500);
    },
    [writeRanks, me, them, isDemo]
  );

  const leave = useCallback(() => {
    const yes: Record<string, null> = { [me]: null };
    if (them) yes[them] = null;
    for (const uid of Object.keys(ranks.yes)) yes[uid] = null;
    // (your yes goes first, so neither of you can put the line back up after it's gone)
    writeRanks({ yes });
    published.current = null;
    if (ranksDoc.mode === 'cloud') {
      const o = cloudTarget();
      if (o) store.dropRank(o.db, o.sid).catch((e) => console.warn('[soultied] the board', e));
    }
  }, [writeRanks, me, them, ranks.yes, ranksDoc.mode, cloudTarget]);

  const answer = useCallback<RanksValue['answer']>(
    (yes) => {
      if (yes) writeRanks({ yes: { [me]: Date.now() } });
      else leave();
    },
    [writeRanks, me, leave]
  );

  const rename = useCallback<RanksValue['rename']>((name) => writeRanks({ name: [name[0], name[1]] }), [writeRanks]);

  /* ---------- your bests ---------- */

  // a finished Kitchen Rush shift or Doodle Guess game that beats your best (only once your bests have arrived,
  // so an old copy never writes over a better one)
  const bestsSent = useRef('');
  useEffect(() => {
    if (!bestsDoc.ready) return;
    const p = bestsPatch(bests, { kitchen: matches.kitchen, doodle: matches.doodle }, Date.now());
    if (!p) return;
    const key = JSON.stringify(p);
    if (key === bestsSent.current) return;
    bestsSent.current = key;
    writeBests(p);
  }, [bestsDoc.ready, bests, matches.kitchen, matches.doodle, writeBests]);

  const noteEscape = useCallback<RanksValue['noteEscape']>(
    (room, ms) => {
      if (!bestsDoc.ready) return;
      const p = escapePatch(bestsDoc.doc, room, ms);
      if (p) writeBests(p);
    },
    [bestsDoc.ready, bestsDoc.doc, writeBests]
  );

  // escapes from before the board (kept in this browser): once, when your bests arrive
  const escapesSynced = useRef(false);
  useEffect(() => {
    if (!bestsDoc.ready || escapesSynced.current || isDemo || !cloudMode) return;
    escapesSynced.current = true;
    const best = loadSave(sid).best;
    const escape: Partial<Record<RoomId, number>> = {};
    for (const [room, ms] of Object.entries(best) as Array<[RoomId, number]>) {
      const p = escapePatch(bests, room, ms);
      if (p?.escape?.[room]) escape[room] = p.escape[room];
    }
    if (Object.keys(escape).length) writeBests({ escape });
  }, [bestsDoc.ready, bests, isDemo, cloudMode, sid, writeBests]);

  /* ---------- your line on the board ---------- */

  const hostIsMe = !space || space.creatorId === me;
  const myLook = currentUser.avatar;
  const theirLook = partnerUser?.avatar;
  const mine = useMemo<RankEntry | null>(() => {
    if (!ranks.name || !them) return null;
    const host = hostIsMe ? myLook : theirLook || DEFAULT_AVATAR_A;
    const guest = hostIsMe ? theirLook || DEFAULT_AVATAR_B : myLook;
    return rankEntry({ name: ranks.name, looks: [host, guest], couch: { seen: {}, together, shown: {} }, today, bests, now: Date.now() });
  }, [ranks.name, them, hostIsMe, myLook, theirLook, together, today, bests]);

  // while you're both on: write your line whenever what's on it changes
  useEffect(() => {
    if (stage !== 'on') {
      published.current = null;
      return;
    }
    if (ranksDoc.mode !== 'cloud' || !ranksDoc.ready || !bestsDoc.ready || !mine) return;
    const key = entryKey(mine);
    if (key === published.current) return;
    const o = cloudTarget();
    if (!o) return;
    published.current = key;
    store.writeRank(o.db, o.sid, mine).catch((e) => {
      published.current = null;
      console.warn('[soultied] the board', e);
    });
  }, [stage, ranksDoc.mode, ranksDoc.ready, bestsDoc.ready, mine, cloudTarget]);

  /* ---------- reading a board ---------- */

  const mineRef = useRef(mine);
  mineRef.current = mine;
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const fetchBoard = useCallback<RanksValue['fetchBoard']>(
    async (id) => {
      const now = Date.now();
      if (isDemo) {
        const rows: Array<{ id: string; data: unknown }> = demoBoards(today, now);
        if (stageRef.current === 'on' && mineRef.current) rows.push({ id: sid, data: mineRef.current });
        return boardRows(id, rows, sid, today, now);
      }
      const o = cloudTarget();
      if (!o) return null;
      const q = boardQuery(id);
      try {
        return boardRows(id, await store.fetchRanks(o.db, q.field, q.desc, BOARD_LIMIT), sid, today, now);
      } catch (e) {
        console.warn('[soultied] board', e);
        return null;
      }
    },
    [isDemo, today, sid, cloudTarget]
  );

  const value = useMemo<RanksValue>(
    () => ({ available, stage, name: ranks.name, bests, ask, answer, rename, leave, noteEscape, mine, fetchBoard }),
    [available, stage, ranks.name, bests, ask, answer, rename, leave, noteEscape, mine, fetchBoard]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useRanks(): RanksValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRanks needs RanksProvider');
  return v;
}
