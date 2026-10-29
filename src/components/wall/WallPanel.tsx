import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { UserProfile } from '../../types';
import { AvatarThumb } from '../PixelAvatarRenderer';
import { PixelIcon } from '../letters/PixelIcon';
import { useTogether } from '../../together/TogetherContext';
import { newKey, useSharedDoc } from '../../together/useSharedDoc';
import { type SharedList, useSharedList } from '../../together/useSharedList';
import {
  MEMORY_TEXT_MAX,
  MEMORY_TITLE_MAX,
  NOTE_MAX,
  NOTE_PAPERS,
  type Memory,
  type Note,
  type Photo,
  demoMemories,
  demoNotes,
  doodleArt,
  normalizeMemories,
  normalizeNote,
  normalizePhoto,
} from '../../together/wall';
import { todayKey } from '../../letters/engine';
import { DoodleImage, DoodlePad } from './DoodlePad';
import { PhotosTab } from './PhotosTab';

/**
 * Our wall: notes and doodles you pin up for each other, your photos, and the memories you keep.
 * Opened from the pictures over the couch (or the menu).
 */

export type WallTab = 'notes' | 'doodle' | 'photos' | 'memories';

const Head: React.FC<{ who: UserProfile | null | undefined; size?: number }> = ({ who, size = 22 }) =>
  who ? (
    <span className="shrink-0 -my-1" title={who.name}>
      <AvatarThumb config={who.avatar} region="head" size={size} />
    </span>
  ) : null;

function ago(at: number) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const noDemo = () => ({});

/* ---------- notes ---------- */

const NoteCard: React.FC<{
  n: Note;
  me: UserProfile;
  partner: UserProfile | null;
  fresh: boolean;
  onLove: () => void;
  onKeep: () => void;
  onTakeDown: () => void;
  onHang: () => void;
}> = ({ n, me, partner, fresh, onLove, onKeep, onTakeDown, onHang }) => {
  const mine = n.by === me.id;
  const author = mine ? me : partner;
  const lovedByThem = partner && n.loved[partner.id];
  const lovedByMe = !!n.loved[me.id];
  const [hung, setHung] = useState(false);
  return (
    <li
      className={`flex flex-col gap-2 p-3 shadow-[0_0_0_2px_#3a2a26,3px_3px_0_2px_rgba(58,42,38,0.35)] ${fresh ? 'px-pop' : 'px-fade'}`}
      style={{ background: NOTE_PAPERS[n.paper] }}
    >
      <div className="flex items-center gap-2 text-xs text-[#5a4a42]">
        <Head who={author} />
        <span className="leading-tight min-w-0">
          <span className="font-semibold block">{mine ? 'You' : author?.name || 'Your person'}</span>
          <span>{ago(n.at)}</span>
        </span>
        {fresh && <span className="px-tag px-tag--sage ml-auto">New</span>}
        {n.kept && !fresh && (
          <span className="ml-auto" title="Kept with your memories">
            <PixelIcon name="seal" scale={2} label="Kept" />
          </span>
        )}
      </div>
      {n.kind === 'doodle' ? <DoodleImage px={n.doodle} label={`A doodle from ${mine ? 'you' : author?.name || 'your person'}`} /> : <p className="m-0 leading-snug whitespace-pre-line break-words text-[#3a2a26]">{n.text}</p>}
      <div className="flex items-center gap-3 flex-wrap text-sm">
        {!mine && (
          <button className="px-link" aria-pressed={lovedByMe} onClick={onLove}>
            {lovedByMe ? '♥ Loved' : '♡ Love it'}
          </button>
        )}
        {mine && lovedByThem && <span className="text-[#a84f4b] font-semibold">♥ {partner!.name} loved this</span>}
        <button className="px-link" onClick={onKeep}>
          {n.kept ? 'Kept ✓' : 'Keep'}
        </button>
        {n.kind === 'doodle' && (
          <button
            className="px-link"
            onClick={() => {
              onHang();
              setHung(true);
            }}
          >
            {hung ? 'Hung ✓' : 'Hang it'}
          </button>
        )}
        {mine && (
          <button className="px-link ml-auto" onClick={onTakeDown}>
            Take down
          </button>
        )}
      </div>
    </li>
  );
};

