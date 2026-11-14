import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import { LUDO_HOME, LudoState, emptyLudo, homeCount, movable, rollD6, squareKind, tokenSpot, walk } from '../../games/ludo';
import { ludoMove, ludoRoll, newLudo } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';
import { Sprite } from './Pixel';

const PAWN = ['..ddd..', '.dLBBd.', '.dBBBd.', '..dBd..', '.dBBBd.', 'dBBBBBd', 'ddddddd'];
export const LUDO_COLORS: Record<Seat, { B: string; L: string; d: string; yard: string; path: string; name: string }> = {
  a: { B: '#e07a5f', L: '#f6c3a8', d: '#7a3022', yard: '#e9a58d', path: '#f2c4b2', name: 'coral' },
  b: { B: '#4fb896', L: '#c9f2e4', d: '#1f5a4a', yard: '#8fd3bd', path: '#bfe8da', name: 'green' },
};
const STAR = ['...y...', '..yyy..', 'yyyyyyy', '.yyyyy.', '.yy.yy.'];
const HEART = ['.hh.hh.', 'hHHhHHh', 'hHHHHHh', '.hHHHh.', '..hHh..', '...h...'];
const TREE = ['..ggg..', '.gGGGg.', 'gGGgGGg', '.gGGGg.', '..gtg..', '...t...'];

export const Pawn: React.FC<{ seat: Seat; size: number }> = ({ seat, size }) => {
  const c = LUDO_COLORS[seat];
  return <Sprite rows={PAWN} pal={{ B: c.B, L: c.L, d: c.d }} scale={size / 7} label={`${c.name} token`} />;
};

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/** a pixel die showing `n` */
const Die: React.FC<{ n: number | null; size: number; glow?: boolean }> = ({ n, size, glow }) => (
  <span
    className="grid"
    style={{
      width: size,
      height: size,
      gridTemplateColumns: 'repeat(3, 1fr)',
      padding: size * 0.14,
      gap: size * 0.06,
      background: '#fbf3e2',
      boxShadow: `0 0 0 3px #3a2a26, inset 0 -${Math.round(size / 12)}px 0 #d9c6a1${glow ? ', 0 0 18px rgba(241,210,122,.8)' : ''}`,
    }}
    aria-hidden
  >
    {[...Array(9).keys()].map((i) => (
      <span key={i} style={{ background: n && PIPS[n].includes(i) ? '#3a2a26' : 'transparent' }} />
    ))}
  </span>
);

const SQUARE_BG: Record<string, string> = {
  track: '#f4ead6',
  star: '#f4ead6',
  start: '#f4ead6',
  garden: '#7d8f62',
  middle: '#efe3cb',
};

/** a block of squares on the board (inside its 6px frame) */
const area = (r0: number, c0: number, n: number): React.CSSProperties => ({
  left: `calc(6px + ${c0 / 15} * (100% - 12px))`,
  top: `calc(6px + ${r0 / 15} * (100% - 12px))`,
  width: `calc(${n / 15} * (100% - 12px))`,
  height: `calc(${n / 15} * (100% - 12px))`,
});

/** turn the board round for the second seat, so your yard is always bottom-left */
const turn = (seat: Seat, r: number, c: number): [number, number] => (seat === 'a' ? [r, c] : [14 - r, 14 - c]);

