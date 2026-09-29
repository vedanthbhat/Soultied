/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { RoomCanvas } from './components/RoomCanvas';
import { TopNav } from './components/TopNav';
import { PixelPanel } from './components/PixelPanel';
import { Welcome } from './components/Welcome';
import { CharacterStudio } from './components/CharacterStudio';
import { SpacePanel } from './components/SpacePanel';
import { LettersPanel } from './components/letters/LettersPanel';
import { UsPage } from './components/UsPage';
import { WatchParty } from './components/WatchParty';
import { EscapeGame } from './components/escape/EscapeGame';
import type { Seat, HotspotId } from './pixel/room';
import type { UserProfile } from './types';
import type { GameKind, Match } from './games/types';
import { prettyDate } from './letters/engine';
import { COUCH_STEPS } from './couch';
import { StreamChip, StreamHubProvider } from './stream/StreamHub';
import { GamesProvider, useGames } from './games/GamesContext';
import { GAMES, otherSeat } from './games/types';
import { GameShelf } from './components/games/GameShelf';
import { noteFor, waitingLabel } from './games/registry';

const seatOf = (u: UserProfile | null | undefined, placeholder = ''): Seat =>
  u ? { avatar: u.avatar, name: u.name, status: u.status } : { avatar: null, name: placeholder, status: 'empty' };

function readJoinCode() {
  try {
    return new URLSearchParams(window.location.search).get('join');
  } catch {
    return null;
  }
}

function clearJoinParam() {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('join')) {
      url.searchParams.delete('join');
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    // ignore
  }
}

