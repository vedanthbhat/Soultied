import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useDecor } from '../decor/DecorContext';
import { REWARDS, SLOTS, type Decor, type DecorItem, type SlotId, itemById, itemsIn } from '../decor/catalogue';
import { renderDecorThumb, type Seat } from '../pixel/room';
import { PixelIcon } from './letters/PixelIcon';

/** Thumbnails are a crop of the real room with that piece in it; kept so tabbing back and forth is instant. */
const THUMBS = new Map<string, string>();

function thumbUrl(decor: Decor, slot: SlotId, left: Seat, right: Seat) {
  const who = slot === 'painting' ? JSON.stringify([left.avatar, left.status, right.avatar, right.status]) : '';
  const key = `${slot}|${JSON.stringify(decor)}|${who}`;
  const hit = THUMBS.get(key);
  if (hit) return hit;
  const buf = renderDecorThumb(decor, slot, left, right);
  const c = document.createElement('canvas');
  c.width = buf.w;
  c.height = buf.h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(buf.w, buf.h);
  img.data.set(buf.data);
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  if (THUMBS.size > 160) THUMBS.clear();
  THUMBS.set(key, url);
  return url;
}

const Stitches: React.FC<{ n: number; className?: string }> = ({ n, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    <PixelIcon name="spool" scale={2} />
    {n}
  </span>
);

/**
 * The catalogue: one tab for each spot in the room, a card for each piece.
 * Clicking a card tries it on in the room behind (only on your screen) until
 * you buy it, put it out, or close the drawer.
 */
export const DecorDrawer: React.FC<{ left: Seat; right: Seat }> = ({ left, right }) => {
  const { partnerUser, space } = useApp();
  const d = useDecor();
  const [hidden, setHidden] = useState(false);
  const [shake, setShake] = useState(0);
  const close = d.closeCatalogue;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  const items = itemsIn(d.slot);
  const placedId = d.placed[d.slot];
  const sel: DecorItem = (d.trying && d.trying.slot === d.slot ? d.trying : null) || itemById(d.slot, placedId) || items[0];
  const trying = !!d.trying && d.trying.id !== placedId;

  const thumbs = useMemo(
    () => items.map((it) => thumbUrl({ ...d.placed, [d.slot]: it.id }, d.slot, left, right)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.slot, d.placed, left.avatar, left.status, right.avatar, right.status]
  );

  // out of the way of what you're choosing: the window, the plant and the pet's cushion are on the left of the room
  const dockRight = d.slot === 'view' || d.slot === 'plant' || d.slot === 'pet';
  const owned = d.owns(sel);
  const short = sel.price - d.stitches;

  const action = (() => {
    if (sel.id === placedId) return <span className="text-sm text-[var(--muted)]">In your room</span>;
    if (owned)
      return (
        <button className="px-btn px-btn--sage px-btn--small" onClick={() => d.place(sel)}>
          Put it out
        </button>
      );
    if (short > 0)
      return (
        <button className="px-btn px-btn--paper px-btn--small" disabled title="Earn stitches by coming back each day">
          Need {short} more
        </button>
      );
    return (
      <button
        className="px-btn px-btn--small"
        onClick={() => {
          if (!d.buy(sel)) setShake((n) => n + 1);
        }}
      >
        Buy for <Stitches n={sel.price} />
      </button>
    );
  })();

  const partnerName = partnerUser?.name || space?.partnerPlaceholderName || 'your person';
  const side = dockRight ? 'sm:right-4 sm:left-auto' : 'sm:left-4 sm:right-auto';

  if (hidden) {
    return (
      <div className={`fixed inset-x-3 bottom-3 sm:inset-x-auto ${side} z-40 px-ui`} role="region" aria-label="Decorate">
        <div className="px-box px-shadow px-fade flex items-center gap-3 flex-wrap px-3 py-2">
          <span className="text-sm">
            <span className="font-semibold">{sel.name}</span>
            {trying && <span className="text-[var(--muted)]"> · trying it on</span>}
          </span>
          {action}
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => setHidden(false)} aria-expanded={false}>
            Catalogue ▴
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-x-0 bottom-0 sm:bottom-4 ${side} z-40 px-ui sm:w-[min(600px,calc(100vw-2rem))]`}
      role="region"
      aria-label="Decorate the room"
    >
      <div className="px-box px-shadow px-pop flex flex-col">
        <div className="flex items-center gap-3 px-4 pt-3 pb-1">
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--terracotta-d)]">The living room</div>
            <h2 className="text-xl font-bold leading-tight text-[var(--ink-soft)] m-0">Decorate</h2>
          </div>
          <span key={shake} className={`px-inset px-2.5 py-1 text-sm font-semibold ${shake ? 'px-pop' : ''}`} title="Stitches to spend">
            <Stitches n={d.stitches} /> <span className="hidden sm:inline text-[var(--muted)] font-normal">stitches</span>
          </span>
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => setHidden(true)} aria-expanded title="Hide the catalogue to look at the room">
            Look ▾
          </button>
          <button className="px-btn px-btn--paper px-btn--small" onClick={d.closeCatalogue} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto px-3 px-scroll" role="tablist" aria-label="Spots in the room">
          {SLOTS.map((s) => (
            <button
              key={s.id}
              role="tab"
              aria-selected={d.slot === s.id}
              className="px-tab whitespace-nowrap text-sm"
              onClick={() => {
                d.setSlot(s.id);
                if (d.trying && d.trying.slot !== s.id) d.tryOn(null);
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="px-divider mx-4" />

        <div key={d.slot} className="flex gap-3 overflow-x-auto px-4 pt-3 pb-3 px-scroll" role="tabpanel">
          {items.map((it, i) => {
            const inRoom = it.id === placedId;
            const mine = d.owns(it);
            return (
              <button
                key={it.id}
                className="px-chip shrink-0 w-[124px] !gap-1 !p-1.5 text-left"
                aria-pressed={sel.id === it.id}
                aria-label={`${it.name}${inRoom ? ', in your room' : mine ? ', yours' : `, ${it.price} stitches`}`}
                onClick={() => d.tryOn(inRoom ? null : it)}
              >
                <span className="block w-full aspect-[3/2] bg-[var(--ink)] overflow-hidden">
                  {thumbs[i] && <img src={thumbs[i]} alt="" className="pixelated w-full h-full object-contain" draggable={false} />}
                </span>
                <span className="block w-full text-[13px] font-semibold leading-tight truncate pt-0.5">{it.name}</span>
                <span className="block w-full text-[12px] text-[var(--muted)]">
                  {inRoom ? 'In your room' : mine ? 'Yours' : <Stitches n={it.price} />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 flex-wrap px-4 pb-3">
          <div className="flex-1 min-w-[180px] text-sm leading-snug">
            <span className="font-semibold">{sel.name}.</span> <span className="text-[var(--muted)]">{sel.blurb}</span>
          </div>
          {trying && (
            <button className="px-link text-sm" onClick={() => d.tryOn(null)}>
              Back to yours
            </button>
          )}
          {action}
        </div>

        <div className="px-divider mx-4" />
        <p className="m-0 px-4 py-2.5 text-xs text-[var(--muted)] leading-snug">
          {partnerUser
            ? `Stitches come from showing up: ${REWARDS.visit} each day each of you visits, ${REWARDS.together} more when you’re both here, and ${REWARDS.letter} when the day’s letter opens. You share the jar.`
            : `Stitches come from showing up. They start adding up each day once ${partnerName} moves in, and you’ll share the jar.`}
        </p>
      </div>
    </div>
  );
};