const NotesTab: React.FC<{
  notes: SharedList<Note>;
  me: UserProfile;
  partner: UserProfile | null;
  partnerName: string;
  seenBefore: number;
  onDoodle: () => void;
  onPinned: () => void;
  onHangDoodle: (n: Note) => void;
}> = ({ notes, me, partner, partnerName, seenBefore, onDoodle, onPinned, onHangDoodle }) => {
  const [text, setText] = useState('');
  const [paper, setPaper] = useState(0);
  const [all, setAll] = useState(false);
  const shown = notes.items.filter((n) => !n.gone).reverse();
  const list = all ? shown : shown.slice(0, 24);

  return (
    <div className="flex flex-col gap-4">
      <form
        className="px-inset p-3.5 flex flex-col gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t) return;
          const id = newKey('note-');
          notes.put(id, { by: me.id, kind: 'text', text: t.slice(0, NOTE_MAX), paper, at: Date.now(), loved: {}, kept: false });
          onPinned();
          setText('');
        }}
      >
        <label className="px-label m-0" htmlFor="note-text">
          A note for {partnerName}
        </label>
        <textarea
          id="note-text"
          className="px-input"
          rows={3}
          maxLength={NOTE_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Something small: what made you think of them today"
          style={{ background: NOTE_PAPERS[paper] }}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5" role="group" aria-label="Paper">
            {NOTE_PAPERS.map((c, i) => (
              <button
                key={c}
                type="button"
                aria-label={`Paper ${i + 1}`}
                aria-pressed={paper === i}
                onClick={() => setPaper(i)}
                className="w-6 h-6 p-0 border-0 cursor-pointer"
                style={{ background: c, boxShadow: paper === i ? '0 0 0 2px #3a2a26, 0 0 0 4px #fff1c9' : '0 0 0 2px #3a2a26' }}
              />
            ))}
          </div>
          <button className="px-btn px-btn--small" type="submit" disabled={!text.trim()}>
            Pin it up
          </button>
          <button type="button" className="px-link text-sm" onClick={onDoodle}>
            or draw a doodle
          </button>
        </div>
      </form>

      {!notes.ready ? (
        <p className="m-0 text-[var(--muted)]">Opening…</p>
      ) : list.length ? (
        <ul className="list-none p-0 m-0 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
          {list.map((n) => (
            <NoteCard
              key={n.id}
              n={n}
              me={me}
              partner={partner}
              fresh={n.by !== me.id && n.at > seenBefore}
              onLove={() => notes.patch(n.id, { loved: { [me.id]: n.loved[me.id] ? null : Date.now() } })}
              onKeep={() => notes.patch(n.id, { kept: !n.kept })}
              onTakeDown={() => notes.patch(n.id, { gone: true })}
              onHang={() => onHangDoodle(n)}
            />
          ))}
        </ul>
      ) : (
        <p className="m-0 text-[var(--muted)] leading-snug">Nothing pinned up yet. Leave {partnerName} the first note: they’ll find it on the wall over the couch.</p>
      )}
      {shown.length > list.length && (
        <button className="px-link text-sm self-start" onClick={() => setAll(true)}>
          Show all {shown.length}
        </button>
      )}
    </div>
  );
};

/* ---------- memories ---------- */

interface Entry {
  key: string;
  day: string;
  title: string;
  text?: string;
  thumb?: string;
  doodle?: string;
  icon: 'heart' | 'seal' | 'couch' | 'envelope' | 'book';
  memoryId?: string;
  by?: string;
}