const WardrobePanel: React.FC = () => {
  const { currentUser, updateAvatar, openPanel } = useApp();
  const [draft, setDraft] = useState(currentUser.avatar);
  return (
    <div className="flex flex-col gap-5">
      <CharacterStudio value={draft} onChange={setDraft} />
      <div className="flex justify-end gap-3">
        <button className="px-btn px-btn--paper" onClick={() => openPanel(null)}>
          Cancel
        </button>
        <button
          className="px-btn"
          onClick={() => {
            updateAvatar(draft);
            openPanel(null);
          }}
        >
          Save my look
        </button>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  const { setupComplete, currentUser, partnerUser, space, panel, openPanel, letterBadge, getLetter, today } = useApp();
  const { couchLevel, couchShown, markCouchShown, cloudStatus, demo } = useApp();
  const games = useGames();
  const [joinCode] = useState(readJoinCode);
  const [welcomeOpen, setWelcomeOpen] = useState(() => !setupComplete || !!joinCode);
  const [draftSeats, setDraftSeats] = useState<{ left: Seat; right: Seat } | null>(null);

  // If the app is reset from inside, go back to the welcome sheet.
  useEffect(() => {
    if (!setupComplete) setWelcomeOpen(true);
  }, [setupComplete]);

  // Seats are fixed by who created the place, so both partners see the same room.
  const creatorIsMe = !space || space.creatorId === currentUser.id;
  const host = creatorIsMe ? currentUser : partnerUser;
  const guest = creatorIsMe ? partnerUser : currentUser;
  const liveLeft = seatOf(host);
  const liveRight = seatOf(guest, space?.partnerPlaceholderName);

  const letterUnread = letterBadge !== null;
  const partnerSealed = !!partnerUser && !!getLetter('daily')?.by[partnerUser.id]?.sealedAt;

  const labels = useMemo(() => {
    if (welcomeOpen) return {};
    const l: Partial<Record<HotspotId, string>> = {
      letter:
        letterBadge === 'reveal'
          ? 'Your letter is open ✉'
          : letterBadge === 'answer'
            ? partnerSealed
              ? `${partnerUser?.name} is waiting on today’s letter ✉`
              : 'Today’s letter ✉'
            : 'Letters',
      fire: 'Poke the fire',
      photo: 'Us',
      remote: 'Watch something together',
      door: 'The dark door',
      games: games.waiting.length
        ? games.waiting
            .map((k) => waitingLabel(games.matches[k] as Match, games.seatName(otherSeat(games.mySeat)), GAMES[k].name))
            .join(' · ')
        : 'Games',
    };
    const meLabel = `${currentUser.name} · change my look`;
    if (host) l.left = host.id === currentUser.id ? meLabel : host.name;
    if (guest) l.right = guest.id === currentUser.id ? meLabel : guest.name;
    else l.right = `Invite ${space?.partnerPlaceholderName || 'your person'}`;
    return l;
  }, [welcomeOpen, letterBadge, partnerSealed, partnerUser, currentUser, host, guest, space, games.waiting]);

  const onHotspot = (id: HotspotId) => {
    if (id === 'letter') openPanel('question');
    else if (id === 'photo') openPanel('us');
    else if (id === 'remote') openPanel('watch');
    else if (id === 'door') openPanel('escape');
    else if (id === 'games') openPanel('games');
    else if (id === 'left' || id === 'right') {
      const who = id === 'left' ? host : guest;
      if (!who) openPanel('space');
      else if (who.id === currentUser.id) openPanel('wardrobe');
      else openPanel('us');
    }
  };

  const seats = welcomeOpen && draftSeats ? draftSeats : { left: liveLeft, right: liveRight };

  // A day you both showed up: once the room is in view, scoot closer (each of you sees it once).
  const scootPending = couchShown < couchLevel;
  const [scootGo, setScootGo] = useState(false);
  const [couchNote, setCouchNote] = useState<string | null>(null);
  useEffect(() => {
    if (!scootPending || welcomeOpen || panel) return;
    const t = window.setTimeout(() => {
      setScootGo(true);
      setCouchNote(
        couchLevel >= COUCH_STEPS
          ? `Seven days of showing up. You and ${partnerUser?.name || 'your person'} are sitting side by side now.`
          : `You both showed up, so you scooted a little closer on the couch. ${couchLevel} of ${COUCH_STEPS}.`
      );
    }, 900);
    return () => window.clearTimeout(t);
  }, [scootPending, welcomeOpen, panel, couchLevel, partnerUser]);
  useEffect(() => {
    if (!couchNote) return;
    const t = window.setTimeout(() => setCouchNote(null), 6500);
    return () => window.clearTimeout(t);
  }, [couchNote]);
  const closeness = (scootPending && !scootGo ? couchShown : couchLevel) / COUCH_STEPS;

  // "Rohan dropped a firefly. Your move." once for each move they make
  const [gameToOpen, setGameToOpen] = useState<GameKind | null>(null);
  useEffect(() => {
    if (panel !== 'games') setGameToOpen(null);
  }, [panel]);
  const [seenNotes, setSeenNotes] = useState<Set<string>>(() => new Set());
  const gameNote = useMemo(() => {
    for (const kind of games.waiting) {
      const m = games.matches[kind];
      if (!m || m.updatedBy === games.mySeat) continue;
      const key = `${kind}:${m.id}:${m.seq}`;
      if (seenNotes.has(key)) continue;
      const text = noteFor(m, games.seatName(otherSeat(games.mySeat)), GAMES[kind].name);
      return { key, kind, text };
    }
    return null;
  }, [games, seenNotes]);
  const dismissGameNote = () => gameNote && setSeenNotes((s) => new Set(s).add(gameNote.key));
  // signed in and still fetching your place: don't flash a room that isn't yours yet
  const veil = cloudStatus === 'checking' && !welcomeOpen && !demo;

  if (panel === 'escape' && !welcomeOpen) {
    return (
      <div className="font-['Pixelify_Sans',sans-serif]">
        <EscapeGame onExit={() => openPanel(null)} />
      </div>
    );
  }

  if (panel === 'games' && !welcomeOpen) {
    return (
      <div className="font-['Pixelify_Sans',sans-serif]">
        <GameShelf onExit={() => openPanel(null)} onOpenDoor={() => openPanel('escape')} initial={gameToOpen} />
      </div>
    );
  }

  if (panel === 'watch' && !welcomeOpen) {
    return (
      <div className="font-['Pixelify_Sans',sans-serif]">
        <WatchParty onExit={() => openPanel(null)} />
      </div>
    );
  }

  return (
    <div className="font-['Pixelify_Sans',sans-serif]">
      <RoomCanvas
        left={seats.left}
        right={seats.right}
        letterUnread={welcomeOpen ? false : letterUnread}
        gamesWaiting={!welcomeOpen && games.waiting.length > 0}
        labels={labels}
        onHotspot={onHotspot}
        dim={panel ? 0.25 : 0}
        closeness={closeness}
        scoot={scootGo}
        onScooted={(c) => {
          if (scootPending && c * COUCH_STEPS >= couchLevel - 1e-6) {
            markCouchShown(couchLevel);
            setScootGo(false);
          }
        }}
      />

      {!welcomeOpen && !veil && <StreamChip />}

      {gameNote && !welcomeOpen && !veil && !couchNote && (
        <div className="fixed right-4 bottom-4 z-30 px-ui max-w-[92vw]" role="status">
          <div className="px-box px-shadow px-fade px-3 py-2 flex items-center gap-3 flex-wrap">
            <span className="text-sm">{gameNote.text}</span>
            <button
              className="px-btn px-btn--sage px-btn--small"
              onClick={() => {
                setGameToOpen(gameNote.kind);
                dismissGameNote();
                openPanel('games');
              }}
            >
              Play
            </button>
            <button className="px-btn px-btn--paper px-btn--small" aria-label="Not now" onClick={dismissGameNote}>
              Later
            </button>
          </div>
        </div>
      )}

      {couchNote && !welcomeOpen && (
        <div className="fixed left-1/2 bottom-5 z-30 -translate-x-1/2 px-ui w-[min(92vw,460px)]" role="status">
          <div className="px-box px-shadow px-fade px-4 py-2.5 text-center leading-snug">{couchNote}</div>
        </div>
      )}

      {welcomeOpen ? (
        <Welcome
          initialJoinCode={joinCode}
          onDraftSeats={setDraftSeats}
          onDone={() => {
            clearJoinParam();
            setDraftSeats(null);
            setWelcomeOpen(false);
          }}
        />
      ) : veil ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(30,22,18,0.55)] px-ui" role="status">
          <div className="px-box px-shadow px-fade px-6 py-4 text-xl">Opening the door…</div>
        </div>
      ) : (
        <>
          <TopNav letterUnread={letterUnread} />

          {(panel === 'question' || panel === 'questions') && (
            <PixelPanel title="Letters" kicker={prettyDate(today, true)} onClose={() => openPanel(null)} width={680}>
              <LettersPanel initialTab={panel === 'questions' ? 'past' : 'today'} />
            </PixelPanel>
          )}
          {panel === 'us' && (
            <PixelPanel title="Us" kicker={space?.name} onClose={() => openPanel(null)} width={820}>
              <UsPage />
            </PixelPanel>
          )}
          {panel === 'wardrobe' && (
            <PixelPanel title="Your look" kicker="Wardrobe" onClose={() => openPanel(null)} width={880}>
              <WardrobePanel />
            </PixelPanel>
          )}
          {panel === 'space' && (
            <PixelPanel title={partnerUser ? 'Our place' : 'Invite your person'} kicker={space?.name} onClose={() => openPanel(null)} width={640}>
              <SpacePanel />
            </PixelPanel>
          )}
        </>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <StreamHubProvider>
        <GamesProvider>
          <Home />
        </GamesProvider>
      </StreamHubProvider>
    </AppProvider>
  );
}
