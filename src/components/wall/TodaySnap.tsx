import React, { useRef, useState } from 'react';
import type { UserProfile } from '../../types';
import { useTogether } from '../../together/TogetherContext';
import { SNAP_CAPTION_MAX, type SnapShot } from '../../together/snap';
import { prepareSmall } from '../../together/wall';

/**
 * Today's photo, at the top of the photos: today's prompt, and a photo from each of you. Theirs stays a
 * locked Polaroid until you've taken yours; then you both see both, and either can go up on the wall.
 */
export const TodaySnap: React.FC<{
  me: UserProfile;
  partner: UserProfile | null;
  /** put one of today's photos up on the wall with the rest */
  onPin: (shot: SnapShot, by: string) => void;
}> = ({ me, partner, onPin }) => {
  const { snap, postSnap } = useTogether();
  const file = useRef<HTMLInputElement | null>(null);
  const [draft, setDraft] = useState<{ photo: string; w: number; h: number } | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pinned, setPinned] = useState<string[]>([]);

  if (!partner) return null;

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setError('');
    try {
      setDraft(await prepareSmall(f));
      setCaption(snap.mine?.caption ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That picture wouldn’t open.');
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  const polaroid = (shot: SnapShot | null, who: UserProfile, locked: boolean) => (
    <figure className="m-0 flex flex-col gap-1.5 bg-[#fffaf0] p-2 pb-2.5 shadow-[0_0_0_3px_#3a2a26,4px_4px_0_3px_rgba(0,0,0,0.25)] w-[min(42vw,210px)]">
      <div className="aspect-square bg-[#e8dcc4] overflow-hidden flex items-center justify-center">
        {shot && !locked ? (
          <img src={shot.photo} alt={shot.caption || `${who.name}'s photo`} className="block w-full h-full object-cover" />
        ) : (
          <span className="text-sm text-[var(--muted)] text-center px-3 leading-snug">
            {locked ? `${who.name} took theirs. Take yours to see it.` : who.id === me.id ? 'Yours goes here' : `Waiting on ${who.name}`}
          </span>
        )}
      </div>
      <figcaption className="text-sm leading-tight min-h-[1.2em]">
        <b>{who.id === me.id ? 'You' : who.name}</b>
        {shot && !locked && shot.caption ? <span className="text-[var(--muted)]"> · {shot.caption}</span> : null}
      </figcaption>
      {shot && !locked && snap.stage === 'open' && (
        <button
          className="px-link text-sm self-start"
          disabled={pinned.includes(who.id)}
          onClick={() => {
            onPin(shot, who.id);
            setPinned((p) => [...p, who.id]);
          }}
        >
          {pinned.includes(who.id) ? 'On the wall' : 'Pin it to the wall'}
        </button>
      )}
    </figure>
  );

  return (
    <section className="px-inset p-4 flex flex-col gap-3" aria-label="Today's photo">
      <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <div className="leading-tight">
        <div className="text-sm text-[var(--muted)]">Today’s photo</div>
        <div className="text-xl font-bold">{snap.prompt}</div>
        <div className="text-sm text-[var(--muted)] mt-1">
          {snap.stage === 'open'
            ? 'You both took one. Here they are.'
            : snap.stage === 'mine'
              ? `Yours is in. ${partner.name} sees it once they’ve taken theirs.`
              : snap.stage === 'theirs'
                ? `${partner.name} took theirs. Take yours and you’ll both see both.`
                : `Take one each. Neither of you sees the other’s till you both have.`}
        </div>
      </div>

      {draft ? (
        <div className="flex flex-col gap-3 px-fade">
          <img src={draft.photo} alt="" className="block max-w-full max-h-[240px] w-auto self-start shadow-[0_0_0_3px_#3a2a26]" />
          <label className="flex flex-col gap-1.5">
            <span className="px-label m-0 text-sm">A few words, if you like</span>
            <input className="px-input" maxLength={SNAP_CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Raining again" />
          </label>
          <div className="flex gap-3 flex-wrap">
            <button
              className="px-btn"
              onClick={() => {
                postSnap({ ...draft, caption });
                setDraft(null);
              }}
            >
              {snap.mine ? 'Use this one instead' : 'Post it'}
            </button>
            <button className="px-btn px-btn--paper px-btn--small" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-4 flex-wrap">
            {polaroid(snap.mine, me, false)}
            {polaroid(snap.theirs, partner, snap.stage === 'theirs')}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button className={`px-btn ${snap.mine ? 'px-btn--paper px-btn--small' : 'px-btn--sage'}`} disabled={busy} onClick={() => file.current?.click()}>
              {busy ? 'Getting it ready…' : snap.mine ? 'Retake mine' : 'Take mine'}
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="m-0 text-sm text-[var(--terracotta-d)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
