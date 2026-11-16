import React, { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useRanks } from '../../together/RanksContext';
import { type BoardId, type BoardRow, type RankName, BOARD_LIMIT, ESCAPE_ROOMS, boardValue, rankName, suggestNames, valueText } from '../../together/ranks';
import type { RoomId } from '../../escape/types';
import { AvatarThumb } from '../PixelAvatarRenderer';
import { PixelIcon } from '../letters/PixelIcon';
import { GameShell } from './GameFrame';

/**
 * The couples board (shared with the iPhone's RanksViews.swift): the boards (the fire, Kitchen Rush and Doodle
 * Guess this week and ever, and each escape room), and going on them together. Nobody's on a board until both of
 * you say yes, and all it shows is your two characters, a couple name Soultied makes up, and the numbers.
 */

type Tab = 'fire' | 'kitchen' | 'doodle' | 'escape';
const TABS: Array<{ id: Tab; title: string }> = [
  { id: 'fire', title: 'The fire' },
  { id: 'kitchen', title: 'Kitchen Rush' },
  { id: 'doodle', title: 'Doodle Guess' },
  { id: 'escape', title: 'Escape rooms' },
];

const BLURB: Record<string, string> = {
  fire: 'Days in a row you’ve both shown up.',
  'kitchen-week': 'Most orders served in one shift, this week (from Monday).',
  'kitchen-all': 'Most orders served in one shift, ever.',
  'doodle-week': 'Most drawings guessed in one game, this week (from Monday).',
  'doodle-all': 'Most drawings guessed in one game, ever.',
  esc: 'Fastest way out, together.',
};

/** how to get onto a board you're not on yet */
const hint = (id: BoardId) =>
  id === 'fire'
    ? 'Both show up today and your fire starts.'
    : id.startsWith('kitchen')
    ? 'Play a shift of Kitchen Rush together.'
    : id.startsWith('doodle')
    ? 'Play a game of Doodle Guess together.'
    : 'Find your way out of this room together.';

const roomName = (r: RoomId) => r.charAt(0).toUpperCase() + r.slice(1);

const MEDAL: Record<number, string> = { 1: '#e2b359', 2: '#b9b3a8', 3: '#c98a5a' };

/** one couple on a board */
const Line: React.FC<{ r: BoardRow; at?: number }> = ({ r, at = 0 }) => (
  <li
    className="flex items-center gap-3 px-2 py-2 mo-in"
    style={{
      ['--mo-d' as string]: `${Math.min(at, 12) * 0.035}s`,
      background: r.mine ? '#fff1dc' : 'var(--paper-hi)',
      boxShadow: `inset 0 0 0 3px ${r.mine ? 'var(--terracotta)' : 'var(--paper-shade)'}`,
      color: 'var(--ink-soft)',
    }}
    aria-label={`Number ${r.rank}: ${r.name}${r.mine ? ', you two' : ''}, ${r.text}`}
  >
    <span
      className="w-8 h-8 shrink-0 flex items-center justify-center font-bold"
      style={{ background: MEDAL[r.rank] || 'transparent', color: MEDAL[r.rank] ? 'var(--ink)' : 'var(--muted)' }}
    >
      {r.rank}
    </span>
    <span className="flex gap-0.5 shrink-0" aria-hidden="true">
      <span style={{ background: 'var(--paper-2)' }}>
        <AvatarThumb config={r.looks[0]} region="head" size={32} />
      </span>
      <span style={{ background: 'var(--paper-2)' }}>
        <AvatarThumb config={r.looks[1]} region="head" size={32} />
      </span>
    </span>
    <span className="flex flex-col min-w-0 flex-1">
      <span className="font-bold leading-tight break-words">{r.name}</span>
      {r.mine && <span className="text-xs" style={{ color: 'var(--terracotta-d)' }}>You two</span>}
    </span>
    <span className="font-bold shrink-0">{r.text}</span>
  </li>
);

