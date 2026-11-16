import React, { useEffect, useRef, useState } from 'react';
import { PixelIcon, type SpriteName } from './letters/PixelIcon';
import { renderRoom, ROOM_W, type Seat } from '../pixel/room';
import type { Decor } from '../decor/catalogue';
import { itemById } from '../decor/catalogue';
import { usePet } from '../together/PetContext';
import { PET_ACTS, PET_ACT_INFO, PET_LEVELS, petCareState, petLevelUp, petLine, petReaction, type PetAct, type PetCare } from '../together/pet';

/**
 * The card that opens over the pet's cushion: how it's doing, feed it, play with it, give it a cuddle (once each
 * a day, each of you), how close it's grown to you two, and the last week. The iPhone's PetSheet (PetViews.swift).
 */

const ACT_ICON: Record<PetAct, SpriteName> = { feed: 'bowl', play: 'ball', cuddle: 'blanket' };
/** the bit of the room the card shows: the cushion, the bowl, the ball, and whatever's floating over it */
const CROP = { x: 166, y: 136, w: 46, h: 30 };
const DAY_LETTER = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const weekdayOf = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
};

/** the pet on its cushion, close up and moving (the room's own pixels, so it's exactly what's in the room) */
const PetPortrait: React.FC<{ left: Seat; right: Seat; decor: Decor; care: ReturnType<typeof petCareState>; scale: number }> = ({ left, right, decor, care, scale }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const state = useRef({ left, right, decor, care });
  state.current = { left, right, decor, care };
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(CROP.w, CROP.h);
    const t0 = performance.now();
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const draw = () => {
      const s = state.current;
      const t = still ? 1.3 : (performance.now() - t0) / 1000 + 1.3;
      const room = renderRoom({ left: s.left, right: s.right, letterUnread: false, fire: 0.6, hover: null, closeness: 0, decor: s.decor, petCare: s.care }, t);
      for (let j = 0; j < CROP.h; j++) {
        const from = ((CROP.y + j) * ROOM_W + CROP.x) * 4;
        img.data.set(room.data.subarray(from, from + CROP.w * 4), j * CROP.w * 4);
      }
      ctx.putImageData(img, 0, 0);
    };
    draw();
    if (still) return;
    const id = window.setInterval(draw, 100);
    return () => window.clearInterval(id);
  }, [left, right]);
  return (
    <canvas
      ref={ref}
      width={CROP.w}
      height={CROP.h}
      className="pixelated shrink-0 shadow-[0_0_0_3px_#3a2a26]"
      style={{ width: CROP.w * scale, height: CROP.h * scale }}
      aria-hidden
    />
  );
};

