import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { PixelAvatarRenderer } from './PixelAvatarRenderer';
import { PixelIcon, SpriteName } from './letters/PixelIcon';
import { scoreDay } from '../letters/engine';

const Stat: React.FC<{ icon: SpriteName; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="px-inset flex items-center gap-3 px-3.5 py-3">
    <PixelIcon name={icon} scale={4} />
    <div className="leading-tight">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-sm text-[var(--muted)]">{label}</div>
    </div>
  </div>
);

export const UsPage: React.FC = () => {
  const { space, currentUser, partnerUser, activities, streak, letters, updateSpaceDetails, openPanel } = useApp();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(space?.name || '');
  const [since, setSince] = useState(space?.togetherSince || '');

  const sync = useMemo(() => {
    if (!partnerUser) return null;
    let same = 0;
    let total = 0;
    for (const d of Object.values(letters.daily)) {
      if (!d.revealedAt) continue;
      const s = scoreDay(d, currentUser.id, partnerUser.id);
      same += s.same;
      total += s.total;
    }
    return total ? Math.round((same / total) * 100) : null;
  }, [letters.daily, currentUser.id, partnerUser]);

  if (!space) return null;

  const days = space.togetherSince ? Math.floor((Date.now() - new Date(space.togetherSince).getTime()) / 86400000) : null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className="flex flex-col gap-6">
      {/* the two of you */}
      <div className="flex items-end gap-6 flex-wrap">
        <div className="flex items-end gap-2">
          <div className="flex flex-col items-center">
            <PixelAvatarRenderer config={currentUser.avatar} size={120} />
            <span className="text-sm font-semibold mt-1">{currentUser.name}</span>
          </div>
          <div className="flex flex-col items-center">
            {partnerUser ? (
              <>
                <PixelAvatarRenderer config={partnerUser.avatar} size={120} flipped />
                <span className="text-sm font-semibold mt-1">{partnerUser.name}</span>
              </>
            ) : (
              <>
                <div
                  className="px-inset flex items-center justify-center text-3xl text-[var(--terracotta)]"
                  style={{ width: 60, height: 120 }}
                >
                  +
                </div>
                <span className="text-sm font-semibold mt-1 text-[var(--muted)]">{space.partnerPlaceholderName}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 min-w-[240px] flex flex-col gap-2">
          {editing ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                updateSpaceDetails(name.trim() || space.name, since || undefined);
                setEditing(false);
              }}
            >
              <label>
                <span className="px-label">Name of your place</span>
                <input className="px-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
              </label>
              <label>
                <span className="px-label">Together since</span>
                <input className="px-input" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
              </label>
              <div className="flex gap-3">
                <button className="px-btn px-btn--small" type="submit">
                  Save
                </button>
                <button className="px-btn px-btn--paper px-btn--small" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="text-3xl font-bold leading-tight">{space.name}</div>
              <p className="m-0 text-[var(--muted)]">
                {days !== null
                  ? `Together since ${fmt(space.togetherSince!)} · ${days.toLocaleString()} days`
                  : partnerUser
                    ? `${currentUser.name} & ${partnerUser.name}`
                    : `Saving a seat for ${space.partnerPlaceholderName}`}
              </p>
              <button className="px-link self-start text-sm" onClick={() => setEditing(true)}>
                {days === null ? 'Add the day you got together' : 'Edit'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* numbers */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <Stat
          icon={streak.current ? 'flame' : 'flameOut'}
          value={`${streak.current} ${streak.current === 1 ? 'day' : 'days'}`}
          label="Streak"
        />
        <Stat icon="seal" value={`${streak.best} ${streak.best === 1 ? 'day' : 'days'}`} label="Best streak" />
        <Stat icon="envelope" value={String(streak.together)} label="Letters opened" />
        <Stat icon="heart" value={sync === null ? '—' : `${sync}%`} label="In sync" />
      </div>

      <div className="flex gap-3 flex-wrap">
        <button className="px-btn" onClick={() => openPanel('wardrobe')}>
          Change my look
        </button>
        <button className="px-btn px-btn--paper" onClick={() => openPanel('questions')}>
          Past letters
        </button>
        <button className="px-btn px-btn--paper" onClick={() => openPanel('space')}>
          {partnerUser ? 'Our place' : 'Invite'}
        </button>
      </div>

      {/* what's happened */}
      <div className="flex flex-col gap-3">
        <div className="px-divider" />
        <h3 className="text-xl font-bold m-0">Little moments</h3>
        {activities.length === 0 && <p className="m-0 text-[var(--muted)]">Things you do together will show up here.</p>}
        <ol className="flex flex-col gap-2 list-none p-0 m-0">
          {activities.slice(0, 12).map((a) => (
            <li key={a.id} className="px-inset px-3.5 py-2.5 flex items-start gap-3">
              <PixelIcon name="heart" scale={2} className="mt-1.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{a.title}</span>
                  <span className="text-xs text-[var(--muted)] shrink-0">{a.timestamp}</span>
                </div>
                <div className="text-sm text-[var(--muted)] leading-snug">{a.description}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="m-0 text-xs text-[var(--muted)]">Moved in {fmt(space.createdAt)}. Letters arrive at midnight, your time.</p>
      </div>
    </div>
  );
};
