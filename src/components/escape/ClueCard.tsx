import React from 'react';
import type { Clue } from '../../escape/types';
import { COLORS, GLYPH_NAME } from '../../escape/glyphs';
import { Glyph } from './Glyph';

/** What you see when you look closely at something. */
export const ClueCard: React.FC<{ clue: Clue }> = ({ clue }) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg font-bold leading-tight">{clue.title}</div>
      {clue.kind !== 'note' && clue.text && <p className="m-0 leading-snug text-[var(--muted)]">{clue.text}</p>}

      {clue.kind === 'note' && (
        <div className="px-inset px-4 py-3" style={{ background: '#f6ecd6' }}>
          <p className="m-0 whitespace-pre-line leading-snug text-lg italic">{clue.text}</p>
          {clue.sign && <p className="m-0 mt-2 text-sm text-[var(--muted)] text-right">{clue.sign}</p>}
        </div>
      )}

      {clue.kind === 'glyphs' && (
        <div className="flex items-end gap-3 flex-wrap">
          {clue.glyphs.map((g, i) => (
            <div key={i} className="px-inset flex flex-col items-center gap-1 px-2.5 pt-2.5 pb-1.5">
              <Glyph id={g} size={42} label={GLYPH_NAME[g]} />
              <span className="text-xs text-[var(--muted)]">{i + 1}</span>
            </div>
          ))}
        </div>
      )}

      {clue.kind === 'colors' && (
        <div className={clue.style === 'stripes' || clue.style === 'panes' ? 'flex flex-col gap-1 max-w-[260px]' : 'flex items-end gap-2 flex-wrap'}>
          {clue.colors.map((c, i) =>
            clue.style === 'notes' ? (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="block relative" style={{ width: 26, height: 40 }} role="img" aria-label={COLORS[c].label}>
                  <span className="absolute" style={{ left: 18, top: 0, width: 4, height: 28, background: '#3a2a26' }} />
                  <span
                    className="absolute"
                    style={{ left: 0, top: 22, width: 22, height: 16, background: COLORS[c].hex, boxShadow: `inset -3px -3px 0 ${COLORS[c].dark}` }}
                  />
                </span>
                <span className="text-xs text-[var(--muted)]">{i + 1}</span>
              </div>
            ) : (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)] w-4 text-right">{i + 1}</span>
                <span
                  className="block flex-1"
                  role="img"
                  aria-label={COLORS[c].label}
                  style={{ height: clue.style === 'panes' ? 26 : 16, background: COLORS[c].hex, boxShadow: `inset 0 -3px 0 ${COLORS[c].dark}` }}
                />
              </div>
            )
          )}
        </div>
      )}

      {clue.kind === 'pattern' && (
        <div className="inline-grid gap-1.5 self-start p-2.5" style={{ gridTemplateColumns: `repeat(${clue.rows[0].length}, 34px)`, background: '#3d3350' }}>
          {clue.rows.flatMap((row, j) =>
            [...row].map((c, i) => (
              <span
                key={`${i}-${j}`}
                className="block"
                style={{ width: 34, height: 34, background: c === '#' ? '#cdb3ff' : '#4a3f60', boxShadow: c === '#' ? '0 0 0 2px #e8dcff inset' : 'none' }}
                aria-label={c === '#' ? 'glowing' : 'dark'}
              />
            ))
          )}
        </div>
      )}

      {clue.kind === 'letters' && (
        <div className="flex gap-2.5">
          {clue.letters.map(([n, l]) => (
            <div key={n} className="px-inset flex flex-col items-center px-3 pt-1.5 pb-2 min-w-[46px]">
              <span className="text-xs text-[var(--muted)]">{n}</span>
              <span className="text-3xl font-bold leading-none" style={{ color: l ? 'var(--ink-soft)' : '#b9a98f' }}>
                {l || '?'}
              </span>
            </div>
          ))}
        </div>
      )}

      {clue.kind === 'cards' && (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {clue.cards.map((c) => (
            <div key={c.name} className="px-inset px-3 py-2">
              <div className="font-bold">{c.name}</div>
              {c.lines.map((l) => (
                <div key={l} className="text-sm">
                  {l}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
