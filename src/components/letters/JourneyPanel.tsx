import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { UserProfile } from '../../types';
import { LetterFlow } from './LetterFlow';
import { LetterReveal } from './LetterReveal';
import { PixelIcon } from './PixelIcon';
import { JOURNEY, JOURNEY_DAYS, LetterDay, addDays, cardsOf, journeyChapter, journeyKey, prettyDate } from '../../letters/engine';

/**
 * 30 days of knowing each other: one question a day, five chapters, each a
 * little deeper. Pick your answer, guess your person's, add a line if you
 * like; each day opens when you've both answered.
 */

const dayTag = (n: number) => `Day ${n} · ${journeyChapter(n).chapter.title}`;

type CellState = 'open' | 'mine' | 'theirs' | 'new' | 'done' | 'locked';

/* ---------- before you start ---------- */

const Intro: React.FC<{ partner: UserProfile; onStart: () => void }> = ({ partner, onStart }) => (
  <div className="flex flex-col gap-4 px-fade">
    <div className="flex items-center gap-3">
      <PixelIcon name="book" scale={5} />
      <div className="leading-tight">
        <div className="text-2xl font-bold">30 days of knowing each other</div>
        <div className="text-sm text-[var(--muted)]">One question a day, from the little things to the big ones</div>
      </div>
    </div>
    <p className="m-0 leading-snug">
      Each day there’s one question with four answers. Pick yours, guess {partner.name}’s, and add a line if you want to say more. It opens
      when you’ve both answered, so you see each other’s answers together.
    </p>
    <ol className="m-0 p-0 list-none flex flex-col gap-1.5">
      {JOURNEY.map((c, i) => (
        <li key={c.title} className="px-inset px-3 py-2 flex items-baseline gap-3">
          <span className="text-sm text-[var(--muted)] shrink-0 w-[4.5rem]">
            Days {i * 6 + 1}–{i * 6 + 6}
          </span>
          <span className="leading-snug">
            <strong>{c.title}</strong> <span className="text-sm text-[var(--muted)]">{c.blurb}</span>
          </span>
        </li>
      ))}
    </ol>
    <div className="flex items-center gap-3 flex-wrap">
      <button className="px-btn px-btn--sage text-lg" onClick={onStart}>
        Start our 30 days
      </button>
      <span className="text-sm text-[var(--muted)]">It starts for both of you. Missed a day? You can always catch up.</span>
    </div>
  </div>
);

/* ---------- the 30 squares ---------- */

const CELL: Record<CellState, React.CSSProperties> = {
  done: { background: 'var(--terracotta)' },
  new: { background: 'var(--terracotta)', boxShadow: 'inset 0 0 0 3px var(--butter)' },
  mine: { background: 'var(--butter)' },
  theirs: { background: 'var(--paper-hi)', boxShadow: 'inset 0 0 0 3px var(--terracotta)' },
  open: { background: 'var(--paper-hi)', boxShadow: 'inset 0 0 0 2px var(--ink-soft)' },
  locked: { background: 'var(--paper-2)', opacity: 0.55 },
};

const STATE_WORDS: Record<CellState, string> = {
  done: 'opened',
  new: 'just opened',
  mine: 'you answered, waiting for them',
  theirs: 'they answered, your turn',
  open: 'ready to answer',
  locked: 'not open yet',
};

const Strip: React.FC<{ states: CellState[]; selected: number; onPick: (n: number) => void }> = ({ states, selected, onPick }) => (
  <div className="grid gap-x-3 gap-y-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))' }}>
    {JOURNEY.map((c, ci) => (
      <div key={c.title} className="flex flex-col gap-1">
        <span className="text-xs text-[var(--muted)] truncate">{c.title}</span>
        <div className="flex gap-1">
          {c.questions.map((_, qi) => {
            const n = ci * 6 + qi + 1;
            const st = states[n - 1];
            return (
              <button
                key={n}
                onClick={() => onPick(n)}
                disabled={st === 'locked'}
                aria-label={`Day ${n}: ${STATE_WORDS[st]}`}
                aria-current={n === selected ? 'true' : undefined}
                title={`Day ${n}: ${STATE_WORDS[st]}`}
                className="border-0 p-0"
                style={{
                  width: 14,
                  height: 18,
                  cursor: st === 'locked' ? 'default' : 'pointer',
                  ...CELL[st],
                  ...(n === selected ? { outline: '3px solid var(--ink)', outlineOffset: 1 } : null),
                }}
              />
            );
          })}
        </div>
      </div>
    ))}
  </div>
);

