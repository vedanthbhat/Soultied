import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { UserProfile } from '../../types';
import { LetterFlow } from './LetterFlow';
import { LetterReveal } from './LetterReveal';
import { JourneyPanel } from './JourneyPanel';
import { PixelIcon } from './PixelIcon';
import { LetterKind, LetterDay, prettyDate, scoreDay } from '../../letters/engine';

export type LettersTab = 'today' | 'journey' | 'afterdark' | 'past';

/* ---------- streak ---------- */

const StreakStrip: React.FC = () => {
  const { streak, mendStreak } = useApp();
  const cell: Record<string, React.CSSProperties> = {
    done: { background: 'var(--terracotta)' },
    mended: { background: 'var(--butter)' },
    missed: { background: 'var(--paper-2)' },
    today: {
      background: 'var(--paper-hi)',
      boxShadow: 'inset 0 0 0 3px var(--terracotta)',
    },
    upcoming: { background: 'var(--paper-2)', opacity: 0.5 },
    before: {
      background: 'transparent',
      boxShadow: 'inset 0 0 0 2px var(--paper-2)',
    },
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="px-divider" />
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <div className="flex items-center gap-3">
          <PixelIcon name={streak.current ? 'flame' : 'flameOut'} scale={4} />
          <div className="leading-tight">
            <div className="text-lg font-bold">{streak.current ? `${streak.current}-day streak` : 'No streak yet'}</div>
            <div className="text-sm text-[var(--muted)]">
              Best {streak.best} · {streak.together} {streak.together === 1 ? 'letter' : 'letters'} opened together
            </div>
          </div>
        </div>
        <div className="flex items-end gap-1.5" aria-label="This week">
          {streak.week.map((d) => (
            <span
              key={d.key}
              className="flex flex-col items-center gap-0.5 text-xs text-[var(--muted)]"
              title={`${prettyDate(d.key)}: ${d.state}`}
            >
              <span className="block" style={{ width: 18, height: 18, ...cell[d.state] }} />
              {d.label}
            </span>
          ))}
        </div>
      </div>
      {streak.mendable && (
        <div className="px-inset p-3 flex items-center gap-3 flex-wrap justify-between">
          <span className="text-sm leading-snug">
            Yesterday’s letter didn’t get opened. You can mend one missed day a week so the streak survives.
          </span>
          <button className="px-btn px-btn--small" onClick={mendStreak}>
            <PixelIcon name="stitch" scale={2} /> Mend the streak
          </button>
        </div>
      )}
    </div>
  );
};

/* ---------- one letter: answer, wait, or read ---------- */

const LetterView: React.FC<{
  kind: LetterKind;
  me: UserProfile;
  partner: UserProfile;
}> = ({ kind, me, partner }) => {
  const { getLetter, answerCard, sealLetter, markLetterSeen, today, switchActiveUser, cloudMode } = useApp();
  const day = getLetter(kind, today) as LetterDay;
  const mine = day.by[me.id];
  const night = kind === 'afterDark';

  useEffect(() => {
    if (day.revealedAt && mine && !mine.seenAt) markLetterSeen(kind, today);
  }, [day.revealedAt, mine, kind, today, markLetterSeen]);

  if (day.revealedAt) return <LetterReveal day={day} me={me} partner={partner} night={night} />;

  if (mine?.sealedAt) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-2 px-fade">
        <div className="relative">
          <PixelIcon name="envelope" scale={7} label="Sealed letter" />
        </div>
        <div className="text-2xl font-bold">Sealed and waiting on the table</div>
        <p className="m-0 max-w-[440px] leading-snug text-[var(--muted)]">
          {partner.name} hasn’t sealed {night ? 'tonight’s After dark cards' : 'today’s letter'} yet. It opens for both of you the moment
          they do.
        </p>
        {!cloudMode && (
          <button className="px-link text-sm" onClick={() => switchActiveUser(partner.id)}>
            Prototype: answer as {partner.name}
          </button>
        )}
      </div>
    );
  }

  return (
    <LetterFlow
      key={`${kind}-${today}-${me.id}`}
      day={day}
      me={me}
      partner={partner}
      night={night}
      onAnswer={(id, a) => answerCard(kind, today, id, a)}
      onSeal={() => sealLetter(kind, today)}
    />
  );
};

/* ---------- After dark ---------- */

