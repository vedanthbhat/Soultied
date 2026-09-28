import React, { useEffect, useRef, useState } from 'react';
import type { Puzzle } from '../../escape/types';
import { isRight } from '../../escape/types';
import { COLORS, GLYPH_NAME, GlyphId, ColorId } from '../../escape/glyphs';
import { sfx } from '../../escape/sfx';
import { Glyph } from './Glyph';

export interface TogetherState {
  mine: boolean;
  partner: boolean;
  progress: number;
  onHold: (down: boolean) => void;
  partnerName: string;
  keyHint?: string;
}

interface Props {
  puzzle: Puzzle;
  onSolve: () => void;
  together?: TogetherState;
}

/** The lock for one puzzle. Most locks open by themselves the moment they're right. */
export const LockPanel: React.FC<Props> = ({ puzzle, onSolve, together }) => {
  const lock = puzzle.lock;
  const solvedRef = useRef(false);
  const tryGuess = (g: string) => {
    if (solvedRef.current) return false;
    if (isRight(puzzle, g)) {
      solvedRef.current = true;
      window.setTimeout(onSolve, 350);
      return true;
    }
    return false;
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-lg font-bold leading-tight">{puzzle.title}</div>
        <p className="m-0 leading-snug text-[var(--muted)]">{puzzle.prompt}</p>
      </div>
      {(lock.kind === 'digits' || lock.kind === 'letters') && (
        <Wheels length={lock.length} alphabet={lock.kind === 'digits' ? '0123456789' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'} onChange={(v) => tryGuess(v)} />
      )}
      {lock.kind === 'glyphs' && <GlyphWheels slots={lock.slots} set={lock.set} onChange={(v) => tryGuess(v)} />}
      {lock.kind === 'sequence' && <Sequence length={lock.length} colors={lock.colors} noun={lock.noun} check={tryGuess} />}
      {lock.kind === 'switches' && <Switches count={lock.count} onChange={(v) => tryGuess(v)} />}
      {lock.kind === 'clock' && <ClockLock step={lock.minuteStep} onChange={(v) => tryGuess(v)} />}
      {lock.kind === 'grid' && <Grid size={lock.size} onChange={(v) => tryGuess(v)} />}
      {lock.kind === 'choice' && <Choice options={lock.options} check={tryGuess} />}
      {lock.kind === 'map' && <MapLock cols={lock.cols} cells={lock.cells} start={lock.start} check={tryGuess} />}
      {lock.kind === 'together' && together && <Together label={lock.label} t={together} />}
    </div>
  );
};

/* ---------- number / letter wheels ---------- */

const Arrow: React.FC<{ up?: boolean; onClick: () => void; label: string }> = ({ up, onClick, label }) => (
  <button className="px-btn px-btn--paper px-btn--small w-full" onClick={onClick} aria-label={label}>
    {up ? '▲' : '▼'}
  </button>
);

const Wheels: React.FC<{ length: number; alphabet: string; onChange: (v: string) => void }> = ({ length, alphabet, onChange }) => {
  const [vals, setVals] = useState<number[]>(() => Array(length).fill(0));
  const [cursor, setCursor] = useState(0);
  const set = (next: number[]) => {
    setVals(next);
    sfx.tick();
    onChange(next.map((i) => alphabet[i]).join(''));
  };
  const turn = (i: number, d: number) => set(vals.map((v, j) => (j === i ? (v + d + alphabet.length) % alphabet.length : v)));
  const onKey = (e: React.KeyboardEvent) => {
    const k = e.key.toUpperCase();
    const idx = alphabet.indexOf(k);
    if (idx >= 0 && k.length === 1) {
      set(vals.map((v, j) => (j === cursor ? idx : v)));
      setCursor((c) => (c + 1) % length);
    } else if (e.key === 'ArrowLeft') setCursor((c) => (c + length - 1) % length);
    else if (e.key === 'ArrowRight') setCursor((c) => (c + 1) % length);
    else if (e.key === 'ArrowUp') turn(cursor, 1);
    else if (e.key === 'ArrowDown') turn(cursor, -1);
    else return;
    e.preventDefault();
  };
  return (
    <div className="flex gap-2.5 self-start outline-none" tabIndex={0} onKeyDown={onKey} aria-label="Lock wheels. Type to set them.">
      {vals.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5" style={{ width: 52 }}>
          <Arrow up onClick={() => turn(i, 1)} label={`Wheel ${i + 1} up`} />
          <button
            className="px-inset w-full text-center text-3xl font-bold py-1.5 border-0 cursor-pointer"
            style={{ boxShadow: i === cursor ? '0 0 0 3px var(--butter)' : undefined }}
            onClick={() => setCursor(i)}
            aria-label={`Wheel ${i + 1}: ${alphabet[v]}`}
          >
            {alphabet[v]}
          </button>
          <Arrow onClick={() => turn(i, -1)} label={`Wheel ${i + 1} down`} />
        </div>
      ))}
    </div>
  );
};