/* ---------- one day ---------- */

const Day: React.FC<{ n: number; me: UserProfile; partner: UserProfile }> = ({ n, me, partner }) => {
  const { getLetter, answerCard, sealLetter, markLetterSeen, cloudMode, switchActiveUser } = useApp();
  const key = journeyKey(n);
  const day = getLetter('journey', key) as LetterDay;
  const mine = day.by[me.id];

  useEffect(() => {
    if (day.revealedAt && mine && !mine.seenAt) markLetterSeen('journey', key);
  }, [day.revealedAt, mine, key, markLetterSeen]);

  if (day.revealedAt) return <LetterReveal day={day} me={me} partner={partner} tag={dayTag(n)} />;

  if (mine?.sealedAt) {
    return (
      <div className="flex flex-col items-center text-center gap-3 py-2 px-fade">
        <PixelIcon name="envelope" scale={6} label="Sealed answer" />
        <div className="text-xl font-bold">Your answer for day {n} is sealed</div>
        <p className="m-0 max-w-[440px] leading-snug text-[var(--muted)]">It opens for both of you as soon as {partner.name} answers too.</p>
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
      key={`journey-${key}-${me.id}`}
      day={day}
      me={me}
      partner={partner}
      tag={dayTag(n)}
      title={`Day ${n}`}
      sealLabel="Seal my answer"
      onAnswer={(id, a) => answerCard('journey', key, id, a)}
      onSeal={() => sealLetter('journey', key)}
    />
  );
};

/* ---------- the keepsake book ---------- */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Every day you've opened together, in a page you can print or save as a PDF. */
function printBook(days: Array<{ n: number; day: LetterDay }>, me: UserProfile, partner: UserProfile) {
  const rows = days
    .map(({ n, day }) => {
      const c = cardsOf(day.cardIds)[0];
      if (!c) return '';
      const who = (u: UserProfile) => {
        const a = day.by[u.id]?.cards[c.id];
        if (!a) return '';
        return `<p><b>${esc(u.name)}:</b> ${esc(c.options[a.pick])}${a.note ? `<br><i>“${esc(a.note).replace(/\n/g, '<br>')}”</i>` : ''}</p>`;
      };
      return `<section><h3>${esc(dayTag(n))}</h3><h2>${esc(c.prompt)}</h2>${who(me)}${who(partner)}</section>`;
    })
    .join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Our 30 days</title><style>
    body { font: 15px/1.5 Georgia, serif; color: #2b1e1c; max-width: 640px; margin: 40px auto; padding: 0 24px; }
    h1 { font-size: 28px; margin: 0 0 4px; } .sub { color: #7a5a48; margin: 0 0 28px; }
    section { break-inside: avoid; border-top: 1px solid #d6c29c; padding: 14px 0; }
    h3 { font: 12px/1 sans-serif; letter-spacing: .12em; text-transform: uppercase; color: #8f4b3a; margin: 0 0 6px; }
    h2 { font-size: 18px; margin: 0 0 8px; } p { margin: 4px 0; }
  </style></head><body><h1>Our 30 days</h1><p class="sub">${esc(me.name)} &amp; ${esc(partner.name)}</p>${rows}</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  window.setTimeout(() => w.print(), 300);
}

const Book: React.FC<{ me: UserProfile; partner: UserProfile; onClose: () => void }> = ({ me, partner, onClose }) => {
  const { letters } = useApp();
  const days = Array.from({ length: JOURNEY_DAYS }, (_, i) => ({ n: i + 1, day: letters.journey[journeyKey(i + 1)] })).filter(
    (x): x is { n: number; day: LetterDay } => !!x.day?.revealedAt,
  );
  return (
    <div className="flex flex-col gap-4 px-fade">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <PixelIcon name="book" scale={4} />
          <div className="leading-tight">
            <div className="text-xl font-bold">Our book</div>
            <div className="text-sm text-[var(--muted)]">
              {days.length} of {JOURNEY_DAYS} days so far
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {days.length > 0 && (
            <button className="px-btn px-btn--small" onClick={() => printBook(days, me, partner)}>
              Print or save as PDF
            </button>
          )}
          <button className="px-btn px-btn--paper px-btn--small" onClick={onClose}>
            ← Back
          </button>
        </div>
      </div>
      {days.length === 0 && <p className="m-0 text-[var(--muted)]">The days you open together collect here, like pages in a book.</p>}
      <ol className="flex flex-col gap-4 list-none p-0 m-0">
        {days.map(({ n, day }) => (
          <li key={n} className="flex flex-col gap-2">
            <LetterReveal day={day} me={me} partner={partner} tag={dayTag(n)} compact />
          </li>
        ))}
      </ol>
    </div>
  );
};

/* ---------- the tab ---------- */

export const JourneyPanel: React.FC<{ me: UserProfile; partner: UserProfile }> = ({ me, partner }) => {
  const { journey, startJourney, letters, today } = useApp();
  const [picked, setPicked] = useState<number | null>(null);
  const [book, setBook] = useState(false);

  if (!journey.started) return <Intro partner={partner} onStart={startJourney} />;
  if (book) return <Book me={me} partner={partner} onClose={() => setBook(false)} />;

  const states: CellState[] = Array.from({ length: JOURNEY_DAYS }, (_, i) => {
    const n = i + 1;
    const d = letters.journey[journeyKey(n)];
    if (d?.revealedAt) return d.by[me.id]?.seenAt ? 'done' : 'new';
    if (n > journey.unlocked) return 'locked';
    if (d?.by[me.id]?.sealedAt) return 'mine';
    if (d?.by[partner.id]?.sealedAt) return 'theirs';
    return 'open';
  });
  const n = picked ?? journey.unseen ?? journey.next ?? journey.unlocked;
  const ch = journeyChapter(n);
  const caughtUp = journey.next === null && journey.unlocked < JOURNEY_DAYS;
  const nextOpens = journey.start ? addDays(journey.start, journey.unlocked) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="leading-tight">
          <div className="text-sm text-[var(--muted)]">
            Chapter {ch.index + 1} of {JOURNEY.length} · {ch.chapter.title}
          </div>
          <div className="text-2xl font-bold">
            Day {n} of {JOURNEY_DAYS}
          </div>
          <div className="text-sm text-[var(--muted)]">{ch.chapter.blurb}</div>
        </div>
        <button className="px-btn px-btn--paper px-btn--small" onClick={() => setBook(true)}>
          <PixelIcon name="book" scale={2} /> Our book ({journey.done})
        </button>
      </div>

      {journey.finished && (
        <div className="px-inset p-3.5 flex items-center gap-3">
          <PixelIcon name="heart" scale={3} />
          <span className="leading-snug">
            <strong>30 days, together.</strong> You know each other a little better than a month ago. Your answers are in “Our book”.
          </span>
        </div>
      )}

      <Strip states={states} selected={n} onPick={setPicked} />
      <div className="px-divider" />

      {n > journey.unlocked ? (
        <p className="m-0 text-[var(--muted)]">Day {n} isn’t open yet.</p>
      ) : (
        <Day key={n} n={n} me={me} partner={partner} />
      )}

      {caughtUp && nextOpens && (
        <p className="m-0 text-sm text-[var(--muted)]">
          You’re all caught up. Day {journey.unlocked + 1} opens {nextOpens === addDays(today, 1) ? 'tomorrow' : `on ${prettyDate(nextOpens)}`}.
        </p>
      )}
    </div>
  );
};