export const CouplesBoard: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { partnerUser, space, today } = useApp();
  const ranks = useRanks();
  const them = partnerUser?.name || space?.partnerPlaceholderName || 'your person';
  const [tab, setTab] = useState<Tab>('fire');
  const [week, setWeek] = useState(true);
  const [room, setRoom] = useState<RoomId>('attic');
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [names, setNames] = useState<RankName[]>([]);
  const [pick, setPick] = useState<RankName | null>(null);
  const [leaving, setLeaving] = useState(false);

  const board: BoardId = tab === 'fire' ? 'fire' : tab === 'escape' ? (`esc-${room}` as BoardId) : (`${tab}-${week ? 'week' : 'all'}` as BoardId);
  const { fetchBoard, stage } = ranks;

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) {
        setRows(null);
        setFailed(false);
      }
      const r = await fetchBoard(board);
      setFailed(r === null);
      if (r) setRows(r);
    },
    [board, fetchBoard]
  );

  useEffect(() => {
    load();
  }, [load]);

  // (your own line goes up a moment after you're both on, changes with your name, and comes off when you leave)
  const nameKey = ranks.name ? ranks.name.join('-') : '';
  useEffect(() => {
    const t = window.setTimeout(() => load(true), 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, nameKey]);

  /** three made-up names (none already on the board you're looking at) */
  const startChoosing = () => {
    const taken = new Set((rows || []).map((r) => r.name));
    const n = suggestNames(Math.random, 8, ranks.name ? [ranks.name] : [])
      .filter((x) => !taken.has(rankName(x)))
      .slice(0, 3);
    setNames(n);
    setPick(n[0] || null);
    setChoosing(true);
  };

  const chooser = (button: string, done: (n: RankName) => void) => (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Your couple name">
        {names.map((n) => {
          const on = !!pick && pick[0] === n[0] && pick[1] === n[1];
          return (
            <button
              key={`${n[0]}-${n[1]}`}
              role="radio"
              aria-checked={on}
              className={`px-btn px-btn--small ${on ? 'px-btn--sage' : 'px-btn--paper'} justify-between`}
              onClick={() => setPick(n)}
            >
              <span>{rankName(n)}</span>
              {on && <PixelIcon name="check" scale={2} />}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className="px-btn px-btn--paper px-btn--small" onClick={startChoosing}>
          Other names
        </button>
        <button className="px-btn px-btn--small" disabled={!pick} onClick={() => pick && done(pick)}>
          {button}
        </button>
      </div>
      <button className="px-link text-sm self-start" onClick={() => setChoosing(false)}>
        Cancel
      </button>
    </div>
  );

  const name = ranks.name ? rankName(ranks.name) : '';
  const join = (() => {
    if (!ranks.available) return <p className="m-0">The couples board is for places that are online. Sign in to go on it together.</p>;
    if (!partnerUser) return <p className="m-0">Once {them} moves in, you can go on the board together.</p>;
    if (stage === 'off')
      return (
        <>
          <p className="m-0 font-bold">Put the two of you on the board?</p>
          <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
            Only your two characters and a couple name show: no names, no photos, nothing you’ve written. You go on once you’ve both said yes.
          </p>
          {choosing ? (
            chooser(`Ask ${them}`, (n) => {
              ranks.ask(n);
              setChoosing(false);
            })
          ) : (
            <button className="px-btn px-btn--small self-start" onClick={startChoosing}>
              Pick our couple name
            </button>
          )}
        </>
      );
    if (stage === 'asked')
      return (
        <>
          <p className="m-0">
            Waiting for {them} to say yes to “{name}”.
          </p>
          <button className="px-btn px-btn--paper px-btn--small self-start" onClick={ranks.leave}>
            Take it back
          </button>
        </>
      );
    if (stage === 'askedMe')
      return (
        <>
          <p className="m-0 font-bold">
            {them} wants the two of you on the board as “{name}”.
          </p>
          <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
            Only your two characters and that name show: no names, no photos, nothing you’ve written.
          </p>
          <div className="grid grid-cols-2 gap-2 max-w-[420px]">
            <button className="px-btn px-btn--paper px-btn--small" onClick={() => ranks.answer(false)}>
              Not now
            </button>
            <button className="px-btn px-btn--small" onClick={() => ranks.answer(true)}>
              Yes, put us on
            </button>
          </div>
        </>
      );
    return (
      <>
        <p className="m-0 font-bold">You’re on the board as “{name}”.</p>
        {choosing ? (
          chooser('Use this name', (n) => {
            ranks.rename(n);
            setChoosing(false);
          })
        ) : leaving ? (
          <>
            <p className="m-0 text-sm" style={{ color: 'var(--muted)' }}>
              Your line comes off every board straight away, for both of you. You can go back on together any time.
            </p>
            <div className="grid grid-cols-2 gap-2 max-w-[420px]">
              <button className="px-btn px-btn--paper px-btn--small" onClick={() => setLeaving(false)}>
                Stay on
              </button>
              <button
                className="px-btn px-btn--small"
                onClick={() => {
                  ranks.leave();
                  setLeaving(false);
                }}
              >
                Take us off
              </button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-2 max-w-[420px]">
            <button className="px-btn px-btn--paper px-btn--small" onClick={startChoosing}>
              Change our name
            </button>
            <button className="px-btn px-btn--paper px-btn--small" onClick={() => setLeaving(true)}>
              Take us off
            </button>
          </div>
        )}
      </>
    );
  })();

  const mineValue = ranks.mine ? boardValue(board, ranks.mine as unknown as Record<string, unknown>, today, Date.now()) : null;

  return (
    <GameShell>
      <div className="mx-auto max-w-[760px] px-4 py-6 flex flex-col gap-5">
        <div>
          <button className="px-btn px-btn--paper px-btn--small" onClick={onBack}>
            ← All games
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex shrink-0 mo-twinkle">
            <PixelIcon name="trophy" scale={4} />
          </span>
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold m-0">Couples board</h1>
            <p className="m-0 mt-1 leading-snug opacity-85">How the two of you stack up against other couples on Soultied.</p>
          </div>
        </div>

        <div className="px-box px-4 py-3 flex flex-col gap-2" style={{ color: 'var(--ink-soft)' }}>
          {join}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Boards">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`px-btn px-btn--small ${tab === t.id ? '' : 'px-btn--paper'}`}
                onClick={() => setTab(t.id)}
              >
                {t.title}
              </button>
            ))}
          </div>
          {(tab === 'kitchen' || tab === 'doodle') && (
            <div className="flex gap-2">
              <button className={`px-btn px-btn--small ${week ? 'px-btn--sage' : 'px-btn--paper'}`} aria-pressed={week} onClick={() => setWeek(true)}>
                This week
              </button>
              <button className={`px-btn px-btn--small ${week ? 'px-btn--paper' : 'px-btn--sage'}`} aria-pressed={!week} onClick={() => setWeek(false)}>
                All time
              </button>
            </div>
          )}
          {tab === 'escape' && (
            <div className="flex gap-2 flex-wrap">
              {ESCAPE_ROOMS.map((r) => (
                <button key={r} className={`px-btn px-btn--small ${room === r ? 'px-btn--sage' : 'px-btn--paper'}`} aria-pressed={room === r} onClick={() => setRoom(r)}>
                  {roomName(r)}
                </button>
              ))}
            </div>
          )}
          <p className="m-0 text-sm opacity-80">{BLURB[board.startsWith('esc-') ? 'esc' : board]}</p>
        </div>

        {!ranks.available ? null : rows ? (
          <ul className="list-none m-0 p-0 flex flex-col gap-2">
            {rows.length === 0 && (
              <li className="px-box px-4 py-3" style={{ color: 'var(--muted)' }}>
                Nobody’s on this board yet.
              </li>
            )}
            {rows.map((r, i) => (
              <Line key={r.id} r={r} at={i} />
            ))}
            {stage === 'on' && !rows.some((r) => r.mine) && (
              <li className="px-4 py-3 flex flex-col" style={{ background: '#fff1dc', boxShadow: 'inset 0 0 0 3px var(--terracotta)', color: 'var(--ink-soft)' }}>
                <span className="font-bold">{mineValue !== null ? `You two: ${valueText(board, mineValue)}` : 'You two aren’t on this board yet'}</span>
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  {mineValue !== null ? `Not in the top ${BOARD_LIMIT} yet. Keep going!` : hint(board)}
                </span>
              </li>
            )}
          </ul>
        ) : failed ? (
          <div className="px-box px-4 py-3" style={{ color: '#7f3835' }}>
            The board didn’t load. Check your connection and try again.
          </div>
        ) : (
          <div className="px-4 py-6 opacity-70">Looking…</div>
        )}
      </div>
    </GameShell>
  );
};

/** the board on the games page: what's happening with it, and a way in */
export const CouplesBoardCard: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { partnerUser, space } = useApp();
  const { stage, name, available } = useRanks();
  if (!available || !partnerUser) return null;
  const them = partnerUser.name || space?.partnerPlaceholderName || 'Your person';
  const hot = stage === 'askedMe';
  const line =
    stage === 'askedMe'
      ? `${them} wants the two of you on the couples board as “${name ? rankName(name) : ''}”.`
      : stage === 'asked'
      ? `Waiting for ${them} to say yes to going on the board.`
      : stage === 'on'
      ? `You’re on it as “${name ? rankName(name) : ''}”.`
      : 'How do the two of you stack up? The fire, Kitchen Rush, Doodle Guess and the escape rooms, against other couples.';
  return (
    <button
      className={`px-box text-left border-0 px-4 py-3 flex items-center gap-4 ${hot ? 'game-turn' : ''}`}
      style={{ cursor: 'pointer', color: 'var(--ink-soft)' }}
      onClick={onOpen}
    >
      <span className={`inline-flex shrink-0 ${hot ? 'mo-nudge' : 'mo-twinkle'}`}>
        <PixelIcon name="trophy" scale={4} />
      </span>
      <span className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-xl font-bold leading-tight">Couples board</span>
          {hot && <span className="px-tag px-tag--sage">{them} asked</span>}
        </span>
        <span className="leading-snug" style={{ color: 'var(--muted)' }}>
          {line}
        </span>
      </span>
      <span className="font-bold shrink-0 hidden sm:inline">See the board →</span>
    </button>
  );
};
