import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useGames } from '../GamesContext';
import type { GameKind, Match, Seat } from '../types';
import { otherSeat } from '../types';
import { GameLink, type LinkMode, type PlayWire } from './link';
import { COUNTDOWN_MS, type LiveDef, type LiveLobby, type LiveResult, liveCancel, liveFinish, liveJoin, liveStale, newLive, seeded } from './lobby';

/**
 * Running a live game for two.
 *
 * Whoever sent the invitation keeps the game (the "host"): their screen holds
 * the real state, applies both people's moves and tells the other screen what
 * happened. The other screen sends its moves and shows what it's told. Each
 * game only describes its rules (a LiveDef); this does the rest: the
 * invitation, the link, a three-second countdown, and writing down who won.
 *
 * In the demo room there's no one on the other end: the host is you, and the
 * game's own little bot plays for your pretend partner.
 */

export type { LiveDef } from './lobby';
export { COUNTDOWN_MS } from './lobby';
/** if the other person's screen goes quiet for this long mid-game, the game stops */
const ABANDON_MS = 25_000;

interface Snap<S> {
  k: 's';
  g: string;
  v: number;
  s: S;
  hn: number;
  startAt: number;
  end: LiveResult | null;
}
type Msg<S, A> = Snap<S> | { k: 'a'; a: A } | { k: 'need' };

interface Engine<S> {
  mid: string;
  g: string;
  v: number;
  s: S;
  startAt: number;
  end: LiveResult | null;
  phase: string;
}

export type LiveStage = 'idle' | 'inviting' | 'invited' | 'waiting' | 'count' | 'play' | 'over';

export interface LiveView<S> {
  s: S | null;
  /** when the countdown ends, by this screen's clock */
  startAt: number;
  end: LiveResult | null;
}

