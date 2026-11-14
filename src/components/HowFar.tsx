import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTogether } from '../together/TogetherContext';
import { aheadLine, apartLabel, asleepHour, countsInMiles, zoneOffset, zoneTime } from '../together/where';

/**
 * How far apart you are, and what time it is for your person. Their time shows as soon as they've opened
 * Soultied; the distance once you've both chosen to share roughly where you are (to about 10 km).
 */
export const HowFar: React.FC = () => {
  const { partnerUser } = useApp();
  const { where, shareWhere } = useTogether();
  const [now, setNow] = useState(() => new Date());
  const [asking, setAsking] = useState(false);
  const [said, setSaid] = useState<'denied' | 'unavailable' | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  if (!partnerUser || !where.ready) return null;
  const name = partnerUser.name;
  const miles = typeof navigator !== 'undefined' && countsInMiles(navigator.language || '');
  const theirZone = where.theirs?.tz || '';
  const time = theirZone ? zoneTime(theirZone, now) : null;
  const theirs = theirZone ? zoneOffset(theirZone, now) : null;
  const mine = where.myZone ? zoneOffset(where.myZone, now) : null;
  const ahead = theirs !== null && mine !== null ? aheadLine(theirs - mine) : null;
  const sharing = where.mine?.lat != null;
  const theyShare = where.theirs?.lat != null;

  const title = where.km !== null ? apartLabel(where.km, miles) : time ? `It’s ${time.text} for ${name}` : 'How far apart are you?';
  const clock = time ? [where.km !== null ? `It’s ${time.text} for ${name}` : null, ahead, asleepHour(time.hour) ? 'probably asleep' : null].filter(Boolean).join(' · ') : null;
  const note = sharing
    ? theyShare
      ? null
      : `You’re sharing roughly where you are. Once ${name} does too, you’ll both see how far apart you are.`
    : `Share roughly where you are (the town, never the street) and you’ll both see how far apart you are.`;

  const share = async () => {
    setAsking(true);
    setSaid(null);
    const r = await shareWhere(true);
    setAsking(false);
    if (r !== 'ok') setSaid(r);
  };

  return (
    <section className="px-inset flex flex-col gap-2 px-4 py-3.5" aria-label="How far apart you are">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="leading-tight flex-1 min-w-[180px]">
          <div className="text-sm text-[var(--muted)]">{where.km !== null ? 'How far apart' : time ? 'Their time' : 'How far apart'}</div>
          <div className="text-xl font-bold">{title}</div>
          {clock && <div className="text-sm text-[var(--muted)]">{clock}</div>}
        </div>
        {!sharing && (
          <button className="px-btn px-btn--small" disabled={asking} onClick={share}>
            {asking ? 'Finding you…' : 'Share where I am'}
          </button>
        )}
      </div>
      {note && <p className="m-0 text-sm text-[var(--muted)] leading-snug">{note}</p>}
      {said && (
        <p className="m-0 text-sm text-[#7f3835] leading-snug" role="status">
          {said === 'denied' ? 'Your browser said no. You can let soultied.app see your location in its settings, then try again.' : 'Couldn’t find where you are just now. Try again in a moment.'}
        </p>
      )}
      {sharing && (
        <button className="px-link text-sm self-start" onClick={() => void shareWhere(false)}>
          Stop sharing where I am
        </button>
      )}
    </section>
  );
};
