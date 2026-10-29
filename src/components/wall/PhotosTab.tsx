import React, { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '../../types';
import { newKey } from '../../together/useSharedDoc';
import type { SharedList } from '../../together/useSharedList';
import { useBigDoc } from '../../together/useSharedList';
import { CAPTION_MAX, type Photo, type WallArt, bigName, photoArt, preparePhoto } from '../../together/wall';

const dayLabel = (p: Photo) =>
  new Date(p.day ? p.day + 'T12:00:00' : p.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function imageFrom(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** One photo, big, with what you can do with it. */
const Viewer: React.FC<{
  p: Photo;
  me: UserProfile;
  partner: UserProfile | null;
  onClose: () => void;
  onHang: (art: Omit<WallArt, 'ref' | 'by' | 'at'>) => void;
  onTakeDown: () => void;
}> = ({ p, me, partner, onClose, onHang, onTakeDown }) => {
  const { load } = useBigDoc();
  const [src, setSrc] = useState(p.thumb);
  const [hung, setHung] = useState(false);
  const [sure, setSure] = useState(false);
  useEffect(() => {
    let live = true;
    load(bigName(p.id)).then((d) => live && d && setSrc(d), () => undefined);
    return () => {
      live = false;
    };
  }, [p.id, load]);
  const who = p.by === me.id ? 'You' : partner?.name || 'Your person';
  return (
    <div className="flex flex-col gap-3 px-fade">
      <button className="px-link text-sm self-start" onClick={onClose}>
        ← All photos
      </button>
      <img src={src} alt={p.caption || 'A photo'} className="block w-full h-auto max-h-[60vh] object-contain bg-[#2a1f1b] shadow-[0_0_0_3px_#3a2a26]" />
      {p.caption && <div className="text-lg font-bold leading-snug">{p.caption}</div>}
      <div className="text-sm text-[var(--muted)]">
        {who} added it · {dayLabel(p)}
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <button
          className="px-btn px-btn--sage px-btn--small"
          onClick={async () => {
            const img = await imageFrom(src);
            onHang(photoArt(img));
            setHung(true);
          }}
        >
          Hang it over the couch
        </button>
        {p.by === me.id &&
          (sure ? (
            <>
              <span className="text-sm">Take it off the wall for both of you?</span>
              <button className="px-btn px-btn--small" onClick={onTakeDown}>
                Take it down
              </button>
              <button className="px-btn px-btn--paper px-btn--small" onClick={() => setSure(false)}>
                Keep it
              </button>
            </>
          ) : (
            <button className="px-btn px-btn--paper px-btn--small" onClick={() => setSure(true)}>
              Take it down…
            </button>
          ))}
      </div>
      {hung && (
        <p className="m-0 text-sm text-[var(--muted)]" role="status">
          Hung, as a little pixel picture, in the frame over the couch.
        </p>
      )}
    </div>
  );
};

export const PhotosTab: React.FC<{
  photos: SharedList<Photo>;
  me: UserProfile;
  partner: UserProfile | null;
  onHang: (art: WallArt) => void;
  onPinned: () => void;
}> = ({ photos, me, partner, onHang, onPinned }) => {
  const { save } = useBigDoc();
  const file = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<Awaited<ReturnType<typeof preparePhoto>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [caption, setCaption] = useState('');
  const [day, setDay] = useState('');
  const [hang, setHang] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const shown = photos.items.filter((p) => !p.gone).reverse();
  const viewing = open ? shown.find((p) => p.id === open) : null;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError('');
    try {
      setDraft(await preparePhoto(f));
      setCaption('');
      setDay('');
      setHang(!shown.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That picture wouldn’t open.');
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  const add = () => {
    if (!draft) return;
    const id = newKey('photo-');
    const at = Date.now();
    save(bigName(id), draft.big).catch((e) => console.warn('[soultied] photo', e));
    photos.put(id, { by: me.id, caption: caption.trim().slice(0, CAPTION_MAX), thumb: draft.thumb, w: draft.w, h: draft.h, at, day, kept: true });
    if (hang) onHang({ ...draft.art, ref: id, by: me.id, at });
    onPinned();
    setDraft(null);
  };

  if (viewing)
    return (
      <Viewer
        p={viewing}
        me={me}
        partner={partner}
        onClose={() => setOpen(null)}
        onHang={(art) => onHang({ ...art, ref: viewing.id, by: me.id, at: Date.now() })}
        onTakeDown={() => {
          photos.patch(viewing.id, { gone: true });
          setOpen(null);
        }}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {draft ? (
        <div className="px-inset p-4 flex flex-col gap-3 px-fade">
          <img src={draft.thumb} alt="" className="block max-w-full max-h-[260px] w-auto self-start shadow-[0_0_0_3px_#3a2a26]" />
          <label className="flex flex-col gap-1.5">
            <span className="px-label m-0 text-sm">A caption, if you like</span>
            <input className="px-input" maxLength={CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="The night the power went out" />
          </label>
          <label className="flex flex-col gap-1.5 max-w-[220px]">
            <span className="px-label m-0 text-sm">The day it was taken</span>
            <input className="px-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={hang} onChange={(e) => setHang(e.target.checked)} />
            Hang it over the couch too, as a little pixel picture
          </label>
          <div className="flex gap-3 flex-wrap">
            <button className="px-btn" onClick={add}>
              Add it to our wall
            </button>
            <button className="px-btn px-btn--paper px-btn--small" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 flex-wrap">
          <button className="px-btn px-btn--sage" disabled={busy} onClick={() => file.current?.click()}>
            {busy ? 'Getting it ready…' : 'Add a photo'}
          </button>
          <span className="text-sm text-[var(--muted)] leading-snug flex-1 min-w-[200px]">
            Kept here for both of you{partner ? `. ${partner.name} sees it straight away` : ''}.
          </span>
        </div>
      )}
      {error && (
        <p className="m-0 text-sm text-[var(--terracotta-d)]" role="alert">
          {error}
        </p>
      )}
      {!photos.ready ? (
        <p className="m-0 text-[var(--muted)]">Opening…</p>
      ) : shown.length ? (
        <ul className="list-none p-0 m-0 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {shown.map((p) => (
            <li key={p.id}>
              <button className="w-full p-0 border-0 bg-transparent cursor-pointer text-left flex flex-col gap-1.5" onClick={() => setOpen(p.id)}>
                <img src={p.thumb} alt={p.caption || 'A photo'} className="block w-full aspect-square object-cover shadow-[0_0_0_3px_#3a2a26]" loading="lazy" />
                <span className="text-sm leading-tight line-clamp-2">{p.caption || <span className="text-[var(--muted)]">{dayLabel(p)}</span>}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !draft && <p className="m-0 text-[var(--muted)] leading-snug">No photos yet. Add one and it stays here for both of you. You can hang any of them over the couch as a little pixel picture.</p>
      )}
    </div>
  );
};
