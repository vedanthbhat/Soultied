import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useTogether } from '../../together/TogetherContext';
import { newKey } from '../../together/useSharedDoc';
import { useSharedList, type SharedList } from '../../together/useSharedList';
import { demoNotes, doodleArt, doodleFields, normalizeNote, type Note } from '../../together/wall';
import { DoodlePad } from './DoodlePad';

export function WallDoodle({ notes, onDone }: { notes: SharedList<Note>; onDone: () => void }) {
  const { currentUser, partnerUser, space } = useApp();
  const { pinned, hangArt } = useTogether();
  return (
    <DoodlePad
      partnerName={partnerUser?.name || space?.partnerPlaceholderName || 'your person'}
      onCancel={onDone}
      onSend={(pixels, hang) => {
        const id = newKey('note-');
        notes.put(id, {
          by: currentUser.id,
          kind: 'doodle',
          ...doodleFields(pixels),
          paper: 0,
          at: Date.now(),
          loved: {},
          kept: false,
        });
        pinned('doodle', id);
        if (hang) hangArt(doodleArt(pixels, id, currentUser.id));
        onDone();
      }}
    />
  );
}

function InvitePad({ onDone }: { onDone: () => void }) {
  const notes = useSharedList<Note>('note-', normalizeNote, demoNotes);
  return <WallDoodle notes={notes} onDone={onDone} />;
}

export function InviteDoodle() {
  const [drawing, setDrawing] = useState(false);
  return drawing ? (
    <InvitePad onDone={() => setDrawing(false)} />
  ) : (
    <button type="button" className="px-link self-start" onClick={() => setDrawing(true)}>
      Leave them a doodle
    </button>
  );
}