const AfterDark: React.FC<{ me: UserProfile; partner: UserProfile }> = ({ me, partner }) => {
  const { letters, setAfterDark, afterDarkOpen } = useApp();
  const [adult, setAdult] = useState(false);
  const mineOn = !!letters.afterDarkOn[me.id];

  const box = (children: React.ReactNode) => (
    <div className="flex flex-col gap-4 p-4" style={{ background: '#2e2940', color: '#efe3cb' }}>
      <div className="flex items-center gap-3">
        <PixelIcon name={afterDarkOpen ? 'moon' : 'lock'} scale={4} style={afterDarkOpen ? undefined : { filter: 'brightness(1.8)' }} />
        <div className="leading-tight">
          <div className="text-xl font-bold">After dark</div>
          <div className="text-sm opacity-80">Flirty and intimate cards, just for you two · 18+</div>
        </div>
      </div>
      {children}
    </div>
  );

  if (!mineOn) {
    return box(
      <>
        <p className="m-0 leading-snug">
          Three extra cards a night that are a little more daring. It stays hidden until <strong>both</strong> of you switch it on, and we
          never tell {partner.name} you did unless they switch it on too.
        </p>
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="w-5 h-5 accent-[#b8674f]" />
          I’m 18 or older
        </label>
        <button className="px-btn self-start" disabled={!adult} onClick={() => setAfterDark(true)}>
          Switch it on for me
        </button>
      </>,
    );
  }

  if (!afterDarkOpen) {
    return box(
      <>
        <p className="m-0 leading-snug">
          You’re in. It opens as soon as {partner.name} switches it on from their side too. They won’t see that you did.
        </p>
        <button className="px-link self-start text-sm" style={{ color: '#e9d7b7' }} onClick={() => setAfterDark(false)}>
          Switch it off for me
        </button>
      </>,
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {box(<p className="m-0 leading-snug opacity-90">Tonight’s three. Same rules: answer in secret, it opens when you’ve both sealed.</p>)}
      <LetterView kind="afterDark" me={me} partner={partner} />
      <button className="px-link self-start text-sm" onClick={() => setAfterDark(false)}>
        Switch After dark off for me
      </button>
    </div>
  );
};

/* ---------- Past letters ---------- */

const Past: React.FC<{ me: UserProfile; partner: UserProfile }> = ({ me, partner }) => {
  const { letters, today } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const days = useMemo(
    () =>
      Object.values(letters.daily)
        .filter((d) => d.dateKey < today && Object.values(d.by).some((u) => u.sealedAt))
        .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)),
    [letters.daily, today],
  );

  if (!days.length) {
    return <p className="m-0 text-[var(--muted)]">Letters you open together will collect here, day by day.</p>;
  }

  return (
    <ol className="flex flex-col gap-2.5 list-none p-0 m-0">
      {days.map((d) => {
        const sc = d.revealedAt ? scoreDay(d, me.id, partner.id) : null;
        const isOpen = open === d.dateKey;
        const status = d.revealedAt
          ? `In sync on ${sc!.same} of ${sc!.total}`
          : d.by[me.id]?.sealedAt
            ? `Only you sealed this one`
            : `${partner.name} sealed this one`;
        return (
          <li key={d.dateKey} className="px-inset">
            <button
              className="w-full flex items-center justify-between gap-3 px-3 py-2.5 bg-transparent border-0 cursor-pointer text-left"
              onClick={() => setOpen(isOpen ? null : d.dateKey)}
              aria-expanded={isOpen}
              disabled={!d.revealedAt}
              style={d.revealedAt ? undefined : { cursor: 'default' }}
            >
              <span className="font-semibold">{prettyDate(d.dateKey)}</span>
              <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
                {sc && (
                  <span className="flex gap-0.5" aria-hidden="true">
                    {Array.from({ length: sc.total }, (_, i) => (
                      <PixelIcon key={i} name={i < sc.same ? 'heart' : 'heartEmpty'} scale={2} />
                    ))}
                  </span>
                )}
                {status}
                {d.revealedAt && <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>}
              </span>
            </button>
            {isOpen && (
              <div className="px-3 pb-3">
                <LetterReveal day={d} me={me} partner={partner} compact />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};

/* ---------- the panel ---------- */

/** On the Today tab: the 30 days, when there's something there for you. */
const JourneyNudge: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  const { journey } = useApp();
  if (journey.started && journey.next === null && journey.unseen === null) return null;
  const text = !journey.started
    ? 'New: 30 days of knowing each other. One question a day, getting a little deeper each week.'
    : journey.unseen !== null
      ? `Day ${journey.unseen} of your 30 days just opened.`
      : `Day ${journey.next} of your 30 days is waiting for you.`;
  return (
    <div className="px-inset p-3 flex items-center gap-3 flex-wrap justify-between">
      <span className="flex items-center gap-2.5 text-sm leading-snug">
        <PixelIcon name="book" scale={3} />
        {text}
      </span>
      <button className="px-btn px-btn--small px-btn--sage" onClick={onOpen}>
        {journey.started ? 'Open' : 'Take a look'}
      </button>
    </div>
  );
};

export const LettersPanel: React.FC<{ initialTab?: LettersTab }> = ({ initialTab = 'today' }) => {
  const { currentUser, partnerUser, space, openPanel, afterDarkOpen, journey } = useApp();
  const [tab, setTab] = useState<LettersTab>(initialTab);

  if (!partnerUser) {
    return (
      <div className="flex flex-col gap-4 items-start">
        <PixelIcon name="envelope" scale={5} />
        <p className="text-xl leading-snug m-0">
          Letters start once {space?.partnerPlaceholderName || 'your person'} moves in. Every day you’ll both get five quick cards, answer
          them in secret, and open them together.
        </p>
        <button className="px-btn px-btn--sage" onClick={() => openPanel('space')}>
          Send the invite
        </button>
      </div>
    );
  }

  const tabs: Array<{ id: LettersTab; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'journey', label: journey.started && (journey.next !== null || journey.unseen !== null) ? '30 days •' : '30 days' },
    { id: 'afterdark', label: afterDarkOpen ? 'After dark ☾' : 'After dark' },
    { id: 'past', label: 'Past' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div role="tablist" aria-label="Letters" className="flex gap-1 -mt-1 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} role="tab" className="px-tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'today' && (
        <>
          <LetterView kind="daily" me={currentUser} partner={partnerUser} />
          <JourneyNudge onOpen={() => setTab('journey')} />
        </>
      )}
      {tab === 'journey' && <JourneyPanel me={currentUser} partner={partnerUser} />}
      {tab === 'afterdark' && <AfterDark me={currentUser} partner={partnerUser} />}
      {tab === 'past' && <Past me={currentUser} partner={partnerUser} />}
      {(tab === 'today' || tab === 'past') && <StreakStrip />}
    </div>
  );
};
