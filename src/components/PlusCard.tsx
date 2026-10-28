import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { plusError, savedPlusCodes } from '../cloud/plus';
import { inApp } from '../cloud/firebase';

const day = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Where the call buttons go when the place doesn't have Soultied Plus: what Plus is, and a way to add it
 * (a code bought in this browser in one tap, or one typed in).
 */
export const PlusCard: React.FC<{ onClose?: () => void; className?: string; heading?: string; blurb?: string }> = ({
  onClose,
  className = '',
  heading = 'See and hear each other',
  blurb = 'Cameras and voice come with Soultied Plus: here in your place, and on Netflix, Prime Video and the other streaming sites. One of you having it covers you both.',
}) => {
  const { redeemPlus, hasPlus, plusUntil, demo, cloudMode } = useApp();
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = useMemo(() => savedPlusCodes()[0] || null, []);

  const add = async (c: string) => {
    setBusy(true);
    setError(null);
    const res = await redeemPlus(c);
    setBusy(false);
    if (!res.ok) setError(plusError(res.error));
  };

  if (hasPlus)
    return (
      <div className={`px-box px-shadow px-pop p-4 flex flex-col gap-2 ${className}`} role="status">
        <strong className="text-lg">Soultied Plus is on</strong>
        <p className="m-0 text-sm leading-snug">Cameras, voice and karaoke are on for you both, until {day(plusUntil)}.</p>
        {onClose && (
          <button className="px-btn px-btn--sage px-btn--small self-start" onClick={onClose}>
            Lovely
          </button>
        )}
      </div>
    );

  return (
    <div className={`px-box px-shadow px-pop p-4 flex flex-col gap-3 ${className}`} role="region" aria-label="Soultied Plus">
      <div className="flex items-start justify-between gap-3">
        <strong className="text-lg leading-tight">{heading}</strong>
        {onClose && (
          <button className="px-btn px-btn--paper px-btn--small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        )}
      </div>
      <p className="m-0 text-sm leading-snug">{blurb}</p>
      {demo || !cloudMode ? (
        <p className="m-0 text-sm text-[var(--muted)]">In your own place, either of you can add it.</p>
      ) : inApp() ? (
        // the iPhone app can't sell Plus yet (that comes through the App Store); a place that has it, has it here too
        <p className="m-0 text-sm text-[var(--muted)]">Plus isn’t in the iPhone app yet. If your place already has it, it works here too.</p>
      ) : (
        <>
          {saved && (
            <button className="px-btn px-btn--sage" disabled={busy} onClick={() => add(saved.code)}>
              {busy ? 'Adding…' : `Use my Plus code (until ${day(saved.validUntil)})`}
            </button>
          )}
          <div className="flex gap-2 flex-wrap">
            <a className="px-btn" href="/plus/" target="_blank" rel="noopener">
              Get Plus
            </a>
            {!typing && (
              <button className="px-btn px-btn--paper" onClick={() => setTyping(true)}>
                I have a code
              </button>
            )}
          </div>
          {typing && (
            <form
              className="flex gap-2 flex-wrap items-center"
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) void add(code);
              }}
            >
              <input
                id="plus-code"
                className="px-input flex-1 min-w-[10rem]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCD-EFGH-JKMN"
                aria-label="Your Plus code"
                autoComplete="off"
                spellCheck={false}
                autoFocus
              />
              <button className="px-btn px-btn--small" type="submit" disabled={busy || !code.trim()}>
                {busy ? 'Adding…' : 'Add'}
              </button>
            </form>
          )}
          {error && <p className="m-0 text-sm text-[#7f3835]">{error}</p>}
        </>
      )}
    </div>
  );
};
