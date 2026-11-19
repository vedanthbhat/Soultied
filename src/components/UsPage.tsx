import { useTogether } from '../together/TogetherContext';
import { useSharedDoc } from '../together/useSharedDoc';
import { demoMemories, normalizeMemories } from '../together/wall';
import { recapMonth } from '../together/recap';
import { visitLine } from '../together/visit';
import { apartLabel, countsInMiles } from '../together/where';
import { bucketView } from '../together/bucket';
import { PlusCard } from './PlusCard';
import { sfx } from '../escape/sfx';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { COUCH_STEPS, FIRE_NAMES, couchLine } from '../couch';
import { NextVisit } from './NextVisit';
import { HowFar } from './HowFar';
import { OurList } from './OurList';
import { MonthRecap } from './MonthRecap';
import { PixelAvatarRenderer } from './PixelAvatarRenderer';
import { PixelIcon, SpriteName } from './letters/PixelIcon';
import { scoreDay } from '../letters/cards';
import { CountUp } from './CountUp';

/** what each little picture does while it sits there: the flame flickers, the heart beats, the rest bob */
const MOTION: Partial<Record<SpriteName, string>> = {
  flame: 'mo-flicker',
  heart: 'mo-beat',
  seal: 'mo-bob',
  envelope: 'mo-bob',
};

const Stat: React.FC<{ icon: SpriteName; value: React.ReactNode; label: string; at?: number }> = ({
  icon,
  value,
  label,
  at = 0,
}) => (
  <div className="px-inset flex items-center gap-3 px-3.5 py-3 mo-in" style={{ ['--mo-d' as string]: `${at * 0.05}s` }}>
    <span className={`inline-flex ${MOTION[icon] || ''}`} style={{ ['--mo-d' as string]: `${-0.5 * at}s` }}>
      <PixelIcon name={icon} scale={4} />
    </span>
    <div className="leading-tight">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-sm text-[var(--muted)]">{label}</div>
    </div>
  </div>
);

