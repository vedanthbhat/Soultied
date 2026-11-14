import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import { ChessMove, ChessState, Promo, capturedFrom, colorOf, emptyChess, kingSquare, legalMoves, seatColor, squareName } from '../../games/chess';
import { chessAnswer, chessMove, chessOffer, chessResign, newChess } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';
import { Sprite } from './Pixel';

/** the pieces, 9 × 10: o outline, x body, h a little light */
export const PIECES: Record<string, string[]> = {
  p: ['.........', '.........', '...ooo...', '..oxxxo..', '..oxhxo..', '...oxo...', '..oxxxo..', '.oxxxxxo.', '.ooooooo.', '.........'],
  n: ['.........', '....oo...', '...oxxo..', '..oxxxxo.', '.oxoxxxo.', 'oxxxxxxo.', '.oooxxxo.', '..oxxxxo.', '.oxxxxxxo', '.oooooooo'],
  b: ['....o....', '...oxo...', '..oxxxo..', '..oxoxo..', '..oxxxo..', '...oxo...', '...oxo...', '..oxxxo..', '.oxxxxxo.', '.ooooooo.'],
  r: ['.........', '.oo.o.oo.', '.oxoxoxo.', '.oxxxxxo.', '..oxxxo..', '..oxhxo..', '..oxxxo..', '.oxxxxxo.', '.ooooooo.', '.........'],
  q: ['o...o...o', '.o.oxo.o.', '.oxxxxxo.', '..oxxxo..', '..oxhxo..', '...oxo...', '..oxxxo..', '.oxxxxxo.', '.ooooooo.', '.........'],
  k: ['....o....', '...oxo...', '....o....', '.ooooooo.', '.oxxxxxo.', '..oxhxo..', '..oxxxo..', '..oxxxo..', '.oxxxxxo.', '.ooooooo.'],
};
export const PIECE_PAL: Record<'w' | 'b', Record<string, string>> = {
  w: { o: '#3a2a26', x: '#fbf3e2', h: '#e3d2b2' },
  b: { o: '#140d0a', x: '#5a3e30', h: '#8a6650' },
};

export const Piece: React.FC<{ p: string; size: number; style?: React.CSSProperties }> = ({ p, size, style }) => (
  <Sprite rows={PIECES[p.toLowerCase()]} pal={PIECE_PAL[colorOf(p) || 'w']} scale={size / 10} style={style} label={`${colorOf(p) === 'w' ? 'white' : 'black'} ${p.toLowerCase()}`} />
);

const LIGHT = '#efe0c2';
const DARK = '#a8784f';

