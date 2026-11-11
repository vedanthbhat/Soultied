import React from 'react';
import { PlusCard } from './PlusCard';
import { PERKS } from '../plus/rules';

/** "That's in Soultied Plus": what it adds, and a way to get it, over whatever you tapped. */
export const PlusUpsell: React.FC<{ heading: string; blurb: string; onClose: () => void }> = ({ heading, blurb, onClose }) => (
  <div
    className="fixed inset-0 z-[80] flex items-center justify-center p-4"
    style={{ background: 'rgba(20, 14, 16, 0.62)' }}
    role="dialog"
    aria-modal="true"
    aria-label={heading}
    onClick={onClose}
  >
    <div className="w-full max-w-[420px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
      <PlusCard heading={heading} blurb={blurb} onClose={onClose} />
      <ul className="px-box m-0 p-4 pl-8 flex flex-col gap-1.5 text-sm leading-snug">
        {PERKS.map((p) => (
          <li key={p.title}>
            <strong>{p.title}.</strong> {p.line}
          </li>
        ))}
      </ul>
    </div>
  </div>
);
