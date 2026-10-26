import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveGame } from '../../games/live/useLiveGame';
import type { LiveGame } from '../../games/live/useLiveGame';
import {
  CHOPS,
  COOK_MS,
  DISHES,
  ING_NAME,
  INGS,
  KITCHEN,
  PASS_MAX,
  PATIENCE_MS,
  POT_MAX,
  SHIFT_MS,
  potState,
  type Ing,
  type KitchenAct,
  type KitchenState,
} from '../../games/kitchen';
import type { Seat } from '../../games/types';
import { sfx, tone } from '../../escape/sfx';
import { LiveFrame, useNow } from './LiveFrame';
import { Sprite } from './Pixel';

/* ---------- the vegetables, whole and chopped (10 x 10) ---------- */

const WHOLE: Record<Ing, { rows: string[]; pal: Record<string, string> }> = {
  tomato: {
    rows: ['....gg....', '..gGggGg..', '.rrrrrrrr.', 'rrRrrrrrrr', 'rRrrrrrrrr', 'rrrrrrrrrr', 'rrrrrrrrrr', '.rrrrrrrr.', '..rrrrrr..', '...rrrr...'],
    pal: { r: '#c4453f', R: '#f08a80', g: '#4d6b52', G: '#8a9a72' },
  },
  onion: {
    rows: ['....gg....', '....g.....', '...pPPp...', '..pPppPp..', '.pPpppppp.', '.pppppPpp.', '.pppppppp.', '..pppppp..', '...pppp...', '....ww....'],
    pal: { p: '#9c4f6e', P: '#c98fa6', g: '#8a9a72', w: '#e0c9a0' },
  },
  carrot: {
    rows: ['....gG.g..', '.....gGg..', '....ooo...', '....oOo...', '...ooOo...', '...oooo...', '..ooOo....', '..ooo.....', '.ooo......', '.o........'],
    pal: { o: '#e07a3a', O: '#f2a65a', g: '#4d6b52', G: '#8a9a72' },
  },
  mushroom: {
    rows: ['...bbbb...', '.bbBbbbbb.', 'bbbbbbBbbb', 'bBbbbbbbbb', 'bbbbbbbbbb', '...cccc...', '...cccc...', '...cCcc...', '...cccc...', '..cccccc..'],
    pal: { b: '#8a5a3c', B: '#c89a5c', c: '#efe3cb', C: '#d6c29c' },
  },
  potato: {
    rows: ['..........', '...pppp...', '.ppPpppp..', 'ppppppdpp.', 'pPpppppppp', 'ppppdppppp', 'pppppppPpp', '.pppppppp.', '..pppppp..', '..........'],
    pal: { p: '#c9a46a', P: '#e2c48a', d: '#8a6a36' },
  },
};
/** three cut slices: the skin round the edge, the cut face inside */
const CHOPPED_ROWS = ['..........', '.xxx......', 'xXXXx.xxx.', 'xXXXxxXXXx', '.xxx.xXXXx', '......xxx.', '..xxx.....', '.xXXXx....', '.xXXXx....', '..xxx.....'];
const CUT: Record<Ing, Record<string, string>> = {
  tomato: { x: '#c4453f', X: '#f08a80' },
  onion: { x: '#c98fa6', X: '#f1dde6' },
  carrot: { x: '#e07a3a', X: '#f2c27a' },
  mushroom: { x: '#c89a5c', X: '#efe3cb' },
  potato: { x: '#e2c48a', X: '#fff1c9' },
};
const Veg: React.FC<{ ing: Ing; chopped?: boolean; scale?: number }> = ({ ing, chopped, scale = 4 }) =>
  chopped ? <Sprite rows={CHOPPED_ROWS} pal={CUT[ing]} scale={scale} label={`Chopped ${ING_NAME[ing].toLowerCase()}`} /> : <Sprite rows={WHOLE[ing].rows} pal={WHOLE[ing].pal} scale={scale} label={ING_NAME[ing]} />;

