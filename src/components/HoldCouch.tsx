import React, { useEffect } from 'react';
import { useTogether } from '../together/TogetherContext';
import { PixelIcon } from './letters/PixelIcon';

/**
 * Holding the couch: a cushion you press and hold. While your person holds theirs too, you sit side by side in
 * the room, and a phone that can buzz beats softly like a heart.
 */
export const HoldCouch: React.FC<{ name: string; compact?: boolean }> = ({ name, compact }) => {
  const { hold, setHolding } = useTogether();

  // let go if the page goes to the background mid-hold
  useEffect(() => {
    const off = () => setHolding(false);
    window.addEventListener('blur', off);
    document.addEventListener('visibilitychange', off);
    return () => {
      window.removeEventListener('blur', off);
      document.removeEventListener('visibilitychange', off);
      setHolding(false);
    };
  }, [setHolding]);

  // their heartbeat, where a phone can buzz
  useEffect(() => {
    if (!hold.together || !('vibrate' in navigator)) return;
    const beat = () => navigator.vibrate?.([40, 120, 25]);
    beat();
    const id = window.setInterval(beat, 900);
    return () => {
      window.clearInterval(id);
      navigator.vibrate?.(0);
    };
  }, [hold.together]);

  const title = hold.together ? 'Holding each other' : hold.mine ? 'Holding on…' : hold.theirs ? `${name} is holding the couch` : 'Hold the couch';
  const line = hold.together
    ? `That’s ${name}, holding on too.`
    : hold.mine
      ? `Keep holding. When ${name} holds too, you’ll sit side by side.`
      : hold.theirs
        ? 'Press and hold the cushion to hold it with them.'
        : `Press and hold the cushion. When ${name} does too, you’ll sit side by side.`;

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Hold the couch"
        aria-pressed={hold.mine}
        className={`px-btn ${hold.together ? '' : hold.mine ? 'px-btn--sage' : 'px-btn--paper'} shrink-0 select-none touch-none`}
        style={{ padding: compact ? '0.45em 0.7em' : '0.6em 0.9em' }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          setHolding(true);
        }}
        onPointerUp={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onLostPointerCapture={() => setHolding(false)}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            setHolding(true);
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ' || e.key === 'Enter') setHolding(false);
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <PixelIcon name="couch" scale={2} />
      </button>
      <div className="leading-snug min-w-0" role="status">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-sm text-[var(--muted)]">{line}</div>
      </div>
    </div>
  );
};
