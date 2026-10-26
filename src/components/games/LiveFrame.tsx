import React, { useEffect, useState } from 'react';
import type { Seat } from '../../games/types';
import type { LiveGame } from '../../games/live/useLiveGame';
import { GameFrame, type CoopChips } from './GameFrame';
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
  const { partner, ready, mySeat, result, startAt, partnerHere, mode, demo, match } = game;
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

  return (
    <GameFrame title={title} onBack={onBack} match={game.m} marker={marker} status={status} width={width} actions={actions} coop={coop}>
      {linkLine && <div className="text-xs text-center opacity-70 -mt-2">{linkLine}</div>}
      <div className="relative">
        {showGame ? children : poster}
        {stage === 'count' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-live="assertive">
            <div className="px-box px-shadow flex flex-col items-center px-8 py-4" style={{ color: 'var(--ink-soft)' }}>
              <div className="text-sm font-semibold uppercase tracking-[0.14em] opacity-80">Starting in</div>
              <div className="text-7xl font-bold leading-none">{left || '…'}</div>
            </div>
          </div>
        )}
      </div>
    </GameFrame>
  );
};