export const LudoGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { matches, save, mySeat, seatName } = useGames();
  const m = (matches.ludo as Match<LudoState> | undefined) || null;
  const them = otherSeat(mySeat);
  const partner = seatName(them);
  const st = m?.state ?? emptyLudo();
  const myTurn = m?.status === 'playing' && m.turn === mySeat;
  const canRoll = myTurn && st.phase === 'roll';
  const choices = myTurn && st.phase === 'move' && st.dice ? movable(st, mySeat, st.dice) : [];

  // where each token is drawn: the match's, except while one walks round the board
  const [shown, setShown] = useState<Record<Seat, number[]>>(st.tokens);
  const [face, setFace] = useState<number | null>(st.dice);
  /** your roll, on its way */
  const [rolling, setRolling] = useState(false);
  /** their roll, landing */
  const [shaking, setShaking] = useState(false);
  const timers = useRef<number[]>([]);
  const rollTimers = useRef<number[]>([]);
  const heard = useRef('');
  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setShaking(false);
  };
  useEffect(
    () => () => {
      clear();
      rollTimers.current.forEach((t) => window.clearTimeout(t));
    },
    []
  );

  useEffect(() => {
    if (!m) return;
    const key = `${m.id}:${m.seq}`;
    if (heard.current === key) return;
    const first = !heard.current || heard.current.split(':')[0] !== m.id;
    heard.current = key;
    clear();
    const s = m.state;
    if (first || !s.moved) {
      setShown(s.tokens);
      // their roll: a little shake of the die first
      if (!first && s.dice && m.updatedBy !== mySeat) {
        setShaking(true);
        for (let i = 0; i < 6; i++) timers.current.push(window.setTimeout(() => setFace(1 + ((i * 7 + s.dice!) % 6)), i * 70));
        timers.current.push(
          window.setTimeout(() => {
            setShaking(false);
            setFace(s.dice);
            tone(880, 0.05, 0, 'square', 0.03);
          }, 450)
        );
      } else setFace(s.dice);
      if (!first && m.status === 'over') {
        if (m.winner === mySeat) sfx.win();
        else sfx.wrong();
      }
      return;
    }
    // a move: walk the token there a square at a time, then send anyone it landed on home
    const { seat, token, from, to } = s.moved;
    const steps = walk(from, to);
    setFace(s.dice);
    setShown((prev) => {
      const next = { a: [...prev.a], b: [...prev.b] };
      next[seat][token] = from;
      return next;
    });
    steps.forEach((p, i) =>
      timers.current.push(
        window.setTimeout(() => {
          setShown((prev) => {
            const next = { a: [...prev.a], b: [...prev.b] };
            next[seat][token] = p;
            return next;
          });
          tone(seat === mySeat ? 620 + i * 18 : 520 + i * 18, 0.05, 0, 'triangle', 0.04);
        }, 130 * (i + 1))
      )
    );
    timers.current.push(
      window.setTimeout(() => {
        setShown(s.tokens);
        if (s.sent) [392, 330, 262].forEach((f, i) => tone(f, 0.12, i * 0.08, 'square', 0.04));
        else if (to === LUDO_HOME) [659, 784, 988].forEach((f, i) => tone(f, 0.14, i * 0.09, 'triangle', 0.05));
        if (m.status === 'over') {
          if (m.winner === mySeat) sfx.win();
          else sfx.wrong();
        }
      }, 130 * (steps.length + 1))
    );
  }, [m, mySeat]);

  const start = (count: number) => save(newLudo(m && m.status === 'over' ? otherSeat(m.startedBy) : mySeat, m?.wins, count));
  const roll = () => {
    if (!m || !canRoll || rolling) return;
    const n = rollD6();
    setRolling(true);
    for (let i = 0; i < 7; i++) rollTimers.current.push(window.setTimeout(() => setFace(1 + ((i * 5 + n) % 6)), i * 75));
    rollTimers.current.push(
      window.setTimeout(() => {
        setRolling(false);
        setFace(n);
        tone(880, 0.05, 0, 'square', 0.03);
        const next = ludoRoll(m, mySeat, n);
        if (next) save(next);
      }, 560)
    );
  };
  const move = (token: number) => {
    if (!m || !choices.includes(token)) return;
    const next = ludoMove(m, mySeat, token);
    if (next) save(next);
  };

  // tokens sharing a square sit side by side
  const placed = useMemo(() => {
    const all: Array<{ seat: Seat; token: number; pos: number; r: number; c: number }> = [];
    (['a', 'b'] as Seat[]).forEach((seat) =>
      shown[seat].forEach((pos, token) => {
        const [r0, c0] = tokenSpot(seat, token, pos);
        const [r, c] = mySeat === 'a' ? [r0, c0] : [15 - r0, 15 - c0];
        all.push({ seat, token, pos, r, c });
      })
    );
    const groups = new Map<string, number[]>();
    all.forEach((t, i) => {
      if (t.pos === -1 || t.pos === LUDO_HOME) return;
      const k = `${t.r},${t.c}`;
      groups.set(k, [...(groups.get(k) || []), i]);
    });
    const shift: Record<number, [number, number, number]> = {};
    groups.forEach((ids) => {
      if (ids.length < 2) return;
      ids.forEach((id, j) => {
        const dx = ids.length === 2 ? (j === 0 ? -0.2 : 0.2) : (j % 2 ? 0.2 : -0.2);
        const dy = ids.length === 2 ? 0 : j < 2 ? -0.2 : 0.2;
        shift[id] = [dy, dx, 0.72];
      });
    });
    return all.map((t, i) => ({ ...t, dy: shift[i]?.[0] ?? 0, dx: shift[i]?.[1] ?? 0, k: shift[i]?.[2] ?? 1 }));
  }, [shown, mySeat]);

  const count = st.tokens.a.length;
  let status: React.ReactNode;
  if (!m) status = <>Race your tokens round the board and home. A six brings one out. Land on one of {partner}’s to send it back. Quick is two tokens each; full is four.</>;
  else if (m.status === 'over')
    status = m.winner === mySeat ? <><strong>All your tokens are home. You win!</strong> {partner} will see it next time they look.</> : <><strong>{partner} got all their tokens home</strong> and wins this one.</>;
  else if (myTurn && st.phase === 'move')
    status = (
      <>
        You rolled a {st.dice}. <strong>Tap a token to move it.</strong>
        {st.dice === 6 ? ' A six means you roll again after.' : ''}
      </>
    );
  else if (myTurn)
    status = (
      <>
        {m.updatedBy === them && m.seq > 0 ? `${partner} ${m.last}. ` : m.updatedBy === mySeat && m.seq > 0 && st.moved ? 'Roll again! ' : ''}
        <strong>Your turn.</strong> Roll the die.
      </>
    );
  else
    status =
      m.updatedBy === mySeat && m.seq > 0 ? (
        <>
          You {m.last}. Now it’s <strong>{partner}’s turn</strong>.
        </>
      ) : (
        <>
          <strong>{partner}</strong> {m.seq > 0 && m.updatedBy === them && st.phase === 'move' ? `rolled a ${st.dice} and is choosing a token.` : 'is taking their turn.'}
        </>
      );

  return (
    <GameFrame
      title="Ludo"
      onBack={onBack}
      match={m}
      marker={(s) => <Pawn seat={s} size={22} />}
      status={status}
      width={720}
      actions={
        !m || m.status === 'over' ? (
          <>
            <button className="px-btn px-btn--sage" onClick={() => start(2)}>
              {m ? 'Quick game again' : 'Quick game · two each'}
            </button>
            <button className="px-btn px-btn--paper" onClick={() => start(4)}>
              {m ? 'Full game again' : 'Full game · four each'}
            </button>
          </>
        ) : null
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative"
          style={{ width: 'min(100%, 540px)', aspectRatio: '1', padding: 6, background: '#6b4a2f', boxShadow: '0 0 0 4px #3b2a1e, inset 0 4px 0 #8a6342' }}
        >
          <div className="grid w-full h-full" style={{ gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)', gap: 1, background: '#6b4a2f' }}>
            {[...Array(225).keys()].map((i) => {
              const [R, C] = turn(mySeat, Math.floor(i / 15), i % 15);
              const kind = squareKind(R, C);
              const owner: Seat | null = kind.endsWith('-a') ? 'a' : kind.endsWith('-b') ? 'b' : null;
              const bg = kind.startsWith('yard') ? LUDO_COLORS[owner!].yard : kind.startsWith('path') ? LUDO_COLORS[owner!].path : kind.startsWith('start-') ? LUDO_COLORS[owner!].B : SQUARE_BG[kind];
              return (
                <span key={i} className="relative flex items-center justify-center overflow-hidden" style={{ background: bg }}>
                  {(kind === 'star' || kind === 'start') && <Sprite rows={STAR} pal={{ y: '#d9a441' }} scale={2} style={{ width: '62%', height: 'auto' }} />}
                </span>
              );
            })}
          </div>
          {/* the yards, the gardens and the heart in the middle, as solid blocks over the squares */}
          {(['a', 'b'] as Seat[]).map((s) => {
            const [r0, c0] = s === mySeat ? [9, 0] : [0, 9];
            return (
              <span key={s} className="absolute flex items-center justify-center" style={{ ...area(r0, c0, 6), background: LUDO_COLORS[s].yard, boxShadow: `inset 0 0 0 3px ${LUDO_COLORS[s].d}` }}>
                <span style={{ width: '66.7%', height: '66.7%', background: '#fbf3e2', boxShadow: `inset 0 0 0 3px ${LUDO_COLORS[s].d}, inset 0 -6px 0 rgba(0,0,0,.08)` }} />
              </span>
            );
          })}
          {[[0, 0], [9, 9]].map(([r0, c0]) => (
            <span key={r0} className="absolute flex items-center justify-center" style={{ ...area(r0, c0, 6), background: '#7d8f62', boxShadow: 'inset 0 0 0 3px #4e6a3c' }}>
              <Sprite rows={TREE} pal={{ g: '#4e6a3c', G: '#9ab46e', t: '#6b4a2f' }} scale={6} style={{ width: '46%', height: 'auto' }} />
            </span>
          ))}
          <span className="absolute flex items-center justify-center" style={{ ...area(6, 6, 3), background: '#efe3cb', boxShadow: 'inset 0 0 0 3px #6b4a2f' }}>
            <Sprite rows={HEART} pal={{ h: '#8f3b2a', H: '#e07a5f' }} scale={6} style={{ width: '62%', height: 'auto', opacity: 0.8 }} />
          </span>
          {placed.map((t) => {
            const pick = t.seat === mySeat && choices.includes(t.token);
            return (
              <button
                key={`${t.seat}${t.token}`}
                type="button"
                className={`absolute border-0 p-0 bg-transparent flex items-center justify-center ${pick ? 'game-blink' : ''}`}
                style={{
                  left: `calc(6px + ${(t.c + t.dx) / 15} * (100% - 12px))`,
                  top: `calc(6px + ${(t.r + t.dy) / 15} * (100% - 12px))`,
                  width: `calc(${(t.pos === LUDO_HOME ? 0.62 : 0.86 * t.k) / 15} * (100% - 12px))`,
                  transform: 'translate(-50%, -58%)',
                  transition: 'left .12s steps(3), top .12s steps(3)',
                  cursor: pick ? 'pointer' : 'default',
                  filter: pick ? 'drop-shadow(0 0 6px rgba(255,236,170,.95))' : 'drop-shadow(0 2px 0 rgba(0,0,0,.25))',
                  zIndex: pick ? 3 : 2,
                }}
                disabled={!pick}
                onClick={() => move(t.token)}
                aria-label={`${t.seat === mySeat ? 'Your' : `${partner}’s`} token ${t.token + 1}${t.pos === -1 ? ', in the yard' : t.pos === LUDO_HOME ? ', home' : ''}${pick ? ': move it' : ''}`}
              >
                <span style={{ width: '100%' }}>
                  <Sprite rows={PAWN} pal={{ B: LUDO_COLORS[t.seat].B, L: LUDO_COLORS[t.seat].L, d: LUDO_COLORS[t.seat].d }} scale={4} style={{ width: '100%', height: 'auto' }} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <button
            type="button"
            className={`border-0 p-0 bg-transparent flex flex-col items-center gap-2 ${canRoll && !rolling ? 'game-turn' : ''}`}
            onClick={roll}
            disabled={!canRoll || rolling}
            style={{ cursor: canRoll && !rolling ? 'pointer' : 'default', color: '#efe3cb' }}
            aria-label={canRoll ? 'Roll the die' : face ? `The die shows ${face}` : 'The die'}
          >
            <span style={{ transform: rolling || shaking ? `rotate(${(face || 1) * 9 - 30}deg)` : undefined }}>
              <Die n={face} size={64} glow={canRoll && !rolling} />
            </span>
            <span className="text-sm font-bold">{canRoll ? (rolling ? 'Rolling…' : 'Roll') : ' '}</span>
          </button>
          {m && (
            <div className="text-sm opacity-85 leading-snug">
              {count === 2 ? 'Quick game' : 'Full game'} · home: you {homeCount(st, mySeat)} of {count}, {partner} {homeCount(st, them)} of {count}
            </div>
          )}
        </div>
      </div>
    </GameFrame>
  );
};
