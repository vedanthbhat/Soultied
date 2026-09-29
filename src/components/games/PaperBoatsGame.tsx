import React, { useEffect, useRef, useState } from 'react';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import { Boat, BoatsState, FLEET, SIZE, boatAt, canPlace, coordName, randomFleet, sunkBoats } from '../../games/boats';
import { boatsReady, boatsShot, newBoats } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';
import { PixelArt, Sprite } from './Pixel';

const HIT = ['...r...', '.r.o.r.', '..ror..', 'roowoor', '..ror..', '.r.o.r.', '...r...'];
const MISS = ['..www..', '.w...w.', 'w.....w', 'w..w..w', 'w.....w', '.w...w.', '..www..'];

/** A folded paper boat, drawn across `len` cells (9 pixels each). */
const PaperBoat: React.FC<{ boat: Boat; soggy?: boolean }> = ({ boat, soggy }) => {
  const w = boat.len * 9;
  const c = soggy
    ? { hull: '#8f8676', shade: '#7a7263', dark: '#645d51', sail: '#9c9383', edge: '#4d473e' }
    : { hull: '#efe3cb', shade: '#d8c7a4', dark: '#bfae8c', sail: '#f7eedb', edge: '#8f7f64' };
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `calc(var(--p) * ${boat.x})`,
        top: `calc(var(--p) * ${boat.y})`,
        width: `calc(var(--p) * ${boat.len})`,
        height: 'var(--p)',
        transformOrigin: 'top left',
        transform: boat.down ? 'translateX(var(--p)) rotate(90deg)' : undefined,
      }}
    >
      <PixelArt
        w={w}
        h={9}
        scale={1}
        style={{ width: '100%', height: '100%' }}
        deps={[boat.len, soggy]}
        paint={(px) => {
          // hull, narrowing towards the keel
          px(1, 4, w - 2, 1, c.edge);
          px(1, 5, w - 2, 1, c.hull);
          px(2, 6, w - 4, 1, c.shade);
          px(3, 7, w - 6, 1, c.dark);
          px(3, 8, w - 6, 1, c.edge);
          // one folded sail per three cells
          const sails = Math.max(1, Math.round(boat.len / 2));
          for (let s = 0; s < sails; s++) {
            const cx = Math.round(((s + 0.5) * w) / sails);
            for (let k = 0; k < 4; k++) px(cx - k, 1 + k, k + 1, 1, k % 2 ? c.sail : c.shade);
            px(cx, 0, 1, 5, c.edge);
          }
        }}
      />
    </div>
  );
};

