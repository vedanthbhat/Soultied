import React from 'react';
import { PixelIcon } from './letters/PixelIcon';
import { TAPE_H, TAPE_LABEL, TAPE_W, tapeLeft, tapeService, tapeShare, tapeSprite, tapeTitle, tapeWho, type Tape } from '../watch/tapes';

/**
 * Continue watching: what the two of you were part way through, as pixel video tapes on a little shelf. The
 * title's written on each tape's label, the reels are wound on as far as you got, and under it how long's
 * left and who had it on last. Tap one to carry on from where you stopped.
 */

/** one tape: the shell drawn in pixels, its title written on the label */
export const TapeArt: React.FC<{ tape: Tape; scale?: number }> = ({ tape, scale = 3 }) => {
  const s = tapeSprite(tapeShare(tape), tape.platform);
  const L = TAPE_LABEL;
  const small = scale < 3;
  return (
    <span className="relative inline-block shrink-0" style={{ width: TAPE_W * scale, height: TAPE_H * scale }}>
      <PixelIcon sprite={s} scale={scale} style={{ position: 'absolute', inset: 0 }} />
      <span
        className="absolute overflow-hidden text-[#3a2a26] leading-tight font-semibold"
        style={{
          left: (L.x + 1) * scale,
          top: (L.y + 2) * scale + 1,
          width: (L.w - 2) * scale,
          height: (L.h - 2) * scale - 1,
          fontSize: small ? 9 : 11,
          lineHeight: small ? '10px' : '12px',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {tapeTitle(tape)}
      </span>
    </span>
  );
};

/** how far through, as a little bar in the site's colour (nothing when it's not known how long it is) */
const TapeBar: React.FC<{ tape: Tape; width: number }> = ({ tape, width }) =>
  tape.dur > 0 ? (
    <span className="block bg-[#2a2124] p-[2px]" style={{ width }} aria-hidden="true">
      <span className="block h-[4px] bg-[var(--terracotta)]" style={{ width: `${Math.max(4, Math.round(tapeShare(tape) * 100))}%` }} />
    </span>
  ) : null;

export const TapeShelf: React.FC<{
  tapes: Tape[];
  onPick: (t: Tape) => void;
  me: string;
  theirName: string;
  /** 2: small, for the TV's remote; 3: the full shelf */
  scale?: number;
  heading?: string;
}> = ({ tapes, onPick, me, theirName, scale = 3, heading = 'Continue watching' }) => {
  if (!tapes.length) return null;
  const w = TAPE_W * scale;
  const now = Date.now();
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="px-label">{heading}</span>
      <div className="px-scroll overflow-x-auto overflow-y-hidden -mx-1 px-1 pt-1 pb-2">
        <div className="w-max min-w-full">
        <ul className="m-0 p-0 list-none flex gap-3 items-end">
          {tapes.map((t) => (
            <li key={t.key} className="shrink-0" style={{ width: w }}>
              <button
                type="button"
                className="tape-btn flex flex-col gap-1 items-start text-left w-full bg-transparent border-0 p-0 cursor-pointer"
                onClick={() => onPick(t)}
                title={`Carry on: ${tapeTitle(t)} on ${tapeService(t.platform)}`}
                aria-label={`Carry on with ${tapeTitle(t)} on ${tapeService(t.platform)}, ${tapeLeft(t)}. ${tapeWho(t, me, theirName, now)}.`}
              >
                <TapeArt tape={t} scale={scale} />
                <TapeBar tape={t} width={w} />
                <span className="block w-full text-xs leading-tight truncate">
                  <strong>{tapeService(t.platform)}</strong>
                  {scale >= 3 && <> · {tapeLeft(t)}</>}
                </span>
                {scale < 3 && <span className="block w-full text-xs leading-tight truncate text-[var(--muted)]">{tapeLeft(t)}</span>}
                {scale >= 3 && <span className="block w-full text-xs leading-snug truncate text-[var(--muted)]">{tapeWho(t, me, theirName, now)}</span>}
              </button>
            </li>
          ))}
        </ul>
        {/* the shelf they stand on */}
        <div className="h-[6px] mt-[3px] bg-[#8a5a3a] shadow-[0_3px_0_#5e3a24]" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
};
