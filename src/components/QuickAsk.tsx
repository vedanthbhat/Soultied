import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTogether } from '../together/TogetherContext';
import { ABOUT, QUICK_DAY_KEY } from '../together/about';

/**
 * One more quick question about the two of you a day, each a tap: the ones onboarding leaves out (how often you
 * see each other, what you miss most, when you have time). The iPhone app asks them on Home.
 */
export const QuickAsk: React.FC = () => {
  const { today, partnerUser, space, demo } = useApp();
  const { about, saveAbout } = useTogether();
  const [lastDay, setLastDay] = useState(() => {
    try {
      return localStorage.getItem(QUICK_DAY_KEY) || '';
    } catch {
      return '';
    }
  });
  const mine = about.mine;
  if (demo || !mine || lastDay === today) return null;
  const q = ABOUT.slice(1).find((x) => !mine[x.id]);
  if (!q) return null;

  const name = partnerUser?.name || space?.partnerPlaceholderName || 'your person';
  const nearby = mine.far === 'city' || mine.far === 'together';
  const prompt =
    nearby && q.id === 'often' ? 'How often do you make time for a date?' : nearby && q.id === 'miss' ? 'What do you love doing together?' : q.ask(name);

  const pick = (answer: string) => {
    saveAbout({ [q.id]: answer });
    try {
      localStorage.setItem(QUICK_DAY_KEY, today);
    } catch {
      // fine without it
    }
    setLastDay(today);
  };

  return (
    <section className="px-inset p-3 flex flex-col gap-2" aria-label="A quick question about the two of you">
      <small className="font-bold tracking-wider" style={{ color: '#8f4b3a' }}>
        A QUICK ONE
      </small>
      <strong className="text-lg leading-tight">{prompt}</strong>
      <div className="grid grid-cols-2 gap-2">
        {q.answers.map((a) => (
          <button key={a.id} className="px-btn px-btn--paper px-btn--small text-left" onClick={() => pick(a.id)}>
            {a.label}
          </button>
        ))}
      </div>
      <small className="text-xs text-[var(--muted)]">It helps Soultied suggest what suits the two of you.</small>
    </section>
  );
};
