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
import { SpacePanel, LetterPanel } from './components/SpacePanel';
import { DailyQuestionCard } from './components/DailyQuestionCard';
import { QuestionsPage } from './components/QuestionsPage';
import { UsPage } from './components/UsPage';
import { WatchParty } from './components/WatchParty';
import type { Seat, HotspotId } from './pixel/room';
import type { UserProfile } from './types';

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
  const { setupComplete, currentUser, partnerUser, space, dailySession, panel, openPanel } = useApp();
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

  const letterUnread =
    !!partnerUser && !dailySession.revealed && !dailySession.submittedUserIds.includes(currentUser.id);

  const labels = useMemo(() => {
    if (welcomeOpen) return {};
    const l: Partial<Record<HotspotId, string>> = {
      letter: letterUnread ? 'A letter for you two ✉' : 'Today’s letter',
      fire: 'Poke the fire',
      photo: 'Us',
      remote: 'Watch something together',
    };
    const meLabel = `${currentUser.name} · change my look`;
    if (host) l.left = host.id === currentUser.id ? meLabel : host.name;
    if (guest) l.right = guest.id === currentUser.id ? meLabel : guest.name;
    else l.right = `Invite ${space?.partnerPlaceholderName || 'your person'}`;
    return l;
  }, [welcomeOpen, letterUnread, currentUser, host, guest, space]);

  const onHotspot = (id: HotspotId) => {
    if (id === 'letter') openPanel('question');
    else if (id === 'photo') openPanel('us');
    else if (id === 'remote') openPanel('watch');
    else if (id === 'left' || id === 'right') {
      const who = id === 'left' ? host : guest;
      if (!who) openPanel('space');
      else if (who.id === currentUser.id) openPanel('wardrobe');
      else openPanel('us');
    }
  };

  const seats = welcomeOpen && draftSeats ? draftSeats : { left: liveLeft, right: liveRight };

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
        labels={labels}
        onHotspot={onHotspot}
        dim={panel ? 0.25 : 0}
      />

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
      ) : (
        <>
          <TopNav letterUnread={letterUnread} />

          {panel === 'question' && (
            <PixelPanel title="Today’s letter" kicker={dailySession.question.category} onClose={() => openPanel(null)} width={620}>
              <LetterPanel>
                <DailyQuestionCard />
              </LetterPanel>
            </PixelPanel>
          )}
          {panel === 'questions' && (
            <PixelPanel title="Questions" kicker="Little things to ask each other" onClose={() => openPanel(null)} width={900}>
              <QuestionsPage />
            </PixelPanel>
          )}
          {panel === 'us' && (
            <PixelPanel title="Us" kicker={space?.name} onClose={() => openPanel(null)} width={900}>
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
      <Home />
    </AppProvider>
  );
}