export const PetCard: React.FC<{
  decor: Decor;
  petName: string | null;
  partnerName: string | null;
  left: Seat;
  right: Seat;
  onChoose: () => void;
  onName: () => void;
}> = ({ decor, petName, partnerName, left, right, onChoose, onName }) => {
  const pet = usePet();
  const v = pet.view;
  const [said, setSaid] = useState<{ act: PetAct; text: string; up: string | null; n: number } | null>(null);
  const item = itemById('pet', decor.pet);
  const kind = (item?.name || 'pet').toLowerCase();
  const name = petName || `your ${kind}`;
  const narrow = typeof window !== 'undefined' && window.innerWidth < 640;

  if (decor.pet === 'none' || !item)
    return (
      <div className="flex flex-col gap-3">
        <div className="text-lg font-bold leading-tight">Nobody sleeps on the cushion yet</div>
        <p className="text-sm leading-snug m-0">Choose a pet to curl up by the couch, and you can both look after it: feed it, play with it, give it a cuddle. The more days you both come by, the closer it grows to you.</p>
        <button className="px-btn px-btn--sage self-start" onClick={onChoose}>
          Choose a pet
        </button>
      </div>
    );

  const care = (act: PetAct) => {
    const r = pet.care(act);
    if (!r) return;
    setSaid((s) => ({ act, text: petReaction(act, name), up: r.after > r.before ? petLevelUp(r.after, name) : null, n: (s?.n || 0) + 1 }));
  };

  const lvl = PET_LEVELS[v.level];
  const next = PET_LEVELS[v.level + 1];
  const into = next ? (v.bond - lvl.at) / (next.at - lvl.at) : 1;
  const who = (c: PetCare, a: PetAct, mine: boolean) => (c[a] !== undefined ? `${mine ? 'You' : partnerName || 'Your person'} · ${time(c[a]!)}` : null);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 items-start">
        <div className="relative">
          <PetPortrait left={left} right={right} decor={decor} care={petCareState(v)} scale={narrow ? 2.6 : 3.2} />
          {said && (
            <span key={said.n} className="pet-hearts absolute left-1/2 top-2 pointer-events-none" aria-hidden>
              <PixelIcon name="heart" scale={2} />
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="text-lg font-bold leading-tight break-words">{petName || `Your ${kind}`}</div>
          <div className="text-xs opacity-75 leading-tight">{petName ? `the ${kind}` : 'still waiting for a name'}</div>
          <div className="mt-1 text-sm leading-tight">
            <span className="font-semibold">{lvl.name}</span>
            <span className="opacity-75">
              {' '}· {v.bond} {v.bond === 1 ? 'day' : 'days'} together
            </span>
          </div>
          <div className="h-[8px] bg-[#e9dcc3] shadow-[0_0_0_2px_#3a2a26] mt-1" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(into * 100)} aria-label="How close it's grown">
            <div className="h-full bg-[#d9706b] transition-[width] duration-700" style={{ width: `${Math.max(4, into * 100)}%` }} />
          </div>
          <div className="text-xs opacity-75 leading-tight">{next ? `${v.toNext} more ${v.toNext === 1 ? 'day' : 'days'} of you both coming by to ${next.name}` : 'As close as can be.'}</div>
        </div>
      </div>

      <p className="text-sm leading-snug m-0" role="status">
        {said ? (
          <span key={said.n} className="mo-pop inline-block">
            {said.up ? <span className="font-semibold">{said.up} </span> : null}
            {said.text}
          </span>
        ) : (
          petLine(v, name, partnerName)
        )}
      </p>

      <div className="grid grid-cols-3 gap-2" role="group" aria-label={`Look after ${name}`}>
        {PET_ACTS.map((a, i) => {
          const done = v.mine[a] !== undefined;
          const lines = [who(v.mine, a, true), who(v.theirs, a, false)].filter(Boolean) as string[];
          return (
            <div key={a} className="flex flex-col gap-1 items-stretch">
              <button
                type="button"
                className={`px-option text-sm ${done ? '' : 'mo-lift'}`}
                style={{ minHeight: '3.4em', flexDirection: 'column', gap: 4, padding: '0.45em 0.3em 0.5em' }}
                aria-pressed={done}
                disabled={done}
                onClick={() => care(a)}
              >
                <span className={`inline-flex ${!done && v.mood !== 'both' ? 'mo-bob' : ''}`} style={{ animationDelay: `${i * -0.4}s` }}>
                  <PixelIcon name={ACT_ICON[a]} scale={3} />
                </span>
                <span className="leading-tight">{done ? `${PET_ACT_INFO[a].done} ✓` : PET_ACT_INFO[a].label}</span>
              </button>
              <div className="text-[11px] leading-tight opacity-75 text-center min-h-[1.2em]">
                {lines.length ? lines.map((l) => <div key={l}>{l}</div>) : <div>not yet today</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2" aria-label="The last week">
        {v.week.map((d, i) => (
          <div key={d.day} className={`flex flex-col items-center gap-1 flex-1 ${i === 6 ? 'font-semibold' : 'opacity-90'}`}>
            <span className="h-[18px] flex items-center justify-center" title={d.both ? 'You both came by' : d.me || d.them ? 'One of you came by' : 'Nobody came by'}>
              {d.both ? <PixelIcon name="heart" scale={2} /> : d.me || d.them ? <PixelIcon name="paw" scale={2} /> : <span className="inline-block w-[6px] h-[6px] bg-[#cdbd9f]" />}
            </span>
            <span className="text-[11px] leading-none">{i === 6 ? 'Today' : DAY_LETTER[weekdayOf(d.day)]}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <button className="px-link" onClick={onName}>
          {petName ? `Rename ${petName}` : 'Give it a name'}
        </button>
        <button className="px-link" onClick={onChoose}>
          Choose a different pet
        </button>
      </div>
    </div>
  );
};