const Pond: React.FC<{
  label: string;
  boats: Boat[];
  soggy?: Boat[];
  shots: string;
  last: number | null;
  canAim?: (cell: number) => boolean;
  onCell?: (cell: number) => void;
}> = ({ label, boats, soggy = [], shots, last, canAim, onCell }) => {
  const [aim, setAim] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2 items-center min-w-0">
      <div className="font-bold text-lg">{label}</div>
      <div className="flex" style={{ ['--p' as string]: 'clamp(28px, 9vw, 42px)' } as React.CSSProperties}>
        {/* 1..8 down the side */}
        <div className="flex flex-col pt-[calc(var(--p)*0.6)] text-sm opacity-70" aria-hidden="true">
          {[...Array(SIZE).keys()].map((y) => (
            <span key={y} className="flex items-center justify-end pr-1.5" style={{ height: 'var(--p)' }}>
              {y + 1}
            </span>
          ))}
        </div>
        <div>
          {/* A..H across the top */}
          <div className="flex text-sm opacity-70" style={{ height: 'calc(var(--p) * 0.6)' }} aria-hidden="true">
            {'ABCDEFGH'.split('').map((l) => (
              <span key={l} className="flex items-end justify-center" style={{ width: 'var(--p)' }}>
                {l}
              </span>
            ))}
          </div>
          <div
            className="relative"
            style={{
              width: 'calc(var(--p) * 8)',
              height: 'calc(var(--p) * 8)',
              background: '#3d6d84',
              boxShadow: '0 0 0 4px #2b4e60',
              backgroundImage:
                'linear-gradient(#35607399 1px, transparent 1px), linear-gradient(90deg, #35607399 1px, transparent 1px)',
              backgroundSize: 'var(--p) var(--p)',
            }}
            onMouseLeave={() => setAim(null)}
          >
            {soggy.map((b, i) => (
              <PaperBoat key={`s${i}`} boat={b} soggy />
            ))}
            {boats.map((b, i) => (
              <PaperBoat key={`b${i}`} boat={b} />
            ))}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: 'repeat(8, var(--p))', gridTemplateRows: 'repeat(8, var(--p))' }}>
              {[...Array(SIZE * SIZE).keys()].map((i) => {
                const mark = shots[i];
                const aimable = !!canAim?.(i);
                const inner = (
                  <>
                    {mark === 'x' && <Sprite rows={HIT} pal={{ r: '#c4453f', o: '#f39a5a', w: '#fff1c2' }} scale={1} style={{ width: '62%', height: 'auto' }} />}
                    {mark === 'o' && <Sprite rows={MISS} pal={{ w: '#dcecf2' }} scale={1} style={{ width: '56%', height: 'auto', opacity: 0.85 }} />}
                  </>
                );
                const style: React.CSSProperties = {
                  outline: aim === i && aimable ? '3px solid #fff4c2' : last === i ? '2px solid #f1d27a' : undefined,
                  outlineOffset: -3,
                };
                return onCell ? (
                  <button
                    key={i}
                    type="button"
                    className={`flex items-center justify-center border-0 p-0 bg-transparent ${last === i ? 'game-blink' : ''}`}
                    style={{ ...style, cursor: aimable ? 'crosshair' : 'default' }}
                    disabled={!aimable}
                    aria-label={`${coordName(i)}${mark === 'x' ? ', hit' : mark === 'o' ? ', water' : ''}`}
                    onMouseEnter={() => setAim(i)}
                    onFocus={() => setAim(i)}
                    onClick={() => onCell(i)}
                  >
                    {inner}
                  </button>
                ) : (
                  <span key={i} className={`flex items-center justify-center ${last === i ? 'game-blink' : ''}`} style={style}>
                    {inner}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PaperBoatsGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { matches, save, mySeat, seatName } = useGames();
  const m = (matches.boats as Match<BoatsState> | undefined) || null;
  const them: Seat = otherSeat(mySeat);
  const partner = seatName(them);
  const [draft, setDraft] = useState<Boat[]>(() => randomFleet());
  const [note, setNote] = useState<string | null>(null);

  const myFleet = m?.state.fleets[mySeat];
  const theirFleet = m?.state.fleets[them];
  const settingUp = m?.status === 'setup' && !myFleet;
  const myTurn = m?.status === 'playing' && m.turn === mySeat;
  const myShots = m?.state.shots[mySeat] ?? '.'.repeat(SIZE * SIZE);
  const theirShots = m?.state.shots[them] ?? '.'.repeat(SIZE * SIZE);
  const theirSunk = sunkBoats(theirFleet, myShots);
  const mySunk = sunkBoats(myFleet, theirShots);
  const last = m?.state.lastShot || null;

  // sounds for each guess
  const heard = useRef('');
  useEffect(() => {
    if (!m) return;
    const key = `${m.id}:${m.seq}`;
    if (!heard.current || heard.current === key) {
      heard.current = key;
      return;
    }
    heard.current = key;
    const ls = m.state.lastShot;
    if (m.status === 'over') {
      if (m.winner === mySeat) sfx.win();
      else sfx.wrong();
      return;
    }
    if (!ls) return;
    const hit = m.state.shots[ls.by][ls.cell] === 'x';
    if (hit) [330, 220].forEach((f, i) => tone(f, 0.12, i * 0.08, 'square', 0.04));
    else tone(880, 0.14, 0, 'sine', 0.04);
  }, [m, mySeat]);

  useEffect(() => {
    if (!note) return;
    const t = window.setTimeout(() => setNote(null), 2600);
    return () => window.clearTimeout(t);
  }, [note]);

  const turnBoat = (cell: number) => {
    const b = boatAt(draft, cell);
    if (!b) return;
    const rest = draft.filter((o) => o !== b);
    const turned = { ...b, down: !b.down };
    if (canPlace(rest, turned)) setDraft([...rest, turned]);
    else setNote('No room to turn that one here. Try Shuffle.');
  };

  let status: React.ReactNode;
  if (!m) status = <>Hide four paper boats on your pond. {partner} hides theirs, then you take turns guessing where the other’s are. Say your guesses out loud if you’re on a call.</>;
  else if (m.status === 'over')
    status =
      m.winner === mySeat ? (
        <>
          <strong>You sank all of {partner}’s boats. You win!</strong>
        </>
      ) : (
        <>
          <strong>{partner} sank all your boats</strong> and wins this one.
        </>
      );
  else if (settingUp)
    status = (
      <>
        <strong>Hide your boats.</strong> Shuffle until you like it, tap a boat to turn it, then hide them.
        {theirFleet ? ` ${partner} has already hidden theirs.` : ''}
      </>
    );
  else if (m.status === 'setup') status = <>Your boats are hidden. Waiting for {partner} to hide theirs.</>;
  else if (myTurn)
    status =
      m.updatedBy === them && m.last !== 'hid their boats' ? (
        <>
          {partner} {m.last}. <strong>Your turn:</strong> pick a spot on their pond.
        </>
      ) : (
        <>
          Both ponds are ready. <strong>You go first:</strong> pick a spot on {partner}’s pond.
        </>
      );
  else
    status =
      m.updatedBy === mySeat && m.last !== 'hid their boats' ? (
        <>
          You {m.last}. Now it’s <strong>{partner}’s turn</strong>.
        </>
      ) : (
        <>
          Both ponds are ready. <strong>{partner} goes first.</strong>
        </>
      );

  const actions = (() => {
    if (!m || m.status === 'over')
      return (
        <button className="px-btn px-btn--sage" onClick={() => save(newBoats(mySeat, m?.wins))}>
          {m ? 'Play again' : 'Start a game'}
        </button>
      );
    if (settingUp)
      return (
        <>
          <button className="px-btn px-btn--paper" onClick={() => setDraft(randomFleet())}>
            Shuffle
          </button>
          <button
            className="px-btn px-btn--sage"
            onClick={() => {
              const next = boatsReady(m, mySeat, draft);
              if (next) save(next);
            }}
          >
            Hide my boats
          </button>
        </>
      );
    return null;
  })();

  const left = (sunk: number) => `${FLEET.length - sunk} of ${FLEET.length} boats afloat`;

  return (
    <GameFrame title="Paper Boats" onBack={onBack} match={m} status={status} actions={actions} width={1020}>
      {note && (
        <div className="px-box px-3 py-1.5 text-sm self-center" style={{ color: 'var(--ink-soft)' }} role="status">
          {note}
        </div>
      )}
      {!m || settingUp || m.status === 'setup' ? (
        <div className="flex justify-center">
          <Pond
            label="Your pond"
            boats={settingUp || !myFleet ? draft : myFleet}
            shots={'.'.repeat(SIZE * SIZE)}
            last={null}
            canAim={settingUp ? (i) => !!boatAt(draft, i) : undefined}
            onCell={settingUp ? turnBoat : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-x-10 gap-y-6">
          <div className="flex flex-col items-center gap-1">
            <Pond
              label={`${partner}’s pond`}
              boats={m.status === 'over' ? (theirFleet || []).filter((b) => !theirSunk.includes(b)) : []}
              soggy={theirSunk}
              shots={myShots}
              last={last && last.by === mySeat ? last.cell : null}
              canAim={(i) => myTurn && myShots[i] === '.'}
              onCell={(i) => {
                const next = boatsShot(m, mySeat, i);
                if (next) save(next);
              }}
            />
            <span className="text-sm opacity-80">{left(theirSunk.length)}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <Pond
              label="Your pond"
              boats={(myFleet || []).filter((b) => !mySunk.includes(b))}
              soggy={mySunk}
              shots={theirShots}
              last={last && last.by === them ? last.cell : null}
            />
            <span className="text-sm opacity-80">{left(mySunk.length)}</span>
          </div>
        </div>
      )}
      <p className="text-center text-sm opacity-75 m-0">
        Boats: one of 4, two of 3, one of 2. They never touch, not even at the corners.
      </p>
    </GameFrame>
  );
};