const dayOf = (ms: number) => todayKey(new Date(ms));
const monthLabel = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const dayLabel = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const MemoryForm: React.FC<{ photos: Photo[]; onSave: (m: Omit<Memory, 'id' | 'by' | 'at'>) => void; onCancel: () => void }> = ({ photos, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [day, setDay] = useState(todayKey());
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState('');
  return (
    <form
      className="px-inset p-4 flex flex-col gap-3 px-fade"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim() || !day) return;
        onSave({ title: title.trim(), day, text: text.trim(), photo });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <span className="px-label m-0 text-sm">What happened</span>
        <input className="px-input" maxLength={MEMORY_TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Our first dance in the kitchen" autoFocus />
      </label>
      <label className="flex flex-col gap-1.5 max-w-[220px]">
        <span className="px-label m-0 text-sm">When</span>
        <input className="px-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="px-label m-0 text-sm">A few words, if you like</span>
        <textarea className="px-input" rows={3} maxLength={MEMORY_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      {photos.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="px-label m-0 text-sm">A photo from your wall</span>
          <div className="flex gap-2 flex-wrap">
            {photos.slice(0, 12).map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={photo === p.id}
                aria-label={p.caption || 'A photo'}
                onClick={() => setPhoto(photo === p.id ? '' : p.id)}
                className="p-0 border-0 cursor-pointer bg-transparent"
                style={{ boxShadow: photo === p.id ? '0 0 0 3px #3a2a26, 0 0 0 6px #fff1c9' : '0 0 0 2px #3a2a26' }}
              >
                <img src={p.thumb} alt="" className="block w-14 h-14 object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <button className="px-btn" type="submit" disabled={!title.trim() || !day}>
          Keep it
        </button>
        <button className="px-btn px-btn--paper px-btn--small" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
};

const MemoriesTab: React.FC<{
  entries: Entry[];
  photos: Photo[];
  me: UserProfile;
  onAdd: (m: Omit<Memory, 'id' | 'by' | 'at'>) => void;
  onRemove: (id: string) => void;
}> = ({ entries, photos, me, onAdd, onRemove }) => {
  const [adding, setAdding] = useState(false);
  const today = todayKey();
  const onThisDay = entries.filter((e) => e.day.slice(5) === today.slice(5) && e.day < today);
  const groups = useMemo(() => {
    const g: Array<{ month: string; items: Entry[] }> = [];
    for (const e of entries) {
      const m = monthLabel(e.day);
      if (!g.length || g[g.length - 1].month !== m) g.push({ month: m, items: [] });
      g[g.length - 1].items.push(e);
    }
    return g;
  }, [entries]);

  return (
    <div className="flex flex-col gap-4">
      {adding ? (
        <MemoryForm
          photos={photos}
          onSave={(m) => {
            onAdd(m);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <button className="px-btn px-btn--sage" onClick={() => setAdding(true)}>
            Add a memory
          </button>
          <span className="text-sm text-[var(--muted)] leading-snug flex-1 min-w-[200px]">Your photos, the notes you keep, and the days you write down, all in one place. Always free.</span>
        </div>
      )}

      {onThisDay.length > 0 && (
        <div className="px-inset p-3.5 flex flex-col gap-1.5" style={{ background: '#f6e39a' }}>
          <span className="px-tag self-start">On this day</span>
          {onThisDay.map((e) => (
            <div key={e.key} className="leading-snug">
              <span className="font-bold">{e.title}</span>{' '}
              <span className="text-sm text-[#5a4a42]">
                · {Number(today.slice(0, 4)) - Number(e.day.slice(0, 4)) === 1 ? 'a year ago' : `${Number(today.slice(0, 4)) - Number(e.day.slice(0, 4))} years ago`}
              </span>
            </div>
          ))}
        </div>
      )}

      {groups.map((g) => (
        <section key={g.month} className="flex flex-col gap-2">
          <h3 className="m-0 text-lg font-bold">{g.month}</h3>
          <ol className="list-none p-0 m-0 flex flex-col gap-2 border-l-[3px] border-dashed border-[var(--paper-shade)] pl-3">
            {g.items.map((e) => (
              <li key={e.key} className="px-inset p-3 flex gap-3 items-start">
                {e.thumb ? (
                  <img src={e.thumb} alt="" className="block w-16 h-16 object-cover shrink-0 shadow-[0_0_0_2px_#3a2a26]" loading="lazy" />
                ) : e.doodle ? (
                  <div className="w-20 shrink-0">
                    <DoodleImage px={e.doodle} />
                  </div>
                ) : (
                  <PixelIcon name={e.icon} scale={3} className="mt-1" />
                )}
                <div className="flex-1 min-w-0 leading-snug">
                  <div className="text-xs text-[var(--muted)]">{dayLabel(e.day)}</div>
                  <div className="font-bold">{e.title}</div>
                  {e.text && <div className="text-sm whitespace-pre-line break-words">{e.text}</div>}
                  {e.memoryId && e.by === me.id && (
                    <button className="px-link text-xs mt-1" onClick={() => onRemove(e.memoryId!)}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};

/* ---------- the panel ---------- */

export const WallPanel: React.FC<{ initialTab?: WallTab }> = ({ initialTab = 'notes' }) => {
  const { currentUser, partnerUser, space } = useApp();
  const { board, wallNews, markWallSeen, pinned, hangArt } = useTogether();
  const [tab, setTab] = useState<WallTab>(initialTab);
  const notes = useSharedList<Note>('note-', normalizeNote, demoNotes);
  const photos = useSharedList<Photo>('photo-', normalizePhoto, noDemo);
  const memories = useSharedDoc('memories', normalizeMemories, demoMemories);
  const partnerName = partnerUser?.name || space?.partnerPlaceholderName || 'your person';

  // what's new since you last looked: shown as new this time, then seen
  const [seenBefore] = useState(() => board.seen[currentUser.id] ?? 0);
  useEffect(() => {
    if (wallNews) markWallSeen();
  }, [wallNews, markWallSeen]);

  const livePhotos = useMemo(() => photos.items.filter((p) => !p.gone).reverse(), [photos.items]);

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = [];
    const thumbOf = (id: string) => photos.items.find((p) => p.id === id && !p.gone)?.thumb;
    const name = (uid: string) => (uid === currentUser.id ? 'you' : partnerUser?.name || 'your person');
    for (const m of Object.values(memories.doc.items)) out.push({ key: m.id, day: m.day, title: m.title, text: m.text, thumb: m.photo ? thumbOf(m.photo) : undefined, icon: 'book', memoryId: m.id, by: m.by });
    for (const p of livePhotos) if (p.kept) out.push({ key: p.id, day: p.day || dayOf(p.at), title: p.caption || `A photo from ${name(p.by)}`, thumb: p.thumb, icon: 'heart' });
    for (const n of notes.items) if (n.kept && !n.gone) out.push({ key: n.id, day: dayOf(n.at), title: `A ${n.kind === 'doodle' ? 'doodle' : 'note'} from ${name(n.by)}`, text: n.kind === 'text' ? n.text : undefined, doodle: n.kind === 'doodle' ? n.doodle : undefined, icon: 'envelope' });
    if (space?.togetherSince) out.push({ key: 'together', day: space.togetherSince, title: 'You got together', icon: 'heart' });
    if (space?.createdAt) out.push({ key: 'moved-in', day: space.createdAt.slice(0, 10), title: `You moved in to ${space.name}`, icon: 'couch' });
    return out.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
  }, [memories.doc.items, livePhotos, photos.items, notes.items, space, currentUser.id, partnerUser]);

  const tabs: Array<{ id: WallTab; label: string }> = [
    { id: 'notes', label: 'Notes' },
    { id: 'doodle', label: 'Doodle' },
    { id: 'photos', label: 'Photos' },
    { id: 'memories', label: 'Memories' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 flex-wrap" role="tablist" aria-label="Our wall">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`px-btn px-btn--small ${tab === t.id ? '' : 'px-btn--paper'}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'notes' && (
        <NotesTab
          notes={notes}
          me={currentUser}
          partner={partnerUser}
          partnerName={partnerName}
          seenBefore={seenBefore}
          onDoodle={() => setTab('doodle')}
          onPinned={() => pinned('text')}
          onHangDoodle={(n) => hangArt(doodleArt(n.doodle, n.id, currentUser.id))}
        />
      )}
      {tab === 'doodle' && (
        <DoodlePad
          partnerName={partnerName}
          onCancel={() => setTab('notes')}
          onSend={(px, hang) => {
            const id = newKey('note-');
            notes.put(id, { by: currentUser.id, kind: 'doodle', doodle: px, paper: 0, at: Date.now(), loved: {}, kept: false });
            pinned('doodle');
            if (hang) hangArt(doodleArt(px, id, currentUser.id));
            setTab('notes');
          }}
        />
      )}
      {tab === 'photos' && <PhotosTab photos={photos} me={currentUser} partner={partnerUser} onHang={hangArt} onPinned={() => pinned('photo')} />}
      {tab === 'memories' && (
        <MemoriesTab
          entries={entries}
          photos={livePhotos}
          me={currentUser}
          onAdd={(m) => {
            const id = newKey('mem-');
            memories.write({ items: { [id]: { ...m, id, by: currentUser.id, at: Date.now() } } });
          }}
          onRemove={(id) => memories.write({ items: { [id]: null } })}
        />
      )}
    </div>
  );
};