const GlyphWheels: React.FC<{ slots: number; set: GlyphId[]; onChange: (v: string) => void }> = ({ slots, set, onChange }) => {
  const [vals, setVals] = useState<number[]>(() => Array(slots).fill(0));
  const turn = (i: number, d: number) => {
    const next = vals.map((v, j) => (j === i ? (v + d + set.length) % set.length : v));
    setVals(next);
    sfx.tick();
    onChange(next.map((k) => set[k]).join(','));
  };
  return (
    <div className="flex gap-2.5 self-start flex-wrap">
      {vals.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5" style={{ width: 58 }}>
          <Arrow up onClick={() => turn(i, 1)} label={`Dial ${i + 1} next`} />
          <button className="px-inset w-full flex justify-center py-2 border-0 cursor-pointer" onClick={() => turn(i, 1)} aria-label={`Dial ${i + 1}: ${GLYPH_NAME[set[v]]}`}>
            <Glyph id={set[v]} size={35} />
          </button>
          <Arrow onClick={() => turn(i, -1)} label={`Dial ${i + 1} back`} />
        </div>
      ))}
    </div>
  );
};

/* ---------- press in order ---------- */

const Sequence: React.FC<{ length: number; colors: ColorId[]; noun: string; check: (v: string) => boolean }> = ({ length, colors, noun, check }) => {
  const [seq, setSeq] = useState<ColorId[]>([]);
  const [bad, setBad] = useState(false);
  const press = (c: ColorId) => {
    if (bad) return;
    sfx.note(c);
    const next = [...seq, c];
    setSeq(next);
    if (next.length === length) {
      if (check(next.join(','))) return;
      setBad(true);
      window.setTimeout(() => {
        sfx.wrong();
        setSeq([]);
        setBad(false);
      }, 500);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2.5 flex-wrap">
        {colors.map((c) => (
          <button
            key={c}
            className="px-option"
            style={{ width: 62, minHeight: 64, background: COLORS[c].hex, color: c === 'white' || c === 'gold' ? '#3a2a26' : '#fff4e2' }}
            onClick={() => press(c)}
            aria-label={`${COLORS[c].label} ${noun}`}
          >
            {COLORS[c].label}
          </button>
        ))}
      </div>
      <div className={`flex items-center gap-2 ${bad ? 'text-[#a84f4b]' : 'text-[var(--muted)]'}`} aria-live="polite">
        <span className="text-sm">{bad ? 'Hmm, not quite. Try again.' : `Order so far:`}</span>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className="inline-block"
            style={{ width: 16, height: 16, background: seq[i] ? COLORS[seq[i]].hex : 'var(--paper-2)', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.2)' }}
          />
        ))}
        {seq.length > 0 && !bad && (
          <button className="px-link text-sm ml-1" onClick={() => setSeq([])}>
            start over
          </button>
        )}
      </div>
    </div>
  );
};

/* ---------- switches ---------- */