export const ChessGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { matches, save, mySeat, seatName } = useGames();
  const m = (matches.chess as Match<ChessState> | undefined) || null;
  const them = otherSeat(mySeat);
  const partner = seatName(them);
  const st = m?.state ?? emptyChess(mySeat);
  const me = seatColor(st, mySeat);
  const myTurn = m?.status === 'playing' && m.turn === mySeat;
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<ChessMove | null>(null);
  const [resigning, setResigning] = useState(false);
  const legal = useMemo(() => (myTurn ? legalMoves(st) : []), [myTurn, st]);
  const targets = sel === null ? [] : legal.filter((mv) => mv.from === sel);

  // a sound for each move (lower for a capture), a warning for check, and a tune at the end
  const heard = useRef('');
  useEffect(() => {
    if (!m) return;
    const key = `${m.id}:${m.seq}`;
    if (!heard.current || heard.current.split(':')[0] !== m.id) {
      heard.current = key;
      return;
    }
    if (heard.current === key) return;
    heard.current = key;
    setSel(null);
    setPromo(null);
    if (m.status === 'over') {
      if (m.winner === mySeat) sfx.win();
      else if (m.winner === 'draw') [523, 523].forEach((f, i) => tone(f, 0.16, i * 0.18, 'triangle', 0.05));
      else sfx.wrong();
    } else if (m.state.check) [880, 660].forEach((f, i) => tone(f, 0.1, i * 0.1, 'square', 0.04));
    else if (/took/.test(m.last)) tone(330, 0.1, 0, 'square', 0.05);
    else tone(m.updatedBy === mySeat ? 620 : 520, 0.06, 0, 'triangle', 0.05);
  }, [m, mySeat]);

  const start = () => {
    setResigning(false);
    save(newChess(m && m.status === 'over' ? otherSeat(m.startedBy) : mySeat, m?.wins));
  };
  const play = (mv: ChessMove) => {
    if (!m) return;
    const next = chessMove(m, mySeat, mv);
    setSel(null);
    setPromo(null);
    if (next) save(next);
  };
  const tap = (sq: number) => {
    if (!m || !myTurn) return;
    const t = targets.filter((mv) => mv.to === sq);
    if (t.length) {
      if (t.length > 1) setPromo({ from: t[0].from, to: sq });
      else play(t[0]);
      return;
    }
    if (st.board[sq] !== '.' && colorOf(st.board[sq]) === me && legal.some((mv) => mv.from === sq)) setSel(sel === sq ? null : sq);
    else setSel(null);
  };

  // white at the bottom for whoever plays white
  const order = useMemo(() => [...Array(64).keys()].map((i) => (me === 'w' ? i : 63 - i)), [me]);
  const checked = st.check ? kingSquare(st.board, st.side) : -1;
  const offerFromThem = m?.status === 'playing' && st.offer === them;
  const offerFromMe = m?.status === 'playing' && st.offer === mySeat;

  let status: React.ReactNode;
  if (!m) status = <>Proper chess, a move whenever you’re here. Start a game and you play white; {partner} answers whenever they’re next in.</>;
  else if (m.status === 'over') {
    const how = st.end;
    if (m.winner === 'draw') status = <>{how === 'agreed' ? 'You agreed a draw.' : <>{m.updatedBy === mySeat ? 'You' : partner} {m.last}.</>}</>;
    else if (m.winner === mySeat) status = <><strong>{how === 'resigned' ? `${partner} resigned. You win!` : 'Checkmate. You win!'}</strong> {partner} will see it next time they look.</>;
    else status = <><strong>{how === 'resigned' ? 'You resigned' : `${partner} checkmated you`}</strong>{how === 'resigned' ? `, so ${partner} wins this one.` : ' and wins this one.'}</>;
  } else if (offerFromThem) status = <><strong>{partner} offered a draw.</strong> Take it, or play on.</>;
  else if (myTurn)
    status = (
      <>
        {m.seq > 0 && m.updatedBy === them ? `${partner} ${m.last}. ` : ''}
        <strong>{st.check ? 'You’re in check.' : 'Your move.'}</strong> {sel === null ? 'Tap one of your pieces.' : 'Tap where it goes.'}
        {offerFromMe ? ' (Your draw offer is waiting.)' : ''}
      </>
    );
  else
    status =
      m.updatedBy === mySeat && m.seq > 0 ? (
        <>
          You {m.last}. Now it’s <strong>{partner}’s move</strong>.
        </>
      ) : (
        <>
          Waiting for <strong>{partner}</strong> to move.
        </>
      );

  const taken = (c: 'w' | 'b') => capturedFrom(st.board, c);
  const row = (label: string, ps: string[]) => (
    <div className="flex items-center gap-1 flex-wrap text-sm opacity-90" style={{ minHeight: 26 }}>
      <span className="mr-1">{label}</span>
      {ps.length ? ps.map((p, i) => <Piece key={i} p={p} size={22} />) : <span className="opacity-60">nothing yet</span>}
    </div>
  );

  return (
    <GameFrame
      title="Chess"
      onBack={onBack}
      match={m}
      marker={(s) => <Piece p={seatColor(st, s) === 'w' ? 'K' : 'k'} size={26} />}
      status={status}
      width={720}
      actions={
        !m || m.status === 'over' ? (
          <button className="px-btn px-btn--sage" onClick={start}>
            {m ? 'Play again' : 'Start a game'}
          </button>
        ) : offerFromThem ? (
          <>
            <button className="px-btn px-btn--sage" onClick={() => { const n = chessAnswer(m, mySeat, true); if (n) save(n); }}>
              Take the draw
            </button>
            <button className="px-btn px-btn--paper" onClick={() => { const n = chessAnswer(m, mySeat, false); if (n) save(n); }}>
              Play on
            </button>
          </>
        ) : (
          <>
            {!st.offer && (
              <button className="px-btn px-btn--paper px-btn--small" onClick={() => { const n = chessOffer(m, mySeat); if (n) save(n); }}>
                Offer a draw
              </button>
            )}
            {resigning ? (
              <>
                <button className="px-btn px-btn--small" onClick={() => { const n = chessResign(m, mySeat); setResigning(false); if (n) save(n); }}>
                  Yes, resign
                </button>
                <button className="px-btn px-btn--paper px-btn--small" onClick={() => setResigning(false)}>
                  Keep playing
                </button>
              </>
            ) : (
              <button className="px-btn px-btn--paper px-btn--small" onClick={() => setResigning(true)}>
                Resign
              </button>
            )}
          </>
        )
      }
    >
      <div className="flex flex-col items-center gap-3">
        {row(`${partner} has taken:`, taken(me))}
        <div className="relative" style={{ width: 'min(100%, 520px)', aspectRatio: '1', padding: 6, background: '#6b4a2f', boxShadow: '0 0 0 4px #3b2a1e, inset 0 4px 0 #8a6342' }}>
          <div className="grid w-full h-full" style={{ gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)' }}>
            {order.map((sq, i) => {
              const r = Math.floor(sq / 8);
              const c = sq % 8;
              const light = (r + c) % 2 === 0;
              const p = st.board[sq];
              const target = targets.find((mv) => mv.to === sq);
              const lastMove = st.last && (st.last.from === sq || st.last.to === sq);
              const mine = p !== '.' && colorOf(p) === me && myTurn && legal.some((mv) => mv.from === sq);
              const can = !!target || mine;
              return (
                <button
                  key={sq}
                  type="button"
                  className="relative flex items-center justify-center border-0 p-0"
                  style={{
                    background: sq === checked ? '#d9644f' : lastMove ? (light ? '#ecd38a' : '#c9a35a') : light ? LIGHT : DARK,
                    boxShadow: sel === sq ? 'inset 0 0 0 4px #f1d27a' : undefined,
                    cursor: can ? 'pointer' : 'default',
                  }}
                  onClick={() => tap(sq)}
                  disabled={!can && sel === null}
                  aria-label={`${squareName(sq)}${p !== '.' ? `, ${colorOf(p) === 'w' ? 'white' : 'black'} ${p.toLowerCase() === 'n' ? 'knight' : { p: 'pawn', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[p.toLowerCase()]}` : ''}${target ? ': move here' : ''}`}
                >
                  {p !== '.' && (
                    <span style={{ width: '82%' }} className={st.last?.to === sq ? 'chess-land' : ''}>
                      <Piece p={p} size={40} style={{ width: '100%', height: 'auto' }} />
                    </span>
                  )}
                  {target && (
                    <span
                      className="absolute"
                      style={p !== '.' ? { inset: 3, boxShadow: 'inset 0 0 0 4px rgba(58,42,38,.45)' } : { width: '26%', height: '26%', background: 'rgba(58,42,38,.4)' }}
                    />
                  )}
                  {(me === 'w' ? c === 0 : c === 7) && <span className="absolute text-[10px] leading-none font-bold" style={{ top: 2, left: 3, color: light ? DARK : LIGHT }}>{8 - r}</span>}
                  {(me === 'w' ? r === 7 : r === 0) && <span className="absolute text-[10px] leading-none font-bold" style={{ bottom: 2, right: 3, color: light ? DARK : LIGHT }}>{'abcdefgh'[c]}</span>}
                </button>
              );
            })}
          </div>
          {promo && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(27,20,17,.6)' }}>
              <div className="px-box flex flex-col items-center gap-2 px-4 py-3" style={{ color: 'var(--ink-soft)' }}>
                <strong>Make your pawn a…</strong>
                <div className="flex gap-2">
                  {(['q', 'r', 'b', 'n'] as Promo[]).map((k) => (
                    <button key={k} type="button" className="px-btn px-btn--paper px-btn--small" onClick={() => play({ ...promo, promo: k })} aria-label={{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[k]}>
                      <Piece p={me === 'w' ? k.toUpperCase() : k} size={30} />
                    </button>
                  ))}
                </div>
                <button type="button" className="text-sm underline bg-transparent border-0" onClick={() => setPromo(null)}>
                  Not this move
                </button>
              </div>
            </div>
          )}
        </div>
        {row('You’ve taken:', taken(me === 'w' ? 'b' : 'w'))}
        <style>{`@keyframes chess-land { 0% { transform: translateY(-14%) scale(1.08); } 100% { transform: none; } } .chess-land { animation: chess-land .22s steps(3); }`}</style>
      </div>
    </GameFrame>
  );
};
