import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Seat } from '../../games/types';
import type { LiveGame } from '../../games/live/useLiveGame';
import { GameFrame, GameShell, MiniChip, type CoopChips } from './GameFrame';
import type { LiveResult } from '../../games/live/lobby';

/** Re-render every `ms` while `on`, for countdowns and timers. */
export function useNow(on: boolean, ms = 100) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [on, ms]);
  return on ? now : Date.now();
}

/** how much room a game that fills the screen has for its board (in CSS pixels), under the bar along the top */
const StageSize = createContext<{ w: number; h: number } | null>(null);
export const useStage = () => useContext(StageSize);
/** for a game's own screen (which sits outside the stage): what's drawn depends on the room there is */
export const WithStage: React.FC<{ children: (stage: { w: number; h: number } | null) => React.ReactNode }> = ({ children }) => <>{children(useStage())}</>;

/** the part of the screen under the bar: the game's board fills it */
const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative flex-1 min-h-0 flex flex-col">
      <StageSize.Provider value={size}>{children}</StageSize.Provider>
    </div>
  );
};

/** a little burst of pixel confetti, for a win (or a shift you finished together) */
const Confetti: React.FC = () => {
  const bits = useRef(
    [...Array(36).keys()].map((i) => ({
      left: (i * 37) % 100,
      delay: (i % 9) * 0.07,
      dur: 1.3 + ((i * 13) % 7) / 10,
      color: ['#ffd76a', '#e07a5f', '#8fb8c9', '#9ec28a', '#efe3cb'][i % 5],
      size: 6 + (i % 3) * 3,
    })),
  ).current;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
      <style>{`
        @keyframes live-fall { from { transform: translateY(-20px) rotate(0deg); opacity: 1; } to { transform: translateY(110vh) rotate(540deg); opacity: .9; } }
        @media (prefers-reduced-motion: reduce) { .live-bit { display: none; } }
      `}</style>
      {bits.map((b, i) => (
        <span
          key={i}
          className="live-bit absolute top-0"
          style={{ left: `${b.left}%`, width: b.size, height: b.size, background: b.color, animation: `live-fall ${b.dur}s ${b.delay}s steps(14) both` }}
        />
      ))}
    </div>
  );
};

const LINK_WORDS: Record<string, string> = {
  connecting: 'Connecting the two of you…',
  direct: 'Connected directly',
  relay: 'Connected through the cloud: a touch slower than direct',
  local: 'Connected',
  waiting: '',
};

/**
 * Everything around a live game: inviting your person, waiting for them,
 * the countdown, and the result. The game itself is `children`, shown once
 * there's a game to show.
 */
