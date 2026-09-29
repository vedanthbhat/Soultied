import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import * as store from '../cloud/store';
import type { UserProfile } from '../types';
import type { GameKind, Match, Seat } from './types';
import { GAMES, otherSeat } from './types';
import { botAct, botDelay, botTurn, endLine, needsMe } from './registry';

export const GAME_KINDS: GameKind[] = ['fireflies', 'boats', 'doodle'];

type Matches = Partial<Record<GameKind, Match>>;

interface GamesValue {
  /** there's someone to play with */
  ready: boolean;
  mySeat: Seat;
  seatUser: (s: Seat) => UserProfile | null;
  seatName: (s: Seat) => string;
  matches: Matches;
  save: (m: Match) => void;
  /** games waiting on you: your move, boats to hide, or a drawing to guess */
  waiting: GameKind[];
}

const Ctx = createContext<GamesValue | null>(null);

const localKey = (sid: string) => `soultied_games_${sid}`;

function loadLocal(sid: string): Matches {
  try {
    const raw = localStorage.getItem(localKey(sid));
    return raw ? (JSON.parse(raw) as Matches) : {};
  } catch {
    return {};
  }
}

/**
 * Every game's current match, kept in sync with your person: through
 * Firestore when your place is online, in this browser otherwise (the demo
 * room, where a pretend partner takes their turns).
 */
export const GamesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, partnerUser, space, cloudMode, cloudTarget, demo, addActivity } = useApp();
  const sid = space?.id || 'solo';
  const creatorIsMe = !space || space.creatorId === currentUser.id;
  const mySeat: Seat = creatorIsMe ? 'a' : 'b';
  const partnerName = partnerUser?.name || space?.partnerPlaceholderName || 'your person';

  const [matches, setMatches] = useState<Matches>(() => (cloudMode ? {} : loadLocal(sid)));
  const matchesRef = useRef(matches);
  matchesRef.current = matches;

  /* ---------- online: one document per game ---------- */
  useEffect(() => {
    if (!cloudMode) return;
    const o = cloudTarget();
    if (!o) return;
    setMatches({});
    const offs = GAME_KINDS.map((kind) =>
      store.subscribeGame(o.db, o.sid, kind, (m) =>
        setMatches((prev) => {
          const cur = prev[kind];
          // ignore an older copy arriving after our own newer move
          if (m && cur && cur.id === m.id && cur.seq > m.seq) return prev;
          const next = { ...prev };
          if (m) next[kind] = m;
          else delete next[kind];
          return next;
        })
      )
    );
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMode, sid, currentUser.id]);

  /* ---------- this browser: saved locally, shared between tabs ---------- */
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (cloudMode) return;
    setMatches(loadLocal(sid));
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`soultied-games-${sid}`) : null;
    bcRef.current = bc;
    if (bc) bc.onmessage = () => setMatches(loadLocal(sid));
    return () => {
      bc?.close();
      bcRef.current = null;
    };
  }, [cloudMode, sid]);

  const seatUser = useCallback((s: Seat) => (s === mySeat ? currentUser : partnerUser || null), [mySeat, currentUser, partnerUser]);
  const seatName = useCallback((s: Seat) => (s === mySeat ? currentUser.name : partnerName), [mySeat, currentUser.name, partnerName]);

  /** Store a move (made by `writer`) and, if it ended the game, count the win and note it in the activity feed. */
  const commit = useCallback(
    (m0: Match, writer: Seat) => {
      const prev = matchesRef.current[m0.kind];
      let m: Match = { ...m0, updatedAt: Date.now(), updatedBy: writer, seq: prev && prev.id === m0.id ? prev.seq + 1 : 0 };
      const justEnded = m.status === 'over' && !(prev && prev.id === m.id && prev.status === 'over');
      if (justEnded && m.winner && m.winner !== 'draw') m = { ...m, wins: { ...m.wins, [m.winner]: (m.wins[m.winner] || 0) + 1 } };
      matchesRef.current = { ...matchesRef.current, [m.kind]: m };
      setMatches((p) => ({ ...p, [m.kind]: m }));
      const o = cloudMode ? cloudTarget() : null;
      if (o) store.writeGame(o.db, o.sid, m).catch((e) => console.warn('[soultied] game', e));
      else {
        try {
          localStorage.setItem(localKey(sid), JSON.stringify({ ...loadLocal(sid), [m.kind]: m }));
        } catch {
          // ignore
        }
        bcRef.current?.postMessage('changed');
      }
      if (justEnded) {
        const game = GAMES[m.kind].name;
        addActivity({ type: 'played_game', title: game, description: endLine(m, seatName, game) });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloudMode, sid, seatName]
  );
  const save = useCallback((m: Match) => commit(m, mySeat), [commit, mySeat]);

  /* ---------- the demo room's pretend partner takes their turns ---------- */
  const botTimers = useRef(new Map<string, number>());
  useEffect(() => {
    if (!demo || !partnerUser) return;
    const bot = otherSeat(mySeat);
    for (const kind of GAME_KINDS) {
      const m = matches[kind];
      if (!m || !botTurn(m, bot)) continue;
      const key = `${kind}:${m.id}:${m.seq}`;
      if (botTimers.current.has(key)) continue;
      const t = window.setTimeout(
        () => {
          botTimers.current.delete(key);
          const cur = matchesRef.current[kind];
          if (!cur || cur.id !== m.id || cur.seq !== m.seq) return;
          const next = botAct(cur, bot);
          if (next) commit(next, bot);
        },
        botDelay(m, bot)
      );
      botTimers.current.set(key, t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, demo, partnerUser, mySeat, commit]);
  useEffect(() => {
    const timers = botTimers.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const ready = !!partnerUser;
  const waiting = useMemo(() => (ready ? GAME_KINDS.filter((k) => needsMe(matches[k], mySeat)) : []), [ready, matches, mySeat]);

  const value = useMemo<GamesValue>(
    () => ({ ready, mySeat, seatUser, seatName, matches, save, waiting }),
    [ready, mySeat, seatUser, seatName, matches, save, waiting]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useGames() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useGames outside GamesProvider');
  return v;
}