const STEAM = ['.w...w...w.', 'w...w...w..', '.w...w...w.', '..w...w...w', '.w...w...w.', 'w...w...w..'];
const STEAM_PAL = { w: 'rgba(239,227,203,.75)' };
const FLAME = ['....r......', '...rr...r..', '..ryr..rr..', '.ryyrr.ryr.', '.ryyyrryyr.', 'rryyyyyyyrr'];
const FLAME_PAL = { r: '#c4453f', y: '#ffd76a' };

const a = (ing: Ing) => (ing === 'onion' ? 'an onion' : `a ${ING_NAME[ing].toLowerCase()}`);
const secs = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const Bar: React.FC<{ k: number; col: string; h?: number }> = ({ k, col, h = 8 }) => (
  <div className="w-full" style={{ height: h, background: 'rgba(43,30,28,.18)', boxShadow: 'inset 0 0 0 2px rgba(43,30,28,.35)' }}>
    <div style={{ width: `${Math.max(0, Math.min(1, k)) * 100}%`, height: '100%', background: col }} />
  </div>
);

const PAPER: React.CSSProperties = { color: 'var(--ink-soft)' };

export const KitchenGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const game = useLiveGame<KitchenState, KitchenAct>('kitchen', KITCHEN);
  const { state: s, mySeat, partner, act, stage, clock } = game;
  const now = useNow(stage === 'play' || stage === 'count', 100);
  // the times in the game are by the host's clock: this screen's "now", on the host's terms
  const hostNow = now - clock(0);
  const live = stage === 'play' && !!s && !s.over && hostNow < s.endsAt;
  const chopper = s ? s.roles.chop === mySeat : false;
  const pot = s ? potState(s, hostNow) : 'empty';

  // little sounds and a word about what just happened
  const [toast, setToast] = useState<string | null>(null);
  const seen = useRef({ news: 0, pass: 0 });
  useEffect(() => {
    if (!s) return;
    const n = s.news;
    if (n && n.at !== seen.current.news && seen.current.news !== 0) {
      if (n.kind === 'served') {
        [660, 880, 1320].forEach((f, i) => tone(f, 0.09, i * 0.07, 'triangle', 0.05));
        setToast(`${DISHES[n.dish!].name}, served!`);
      } else if (n.kind === 'wrong') {
        sfx.wrong();
        setToast('That’s not on any ticket. Into the bin it goes.');
      } else if (n.kind === 'burnt') {
        sfx.wrong();
        setToast('Burnt! The pot was left on too long.');
      } else if (n.kind === 'missed') {
        tone(220, 0.2, 0, 'triangle', 0.05);
        setToast(`A customer gave up on their ${DISHES[n.dish!].name.toLowerCase()}.`);
      }
    }
    seen.current.news = n?.at || seen.current.news || 1;
    if (s.pass.length > seen.current.pass) tone(980, 0.05, 0, 'square', 0.03);
    seen.current.pass = s.pass.length;
  }, [s]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const send = useCallback(
    (x: KitchenAct) => {
      if (!live) return;
      act(x);
    },
    [live, act]
  );
  const chop = useCallback(() => {
    if (!live || !chopper || !s?.board || s.board.chops >= CHOPS) return;
    tone(240 + s.board.chops * 50, 0.04, 0, 'square', 0.04);
    act({ t: 'chop' }, true);
  }, [live, chopper, s, act]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' && !e.repeat && chopper) {
        e.preventDefault();
        chop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chop, chopper]);

  /* ---------- what each of you is up to (under your names) ---------- */
  const note = (seat: Seat) => {
    if (!s) return '';
    if (seat === s.roles.chop) return s.board ? (s.board.chops >= CHOPS ? 'Waiting for room on the pass' : `Chopping ${a(s.board.ing)} (${s.board.chops}/${CHOPS})`) : 'Chopping';
    return pot === 'cooking' ? 'Cooking…' : pot === 'done' ? 'Ready to serve!' : pot === 'burning' ? 'It’s burning!' : pot === 'filling' ? 'Filling the pot' : 'Cooking';
  };

  /* ---------- the tickets ---------- */
  const tickets = (
    <div className="grid gap-3 w-full" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
      {(s?.orders || []).map((o) => {
        const left = o.until - hostNow;
        return (
          <div key={o.id} className="px-box px-pop px-3 py-2 flex flex-col gap-2" style={PAPER}>
            <div className="font-bold leading-tight">{DISHES[o.dish].name}</div>
            <div className="flex gap-1.5">
              {DISHES[o.dish].needs.map((i, k) => (
                <Veg key={k} ing={i} scale={3} />
              ))}
            </div>
            <Bar k={left / PATIENCE_MS} col={left < 12_000 ? '#c4453f' : left < 25_000 ? '#e2b359' : '#8a9a72'} />
          </div>
        );
      })}
      {s && s.orders.length === 0 && (
        <div className="px-box px-3 py-4 text-center opacity-80" style={PAPER}>
          No orders right now. Get ahead: chop some onions.
        </div>
      )}
    </div>
  );

  /* ---------- the pass, between the two of you ---------- */
  const pass = (
    <div className="flex flex-col gap-2 w-full">
      <div className="text-sm opacity-80">
        The pass {chopper ? `(${partner} takes from here)` : '(tap one to put it in the pot)'} · {s?.pass.length || 0}/{PASS_MAX}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(PASS_MAX).keys()].map((k) => {
          const ing = s?.pass[k];
          const can = !chopper && live && !!ing && s!.cookStart === null && s!.pot.length < POT_MAX;
          return (
            <button
              key={k}
              type="button"
              className="border-0 flex items-center justify-center"
              style={{ height: 64, background: ing ? '#efe3cb' : 'rgba(239,227,203,.12)', boxShadow: '0 0 0 3px #1b1411', cursor: can ? 'pointer' : 'default' }}
              disabled={!can}
              onClick={() => can && send({ t: 'add', i: k })}
              aria-label={ing ? `Put the chopped ${ING_NAME[ing].toLowerCase()} in the pot` : 'Empty spot on the pass'}
            >
              {ing && <Veg ing={ing} chopped scale={4} />}
            </button>
          );
        })}
      </div>
    </div>
  );

  /* ---------- the chopper's station ---------- */
  const board = s?.board;
  const station = chopper ? (
    <div className="flex flex-col gap-4 w-full">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
        {INGS.map((ing) => (
          <button
            key={ing}
            type="button"
            className="px-btn px-btn--paper flex flex-col items-center gap-1 py-2"
            disabled={!live || !!board}
            onClick={() => send({ t: 'take', ing })}
            aria-label={`Take ${a(ing)} from the crate`}
          >
            <Veg ing={ing} scale={4} />
            <span className="text-xs">{ING_NAME[ing]}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="border-0 flex flex-col items-center justify-center gap-2 select-none"
        style={{ height: 150, background: '#c89a5c', boxShadow: '0 0 0 4px #1b1411, inset 0 -6px 0 #a87a44', cursor: board ? 'pointer' : 'default', touchAction: 'manipulation', color: '#2b1e1c' }}
        onPointerDown={(e) => {
          e.preventDefault();
          chop();
        }}
        disabled={!live || !board}
        aria-label="Chop"
      >
        {board ? (
          <>
            <span style={{ transform: `rotate(${board.chops * 8 - 12}deg)` }}>
              <Veg ing={board.ing} chopped={board.chops >= CHOPS} scale={7} />
            </span>
            <span className="font-bold text-lg">{board.chops >= CHOPS ? 'Chopped! Waiting for room on the pass' : `CHOP! ${board.chops}/${CHOPS}`}</span>
          </>
        ) : (
          <span className="font-bold text-lg opacity-80">Take something from a crate</span>
        )}
      </button>
      <div className="flex justify-between items-center gap-3 flex-wrap text-sm">
        <span className="opacity-80">Tap the board (or press space) to chop.</span>
        {board && (
          <button type="button" className="px-btn px-btn--paper px-btn--small" onClick={() => send({ t: 'toss' })} disabled={!live}>
            Put it back
          </button>
        )}
      </div>
      {pass}
    </div>
  ) : (
    /* ---------- the cook's station ---------- */
    <div className="flex flex-col gap-4 w-full">
      {pass}
      <div
        className="flex flex-col items-center gap-3 py-4 px-4"
        style={{ background: '#2b2224', boxShadow: '0 0 0 4px #1b1411', outline: pot === 'burning' ? '3px solid #c4453f' : undefined, outlineOffset: 4 }}
      >
        <div className="text-sm opacity-80">The pot · {s?.pot.length || 0}/{POT_MAX}</div>
        <div className="relative flex items-center justify-center gap-2" style={{ width: 220, height: 92, background: '#4a4548', boxShadow: 'inset 0 -8px 0 #343033, 0 0 0 3px #1b1411' }}>
          {(s?.pot || []).map((i, k) => (
            <Veg key={k} ing={i} chopped scale={4} />
          ))}
          {(pot === 'cooking' || pot === 'done' || pot === 'burning') && (
            <span className={`absolute -top-9 ${pot === 'burning' ? 'game-blink' : ''}`} aria-hidden>
              <Sprite rows={pot === 'burning' ? FLAME : STEAM} pal={pot === 'burning' ? FLAME_PAL : STEAM_PAL} scale={4} />
            </span>
          )}
        </div>
        {pot === 'cooking' && s?.cookStart != null && <Bar k={(hostNow - s.cookStart) / COOK_MS} col="#e2b359" h={10} />}
        <div className="flex gap-3 flex-wrap justify-center">
          <button type="button" className="px-btn px-btn--sage" disabled={!live || pot !== 'filling'} onClick={() => send({ t: 'cook' })}>
            Cook
          </button>
          <button type="button" className={`px-btn ${pot === 'done' || pot === 'burning' ? 'px-pulse' : ''}`} disabled={!live || (pot !== 'done' && pot !== 'burning')} onClick={() => send({ t: 'serve' })}>
            Serve
          </button>
          <button type="button" className="px-btn px-btn--paper" disabled={!live || pot === 'empty'} onClick={() => send({ t: 'bin' })}>
            Bin it
          </button>
        </div>
      </div>
    </div>
  );

  const role = s ? (chopper ? `You’re chopping. ${partner}’s cooking.` : `You’re cooking. ${partner}’s chopping.`) : '';
  const left = s ? (hostNow < s.startAt ? SHIFT_MS : s.endsAt - hostNow) : SHIFT_MS;

  return (
    <LiveFrame
      title="Kitchen Rush"
      onBack={onBack}
      game={game as unknown as LiveGame<unknown, unknown>}
      howTo={
        <>
          One of you chops, the other cooks. Chop what the tickets need, put it in the pot, cook it and serve it before the ticket runs out. Ninety seconds, on the same side.
        </>
      }
      playing={
        <>
          <strong>{role}</strong> Served {s?.served || 0} · {secs(left)} left
        </>
      }
      outcome={(r) => (
        <>
          <strong>Shift over!</strong> You {r.line}.{s && (s.missed || s.burnt) ? ` (${s.missed} gave up, ${s.burnt} burnt.)` : ''}
        </>
      )}
      coop={{ active: null, note }}
      poster={
        <div className="flex justify-center gap-3 py-6">
          {INGS.map((i) => (
            <Veg key={i} ing={i} scale={8} />
          ))}
        </div>
      }
      width={860}
    >
      <div className="flex flex-col items-center gap-4 relative">
        {tickets}
        {station}
        {toast && (
          <div className="fixed left-1/2 bottom-6 -translate-x-1/2 z-40 px-box px-shadow px-fade px-4 py-2 text-center" style={PAPER} role="status">
            {toast}
          </div>
        )}
      </div>
    </LiveFrame>
  );
};