export const UsPage: React.FC = () => {
  const {
    space,
    today,
    currentUser,
    partnerUser,
    activities,
    streak,
    letters,
    updateSpaceDetails,
    openPanel,
    couchLevel,
    fire,
  } = useApp();
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

  const { about, visit, where, bucket } = useTogether();
  const memories = useSharedDoc('memories', normalizeMemories, demoMemories);
  const [detail, setDetail] = useState('');
  const [quiet, setQuiet] = useState(sfx.isMuted());
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (detail && !dialog.current?.open) dialog.current?.showModal();
  }, [detail]);

  if (!space) return null;

  const days = space.togetherSince ? Math.floor((Date.now() - new Date(space.togetherSince).getTime()) / 86400000) : null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const near = ['city', 'together'].includes(about.mine?.far ?? '');
  const plan = near ? 'Our next date' : 'How far';
  const planLine =
    !near && where.km != null
      ? apartLabel(where.km, countsInMiles(navigator.language))
      : visitLine(visit, today) || (near ? 'Plan a date' : 'Plan your next visit');
  const { month } = recapMonth(today);
  const memory = Object.values(memories.doc.items)
    .filter((m) => m.day.startsWith(month))
    .sort((a, b) => b.day.localeCompare(a.day) || b.id.localeCompare(a.id))[0];
  const lastLetter = Object.values(letters.daily)
    .filter((d) => d.revealedAt && d.dateKey.startsWith(month))
    .map((d) => d.dateKey)
    .sort()
    .pop();
  const highlight =
    memory?.title || (lastLetter ? 'Your letter on ' + fmt(lastLetter + 'T12:00:00') : 'Your month together');
  const tiles: [string, string, SpriteName][] = [
    [plan, planLine, 'couch'],
    ['Our list', bucketView(bucket).todo.length + ' to do', 'check'],
    ['This month', highlight, 'heart'],
    ['Lately', activities[0]?.title || 'Your room is ready', 'envelope'],
    ['You', currentUser.name, 'spool'],
    ['Nudges', 'Your preferences', 'seal'],
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="px-inset p-3 flex items-center gap-2">
        <PixelAvatarRenderer config={currentUser.avatar} size={58} />
        {partnerUser && <PixelAvatarRenderer config={partnerUser.avatar} size={58} flipped />}
        <div className="flex-1 min-w-0">
          <strong>
            {currentUser.name}
            {partnerUser && ' & ' + partnerUser.name}
          </strong>
          {days !== null && <div className="text-sm">{days} days together</div>}
          {!partnerUser && (
            <button className="px-btn px-btn--small" onClick={() => openPanel('space')}>
              Invite your person
            </button>
          )}
        </div>
        <button className="px-link text-sm" onClick={() => setDetail('Settings')}>
          Settings
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(([label, value, icon]) => (
          <button key={label} className="px-inset text-left p-3 min-h-[72px]" onClick={() => setDetail(label)}>
            <span className="flex items-center gap-2 text-xs uppercase text-[var(--terracotta-d)]">
              <PixelIcon name={icon} scale={2} />
              {label}
            </span>
            <strong className="block mt-1 leading-tight line-clamp-2">{value}</strong>
          </button>
        ))}
      </div>
      <button className="px-btn px-btn--paper" onClick={() => setDetail('Soultied Plus')}>
        Soultied Plus
      </button>
      <dialog
        ref={dialog}
        aria-label={detail}
        className="m-auto px-box w-[min(92vw,540px)] max-h-[80dvh] overflow-y-auto p-4 backdrop:bg-black/50"
        onKeyDown={(event) => {
          if (event.key === 'Escape') event.stopPropagation();
        }}
        onClose={() => {
          setDetail('');
          setEditing(false);
        }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xl">{detail}</h3>
            <button className="px-btn px-btn--small" onClick={() => dialog.current?.close()}>
              Done
            </button>
          </div>
          {detail === plan && partnerUser && (
            <>
              <NextVisit />
              <HowFar />
            </>
          )}
          {detail === 'Our list' && partnerUser && <OurList />}
          {detail === 'This month' && partnerUser && (
            <>
              <strong>{highlight}</strong>
              <MonthRecap />
            </>
          )}
          {!partnerUser && [plan, 'Our list', 'This month'].includes(detail) && (
            <button className="px-btn" onClick={() => openPanel('space')}>
              Invite your person
            </button>
          )}
          {detail === 'Lately' && (
            <>
              {activities.length === 0 && (
                <p className="m-0 text-[var(--muted)]">Things you do together will show up here.</p>
              )}
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
              <p className="m-0 text-xs text-[var(--muted)]">
                Moved in {fmt(space.createdAt)}. Letters arrive at midnight, your time.
              </p>
            </>
          )}
          {detail === 'You' && (
            <>
              <button className="px-btn" onClick={() => openPanel('wardrobe')}>
                Change my look
              </button>
              <button className="px-link" onClick={() => openPanel('questions')}>
                Past letters
              </button>
              <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                <Stat
                  icon={streak.current ? 'flame' : 'flameOut'}
                  value={<CountUp value={streak.current} format={(n) => `${n} ${streak.current === 1 ? 'day' : 'days'}`} />}
                  label="Streak"
                />
                <Stat
                  icon="seal"
                  value={<CountUp value={streak.best} format={(n) => `${n} ${streak.best === 1 ? 'day' : 'days'}`} />}
                  label="Best streak"
                  at={1}
                />
                <Stat icon="envelope" value={<CountUp value={streak.together} />} label="Letters opened" at={2} />
                <Stat
                  icon="heart"
                  value={sync === null ? '—' : <CountUp value={sync} format={(n) => `${n}%`} />}
                  label="Matching picks, all time"
                  at={3}
                />
                {partnerUser && (
                  <Stat
                    icon="couch"
                    value={couchLevel >= COUCH_STEPS ? 'Side by side' : `${couchLevel} of ${COUCH_STEPS}`}
                    label="Closer on the couch"
                    at={4}
                  />
                )}
                {partnerUser && (
                  <Stat
                    at={5}
                    icon={fire.level ? 'flame' : 'flameOut'}
                    value={
                      fire.level ? (
                        <CountUp value={fire.streak} format={(n) => `${n} ${fire.streak === 1 ? 'day' : 'days'}`} />
                      ) : (
                        'Embers'
                      )
                    }
                    label={fire.level ? `${FIRE_NAMES[fire.level]}, both showing up` : 'Both show up to light it'}
                  />
                )}
              </div>
              {partnerUser && (
                <p className="m-0 -mt-1 text-sm text-[var(--muted)]">{couchLine(couchLevel, partnerUser.name)}</p>
              )}
            </>
          )}
          {detail === 'Soultied Plus' && <PlusCard heading="Soultied Plus" />}
          {detail === 'Nudges' && <Nudges />}
          {detail === 'Settings' && (
            <>
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
                <button className="px-btn" onClick={() => setEditing(true)}>
                  Edit our place
                </button>
              )}
              <button className="px-btn px-btn--paper" onClick={() => openPanel('space')}>
                Our place and account
              </button>
              <button
                className="px-btn px-btn--paper"
                onClick={() => {
                  sfx.setMuted(!quiet);
                  setQuiet(!quiet);
                }}
              >
                Sound {quiet ? 'off' : 'on'}
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
};

const groups = {
  letters: 'Letters',
  touches: 'Touches',
  games: 'Games',
  watch: 'Watching',
  wall: 'The wall',
  pet: 'The pet',
};
function readPreferences(raw: unknown) {
  const prefs: Record<string, Record<string, boolean>> = {};
  if (raw && typeof raw === 'object' && 'prefs' in raw && raw.prefs && typeof raw.prefs === 'object') {
    for (const [uid, options] of Object.entries(raw.prefs)) {
      if (options && typeof options === 'object')
        prefs[uid] = Object.fromEntries(
          Object.entries(options).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
        );
    }
  }
  return { prefs };
}

function Nudges() {
  const { currentUser } = useApp();
  const settings = useSharedDoc<ReturnType<typeof readPreferences>>('push', readPreferences, () => ({ prefs: {} }));
  return (
    <>
      <p>Choose which nudges reach your iPhone when notifications are on. Quiet hours are 11 pm to 8 am.</p>
      {Object.entries(groups).map(([key, label]) => (
        <label key={key} className="px-inset p-3 flex justify-between">
          {label}
          <input
            type="checkbox"
            disabled={!settings.ready}
            checked={settings.doc.prefs[currentUser.id]?.[key] ?? true}
            onChange={(e) => settings.write({ prefs: { [currentUser.id]: { [key]: e.target.checked } } })}
          />
        </label>
      ))}
    </>
  );
}