const Switches: React.FC<{ count: number; onChange: (v: string) => void }> = ({ count, onChange }) => {
  const [vals, setVals] = useState<boolean[]>(() => Array(count).fill(false));
  const flip = (i: number) => {
    const next = vals.map((v, j) => (j === i ? !v : v));
    setVals(next);
    sfx.tick();
    onChange(next.map((u) => (u ? 'U' : 'D')).join(''));
  };
  return (
    <div className="flex gap-3 self-start p-3" style={{ background: '#3d474a' }}>
      {vals.map((up, i) => (
        <button
          key={i}
          onClick={() => flip(i)}
          className="flex flex-col items-center gap-1 border-0 cursor-pointer p-0 bg-transparent"
          aria-label={`Switch ${i + 1}: ${up ? 'up' : 'down'}`}
          aria-pressed={up}
        >
          <span className="relative block" style={{ width: 26, height: 60, background: '#2a3033' }}>
            <span className="absolute left-[3px]" style={{ width: 20, height: 24, top: up ? 4 : 32, background: '#e6dccb', boxShadow: 'inset 0 -3px 0 #b9ad95' }} />
          </span>
          <span className="text-xs" style={{ color: '#e6dccb' }}>
            {up ? 'UP' : 'DOWN'}
          </span>
        </button>
      ))}
    </div>
  );
};

/* ---------- clock ---------- */

const ClockFace: React.FC<{ h: number; m: number }> = ({ h, m }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const N = 33;
    const r = 15;
    const cx = 16;
    ctx.clearRect(0, 0, N, N);
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const d = Math.hypot(x + 0.5 - (cx + 0.5), y + 0.5 - (cx + 0.5));
        if (d > r + 1) continue;
        ctx.fillStyle = d > r - 1 ? '#5a3a2c' : '#efe3cb';
        ctx.fillRect(x, y, 1, 1);
      }
    ctx.fillStyle = '#a08a74';
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ctx.fillRect(Math.round(cx + Math.sin(a) * (r - 2.5)), Math.round(cx - Math.cos(a) * (r - 2.5)), 1, 1);
    }
    const hand = (ang: number, len: number, col: string) => {
      ctx.fillStyle = col;
      for (let i = 0; i <= len; i += 0.5) ctx.fillRect(Math.round(cx + Math.sin(ang) * i), Math.round(cx - Math.cos(ang) * i), 1, 1);
    };
    hand((m / 60) * Math.PI * 2, r - 3, '#3a2a26');
    hand((((h % 12) + m / 60) / 12) * Math.PI * 2, r - 7, '#3a2a26');
    ctx.fillStyle = '#a84f4b';
    ctx.fillRect(cx, cx, 1, 1);
  }, [h, m]);
  return <canvas ref={ref} width={33} height={33} className="pixelated block" style={{ width: 132, height: 132 }} aria-hidden="true" />;
};

const ClockLock: React.FC<{ step: number; onChange: (v: string) => void }> = ({ step, onChange }) => {
  const [h, setH] = useState(12);
  const [m, setM] = useState(0);
  const update = (nh: number, nm: number) => {
    setH(nh);
    setM(nm);
    sfx.tick();
    onChange(`${nh}:${String(nm).padStart(2, '0')}`);
  };
  const addH = (d: number) => update(((h - 1 + d + 12) % 12) + 1, m);
  const addM = (d: number) => update(h, (m + d * step + 60) % 60);
  return (
    <div className="flex items-center gap-5 flex-wrap">
      <ClockFace h={h} m={m} />
      <div className="flex flex-col gap-2">
        <div className="text-3xl font-bold tabular-nums" aria-live="polite">
          {h}:{String(m).padStart(2, '0')}
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-sm text-[var(--muted)]">Hour</span>
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => addH(-1)} aria-label="Hour back">
            −
          </button>
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => addH(1)} aria-label="Hour forward">
            +
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-16 text-sm text-[var(--muted)]">Minutes</span>
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => addM(-1)} aria-label="Minutes back">
            −
          </button>
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => addM(1)} aria-label="Minutes forward">
            +
          </button>
        </div>
      </div>
    </div>
  );
};

/* ---------- tile grid ---------- */

