import React, { useEffect, useRef } from 'react';

interface Props {
  title: string;
  kicker?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
}

/** A pixel "window" floating over the room. Esc or the × closes it. */
export const PixelPanel: React.FC<Props> = ({ title, kicker, onClose, children, width = 760 }) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-3 sm:p-6 px-ui"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ background: 'rgba(16,10,12,0.35)' }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="px-box px-shadow px-pop w-full flex flex-col outline-none"
        style={{ maxWidth: width, maxHeight: 'min(88vh, 900px)' }}
      >
        <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
          <div>
            {kicker && <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--terracotta-d)]">{kicker}</div>}
            <h2 className="text-2xl font-bold leading-tight text-[var(--ink-soft)]">{title}</h2>
          </div>
          <button className="px-btn px-btn--paper px-btn--small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="px-divider mx-5" />
        <div className="px-scroll overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
};