export function useLiveGame<S, A>(kind: GameKind, def: LiveDef<S, A>) {
  const { openLive, currentUser, demo } = useApp();
  const { matches, save, mySeat, seatName, ready } = useGames();
  const raw = (matches[kind] as Match<LiveLobby> | undefined) || null;
  const m = raw && !liveStale(raw) ? raw : null;
  const them = otherSeat(mySeat);
  const host = !!m && (demo || m.startedBy === mySeat);
  const mRef = useRef(m);
  mRef.current = m;
  const defRef = useRef(def);
  defRef.current = def;

  const [view, setView] = useState<LiveView<S>>({ s: null, startAt: 0, end: null });
  const [mode, setMode] = useState<LinkMode>('waiting');
  const [partnerHere, setPartnerHere] = useState(false);
  const eng = useRef<Engine<S> | null>(null);
  const guest = useRef<{ g: string; v: number; offset: number } | null>(null);
  const link = useRef<GameLink | null>(null);
  const goneSince = useRef(0);

  const playing = m?.status === 'playing';
  const mid = m?.id || '';

  // a new match: forget the last one
  useEffect(() => {
    eng.current = null;
    guest.current = null;
    setView({ s: null, startAt: 0, end: null });
  }, [mid]);

  /* ---------- the host's side ---------- */

  const share = useCallback((careful: boolean) => {
    const e = eng.current;
    const l = link.current;
    if (!e) return;
    setView({ s: e.s, startAt: e.startAt, end: e.end });
    if (!l) return;
    const snap: Snap<S> = { k: 's', g: e.g, v: e.v, s: e.s, hn: Date.now(), startAt: e.startAt, end: e.end };
    l.send(snap, !careful);
  }, []);

  const changed = useCallback(
    (next: S) => {
      const e = eng.current;
      if (!e || next === e.s) return;
      e.s = next;
      e.v += 1;
      const d = defRef.current;
      const r = d.result(next);
      const ph = d.phase ? d.phase(next) : '';
      const phaseMoved = ph !== e.phase;
      e.phase = ph;
      if (r) {
        e.end = r;
        share(true);
        const cur = mRef.current;
        const fin = cur && cur.id === e.mid ? liveFinish(cur, r) : null;
        if (fin) save(fin);
        return;
      }
      share(!d.continuous || phaseMoved);
    },
    [save, share]
  );

  const apply = useCallback(
    (seat: Seat, a: A) => {
      const e = eng.current;
      const now = Date.now();
      if (!e || e.end || now < e.startAt) return;
      changed(defRef.current.act(e.s, seat, a, now));
    },
    [changed]
  );

  // start the game once you're both here
  useEffect(() => {
    if (!m || !playing || !host || !ready) return;
    if (!demo && !partnerHere) return;
    if (eng.current && eng.current.mid === m.id) return;
    const now = Date.now();
    const s = defRef.current.init(seeded(m.state.seed), now);
    eng.current = {
      mid: m.id,
      g: `${m.id}:${Math.random().toString(36).slice(2, 7)}`,
      v: 1,
      s,
      startAt: now + COUNTDOWN_MS,
      end: null,
      phase: defRef.current.phase ? defRef.current.phase(s) : '',
    };
    share(true);
  }, [m, playing, host, ready, demo, partnerHere, share]);

  // time passing, and the demo partner
  useEffect(() => {
    if (!playing || !host) return;
    const d = defRef.current;
    const t = window.setInterval(() => {
      const e = eng.current;
      const dd = defRef.current;
      if (!e || e.end) return;
      const now = Date.now();
      if (now < e.startAt) return;
      if (dd.tick) changed(dd.tick(e.s, now));
      else if (dd.continuous) share(false);
    }, d.tickMs || 100);
    let b = 0;
    if (demo && d.bot) {
      b = window.setInterval(() => {
        const e = eng.current;
        const dd = defRef.current;
        if (!e || e.end || !dd.bot) return;
        const now = Date.now();
        if (now < e.startAt) return;
        const a = dd.bot(e.s, them, now);
        if (a !== null && a !== undefined) apply(them, a);
      }, d.botMs || 400);
    }
    return () => {
      window.clearInterval(t);
      if (b) window.clearInterval(b);
    };
  }, [playing, host, demo, them, changed, share, apply]);

  /* ---------- the link ---------- */

  const onMessage = useCallback(
    (raw: unknown) => {
      const msg = raw as Msg<S, A>;
      if (!msg || typeof msg !== 'object') return;
      if (msg.k === 'a') {
        if (host) apply(them, msg.a);
        return;
      }
      if (msg.k === 'need') {
        if (host && eng.current) share(true);
        return;
      }
      if (msg.k === 's' && !host) {
        const g = guest.current;
        if (g && g.g === msg.g && msg.v < g.v) return;
        const offset = Date.now() - msg.hn;
        guest.current = { g: msg.g, v: msg.v, offset };
        setView({ s: msg.s, startAt: msg.startAt + offset, end: msg.end });
      }
    },
    [host, them, apply, share]
  );
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!mid || !playing || demo || !ready) return;
    const l = new GameLink({
      chan: openLive<PlayWire>('play'),
      me: currentUser.id,
      seat: mySeat,
      mid,
      onMessage: (d) => onMessageRef.current(d),
      onChange: () => {
        setMode(l.mode);
        setPartnerHere(l.partnerHere);
      },
    });
    link.current = l;
    l.start();
    return () => {
      l.close();
      if (link.current === l) link.current = null;
      setPartnerHere(false);
      setMode('waiting');
    };
  }, [mid, playing, demo, ready, openLive, currentUser.id, mySeat]);

  // the other screen asks for the game until it has it
  useEffect(() => {
    if (host || !partnerHere || !playing) return;
    const ask = () => {
      if (!guest.current || !guest.current.g.startsWith(mid)) link.current?.send({ k: 'need' } as Msg<S, A>);
    };
    ask();
    const t = window.setInterval(ask, 2000);
    return () => window.clearInterval(t);
  }, [host, partnerHere, playing, mid]);

  // the host stops a game the other person walked away from
  useEffect(() => {
    if (!host || demo || !playing) return;
    if (partnerHere) {
      goneSince.current = 0;
      return;
    }
    goneSince.current = goneSince.current || Date.now();
    const t = window.setTimeout(() => {
      const cur = mRef.current;
      if (eng.current && !eng.current.end && cur && cur.status === 'playing' && !link.current?.partnerHere) {
        const c = liveCancel(cur);
        if (c) save(c);
      }
    }, ABANDON_MS);
    return () => window.clearTimeout(t);
  }, [host, demo, playing, partnerHere, save]);

  /* ---------- what you can do ---------- */

  const act = useCallback(
    (a: A, fast = false) => {
      if (host) apply(mySeat, a);
      else link.current?.send({ k: 'a', a } as Msg<S, A>, fast);
    },
    [host, apply, mySeat]
  );

  const invite = useCallback(() => save(newLive(kind, mySeat, raw?.wins)), [save, kind, mySeat, raw?.wins]);
  const join = useCallback(() => {
    const cur = mRef.current;
    const j = cur ? liveJoin(cur, mySeat) : null;
    if (j) save(j);
  }, [save, mySeat]);
  const cancel = useCallback(() => {
    const cur = mRef.current;
    const c = cur ? liveCancel(cur) : null;
    if (c) save(c);
  }, [save]);

  /** a time from the host's clock, on this screen's clock */
  const clock = useCallback((t: number) => (host ? t : t + (guest.current?.offset || 0)), [host]);

  let stage: LiveStage = 'idle';
  const result: LiveResult | null = view.end || (m?.status === 'over' ? m.state.result || null : null);
  if (m) {
    if (m.status === 'setup') stage = m.state.joined[mySeat] ? 'inviting' : 'invited';
    else if (m.status === 'over') stage = 'over';
    else if (view.end) stage = 'over';
    else if (view.s) stage = Date.now() < view.startAt ? 'count' : 'play';
    else stage = 'waiting';
  }

  return {
    m: raw,
    match: m,
    stage,
    host,
    mySeat,
    them,
    partner: seatName(them),
    ready,
    demo,
    mode,
    partnerHere: demo ? true : partnerHere,
    state: view.s,
    startAt: view.startAt,
    result,
    act,
    invite,
    join,
    cancel,
    clock,
  };
}

export type LiveGame<S, A> = ReturnType<typeof useLiveGame<S, A>>;