const Grid: React.FC<{ size: number; onChange: (v: string) => void }> = ({ size, onChange }) => {
  const [cells, setCells] = useState<boolean[]>(() => Array(size * size).fill(false));
  const flip = (k: number) => {
    const next = cells.map((c, i) => (i === k ? !c : c));
    setCells(next);
    sfx.tick();
    const rows: string[] = [];
    for (let j = 0; j < size; j++) rows.push(next.slice(j * size, j * size + size).map((c) => (c ? '#' : '.')).join(''));
    onChange(rows.join('/'));
  };
  return (
    <div className="inline-grid gap-1.5 self-start p-2.5" style={{ gridTemplateColumns: `repeat(${size}, 40px)`, background: '#4a4250' }}>
      {cells.map((on, k) => (
        <button
          key={k}
          onClick={() => flip(k)}
          className="border-0 p-0 cursor-pointer"
          style={{ width: 40, height: 40, background: on ? '#cdb3ff' : '#6a6272', boxShadow: on ? 'inset 0 0 0 2px #e8dcff' : 'inset 0 -3px 0 #544c5c' }}
          aria-label={`Row ${Math.floor(k / size) + 1}, tile ${(k % size) + 1}: ${on ? 'lit' : 'dark'}`}
          aria-pressed={on}
        />
      ))}
    </div>
  );
};

/* ---------- pick one ---------- */

const Choice: React.FC<{ options: Array<{ id: string; label: string; lines?: string[] }>; check: (v: string) => boolean }> = ({ options, check }) => {
  const [wrong, setWrong] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {options.map((o) => (
          <button
            key={o.id}
            className="px-option flex-col items-start text-left"
            style={{ justifyContent: 'flex-start', minHeight: 0, opacity: wrong === o.id ? 0.55 : 1 }}
            onClick={() => {
              if (check(o.id)) return;
              sfx.wrong();
              setWrong(o.id);
            }}
          >
            <span className="font-bold">{o.label}</span>
            {o.lines?.map((l) => (
              <span key={l} className="text-sm font-normal leading-snug">
                {l}
              </span>
            ))}
          </button>
        ))}
      </div>
      {wrong && <p className="m-0 text-sm text-[#a84f4b]">That one doesn’t fit every fact. Check them again.</p>}
    </div>
  );
};

/* ---------- city map ---------- */

const MapLock: React.FC<{ cols: number; cells: string[]; start: number; check: (v: string) => boolean }> = ({ cols, cells, start, check }) => {
  const [wrong, setWrong] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-1 p-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, background: '#b8a888' }}>
        {cells.map((c, i) => (
          <button
            key={i}
            className="border-0 cursor-pointer text-xs leading-tight p-1 flex items-center justify-center text-center"
            style={{
              minHeight: 44,
              background: i === start ? '#a84f4b' : wrong === i ? '#c8b089' : '#e6dcc4',
              color: i === start ? '#fff4e2' : '#3a2a26',
              fontWeight: i === start ? 700 : 500,
            }}
            onClick={() => {
              if (i === start) return;
              if (check(String(i))) return;
              sfx.wrong();
              setWrong(i);
            }}
          >
            {c}
          </button>
        ))}
      </div>
      <p className="m-0 text-sm text-[var(--muted)]">North is the top of the map. The red square is where you start.</p>
      {wrong !== null && <p className="m-0 text-sm text-[#a84f4b]">Nothing at {cells[wrong]}. Check the directions again.</p>}
    </div>
  );
};

/* ---------- do it together ---------- */

const Together: React.FC<{ label: string; t: TogetherState }> = ({ label, t }) => {
  const down = () => t.onHold(true);
  const up = () => t.onHold(false);
  return (
    <div className="flex flex-col gap-3">
      <button
        className="px-btn text-xl py-4 select-none touch-none"
        style={{ minWidth: 220 }}
        onPointerDown={(e) => {
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          down();
        }}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && down()}
        onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && up()}
        aria-pressed={t.mine}
      >
        {t.mine ? 'Holding…' : `Hold: ${label}`}
      </button>
      <div className="h-4 w-full" style={{ background: 'var(--paper-2)' }}>
        <div className="h-4" style={{ width: `${Math.round(t.progress * 100)}%`, background: 'var(--butter)', transition: 'width 80ms steps(2)' }} />
      </div>
      <p className="m-0 text-sm text-[var(--muted)]">
        {t.mine && t.partner ? 'Together! Keep holding…' : t.partner ? `${t.partnerName} is holding. Hold yours too!` : t.mine ? `Waiting for ${t.partnerName} to hold theirs…` : `Hold at the same time as ${t.partnerName}.`}
        {t.keyHint && <span className="block mt-1">{t.keyHint}</span>}
      </p>
    </div>
  );
};