export const LiveFrame: React.FC<{
  title: string;
  onBack: () => void;
  game: LiveGame<unknown, unknown>;
  marker?: (s: Seat) => React.ReactNode;
  /** a line on how to play, shown before the game starts */
  howTo: React.ReactNode;
  /** the status line while playing */
  playing: React.ReactNode;
  /** something to look at before the game starts */
  poster?: React.ReactNode;
  width?: number;
  /** games you play on the same side: what each of you is up to, instead of wins */
  coop?: CoopChips;
  /** how the end of the game reads, instead of who won (for games you play together) */
  outcome?: (r: LiveResult) => React.ReactNode;
  children?: React.ReactNode;
}> = ({ title, onBack, game, marker, howTo, playing, poster, width = 820, coop, outcome, children }) => {
  const { partner, ready, mySeat, result, startAt, partnerHere, mode, demo, match, rule } = game;
  const now = useNow(game.stage === 'count' || game.stage === 'waiting', 100);
  // the countdown ends on this screen's clock, whether or not anything else has changed
  const stage = game.stage === 'count' && now >= startAt ? 'play' : game.stage;
  const left = Math.max(0, Math.ceil((startAt - now) / 1000));

  let status: React.ReactNode;
  let actions: React.ReactNode = null;
  if (!ready) status = <>Live games need two. Once {partner} has joined your place, you can play here together.</>;
  else if (stage === 'idle' || (stage === 'over' && !result)) {
    status = stage === 'over' ? <>That game was stopped. {howTo}</> : howTo;
    actions = (
      <button className="px-btn px-btn--sage" onClick={game.invite}>
        Invite {partner} to play
      </button>
    );
  } else if (stage === 'inviting') {
    status = (
      <>
        Waiting for <strong>{partner}</strong> to join. They’ll see your invitation in the room (or here, if they’re already looking).
      </>
    );
    actions = (
      <button className="px-btn px-btn--paper" onClick={game.cancel}>
        Cancel
      </button>
    );
  } else if (stage === 'invited') {
    status = (
      <>
        <strong>{partner} wants to play {title} with you, right now.</strong> {howTo}
      </>
    );
    actions = (
      <button className="px-btn px-btn--sage" onClick={game.join}>
        Join {partner}
      </button>
    );
  } else if (stage === 'waiting') {
    status = partnerHere ? (
      <>Getting the game ready…</>
    ) : (
      <>
        Waiting for <strong>{partner}</strong> to open {title}…
      </>
    );
    actions = (
      <button className="px-btn px-btn--paper" onClick={game.cancel}>
        Stop
      </button>
    );
  } else if (stage === 'count') status = <>Get ready… {howTo}</>;
  else if (stage === 'play') status = !partnerHere ? <>{partner}’s screen has gone quiet. Waiting for them to come back…</> : playing;
  else if (stage === 'over' && result) {
    status = outcome ? (
      outcome(result)
    ) : result.winner === 'draw' ? (
        <>
          <strong>A draw!</strong>
        </>
      ) : result.winner === mySeat ? (
        <>
          <strong>You win!</strong> You {result.line}.
        </>
      ) : (
        <>
          <strong>{partner} wins.</strong> They {result.line}.
        </>
      );
    actions = (
      <button className="px-btn px-btn--sage" onClick={game.invite}>
        Play again
      </button>
    );
  }

  const showGame = !!game.state && (stage === 'count' || stage === 'play' || stage === 'over');
  const linkLine = !demo && match?.status === 'playing' ? LINK_WORDS[mode] : '';

  // before the game: the usual page, with how to play, the invitation and this game's house rule
  if (!showGame) {
    return (
      <GameFrame title={title} onBack={onBack} match={game.m} marker={marker} status={status} width={width} actions={actions} coop={coop}>
        {rule && (stage === 'inviting' || stage === 'invited' || stage === 'waiting') && (
          <div className="px-box flex items-center gap-3 px-4 py-3 flex-wrap" style={{ color: 'var(--ink-soft)', background: '#fff4d6', boxShadow: '0 0 0 3px #e2b359' }}>
            <span className="flex flex-col min-w-0 flex-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: '#a84f4b' }}>
                House rule
              </span>
              <strong className="text-lg leading-tight">{rule.name}</strong>
              <span className="text-sm leading-snug">{rule.line}</span>
            </span>
            {game.canReroll && (
              <button className="px-btn px-btn--paper px-btn--small" onClick={game.reroll} title="Swap it for another rule (once a game)">
                Another rule
              </button>
            )}
          </div>
        )}
        <div className="relative">{poster}</div>
      </GameFrame>
    );
  }

  // the game itself fills the screen: a thin bar along the top, and the board under it
  const them: Seat = mySeat === 'a' ? 'b' : 'a';
  const over = stage === 'over';
  const cheer = over && !!result && (!!outcome || result.winner === mySeat);
  return (
    <GameShell>
      <div className="mx-auto w-full flex flex-col gap-2 px-3 pt-3 pb-3" style={{ maxWidth: Math.max(width, 640), height: '100dvh' }}>
        <div className="flex items-center gap-3">
          <button className="px-btn px-btn--paper px-btn--small shrink-0" onClick={onBack} aria-label="Leave the game, back to all games">
            ✕
          </button>
          <MiniChip seat={mySeat} note={coop ? coop.note(mySeat) : undefined} />
          <span className="text-sm font-bold opacity-60 shrink-0">{coop ? '&' : 'vs'}</span>
          <MiniChip seat={them} note={coop ? coop.note(them) : undefined} />
          <span className="ml-auto flex items-center gap-2 min-w-0">
            {rule && (
              <span className="px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ background: '#e2b359', color: '#2b1e1c' }} title={rule.line}>
                {rule.name}
              </span>
            )}
            <span className="text-lg font-bold truncate hidden sm:inline">{title}</span>
          </span>
        </div>
        <div className="text-sm leading-snug min-h-[1.25rem] opacity-90" role="status" aria-live="polite">
          {over ? null : stage === 'count' ? <>Get ready…</> : status}
          {linkLine && !over && <span className="opacity-60"> · {linkLine}</span>}
        </div>
        <Stage>
          {children}
          {stage === 'count' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-live="assertive">
              <div className="px-box px-shadow px-pop flex flex-col items-center px-8 py-4" style={{ color: 'var(--ink-soft)' }}>
                <div className="text-sm font-semibold uppercase tracking-[0.14em] opacity-80">Starting in</div>
                <div className="text-7xl font-bold leading-none">{left || '…'}</div>
                {rule && (
                  <div className="mt-2 text-center max-w-[260px] leading-snug">
                    <strong>House rule: {rule.name}</strong>
                    <div className="text-sm">{rule.line}</div>
                  </div>
                )}
              </div>
            </div>
          )}
          {over && (
            <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(27,20,17,.55)' }}>
              {cheer && <Confetti />}
              <div className="px-box px-shadow px-pop flex flex-col items-center gap-3 px-6 py-5 text-center max-w-[420px]" style={{ color: 'var(--ink-soft)' }} role="status">
                <div className="text-xl leading-snug">{status}</div>
                <div className="flex gap-3 flex-wrap justify-center">
                  {actions}
                  <button className="px-btn px-btn--paper" onClick={onBack}>
                    All games
                  </button>
                </div>
              </div>
            </div>
          )}
        </Stage>
      </div>
    </GameShell>
  );
};
