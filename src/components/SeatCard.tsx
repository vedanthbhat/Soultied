import React, { useEffect, useState } from 'react';
import type { UserProfile } from '../types';
import { PixelIcon } from './letters/PixelIcon';
import { useTogether } from '../together/TogetherContext';
import { MOODS, MOOD_TEXT_MAX, TOUCHES, type MoodEntry, type TouchKind, moodDef, moodGlyph, touchDef } from '../together/moods';

/**
 * The little cards that open over the two seats on the couch. Tap yourself to say how you're
 * feeling (it shows over your head for a day); tap your person to send them a hug, a kiss, a high five.
 */

export function ago(at: number) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} ${h === 1 ? 'hour' : 'hours'} ago` : 'yesterday';
}

/** a mood's little picture on a scrap of paper, so it reads on any background */
export const MoodChip: React.FC<{ e: MoodEntry | null; scale?: number }> = ({ e, scale = 2 }) => {
  const g = moodGlyph(e);
  if (!g) return null;
  return (
    <span className="inline-flex items-center justify-center shrink-0 bg-[#fbf1dc] p-[3px] shadow-[0_0_0_2px_#3a2a26]">
      <PixelIcon sprite={g} scale={scale} />
    </span>
  );
};

/* ---------- you: how are you feeling? ---------- */

export const MeCard: React.FC<{ partner: UserProfile | null; onLook: () => void }> = ({ partner, onLook }) => {
  const { myMood, setMood } = useTogether();
  const [words, setWords] = useState(myMood?.text || '');
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => setWords(myMood?.text || ''), [myMood?.text]);

  const who = partner ? partner.name : 'your person';
  const share = (mood: MoodEntry['mood'], text: string) => {
    setMood(mood, text);
    setSaid(mood || text.trim() ? `Shared. ${partner ? `${who} sees it` : 'It shows'} over your head for a day.` : 'Taken down.');
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-lg font-bold leading-tight">How are you feeling?</div>
        {myMood && (
          <button className="px-link text-sm shrink-0" onClick={() => share(null, '')}>
            Take it down
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="Moods">
        {MOODS.map((m) => (
          <button
            key={m.id}
            type="button"
            className="px-option text-sm"
            style={{ minHeight: '2.6em', padding: '0.35em 0.5em 0.5em', justifyContent: 'flex-start', textAlign: 'left' }}
            aria-pressed={myMood?.mood === m.id}
            onClick={() => share(myMood?.mood === m.id ? null : m.id, words)}
          >
            <span className="inline-flex items-center justify-center shrink-0 bg-[#fbf1dc] p-[2px] w-[20px] h-[20px]">
              <PixelIcon sprite={m} scale={2} />
            </span>
            <span className="leading-tight">{m.label}</span>
          </button>
        ))}
      </div>
      <form
        className="flex flex-col gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          share(myMood?.mood || null, words);
        }}
      >
        <label className="px-label m-0 text-sm" htmlFor="mood-words">
          In a few words, if you like
        </label>
        <div className="flex items-center gap-2">
          <input
            id="mood-words"
            className="px-input"
            maxLength={MOOD_TEXT_MAX}
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="long day, call me later?"
          />
          <button className="px-btn px-btn--small shrink-0" type="submit" disabled={words.trim() === (myMood?.text || '')}>
            Share
          </button>
        </div>
      </form>
      <p className="m-0 text-sm text-[var(--muted)] leading-snug min-h-[1.25em]" role="status">
        {said || (myMood ? `Shared ${ago(myMood.at)}. It goes after a day.` : `${partner ? `${who} sees it` : 'It shows'} over your head for a day.`)}
      </p>
      <div className="px-divider" />
      <button className="px-btn px-btn--paper px-btn--small self-start" onClick={onLook}>
        Change my look
      </button>
    </div>
  );
};

/* ---------- them: send a touch ---------- */

export const ThemCard: React.FC<{ partner: UserProfile; onUs: () => void; onSent?: () => void }> = ({ partner, onUs, onSent }) => {
  const { theirMood, sendTouch, markMoodSeen } = useTogether();
  const [sent, setSent] = useState<TouchKind | null>(null);
  const [busy, setBusy] = useState(false);
  const here = partner.status === 'online';
  const m = moodDef(theirMood?.mood);

  // opening their card counts as seeing their mood
  useEffect(() => {
    if (theirMood) markMoodSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theirMood?.at]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        {theirMood ? <MoodChip e={theirMood} scale={3} /> : null}
        <div className="leading-snug min-w-0">
          <div className="text-lg font-bold leading-tight">{partner.name}</div>
          {theirMood ? (
            <div className="text-sm">
              {m ? <span className="font-semibold">{m.label}</span> : null}
              {m && theirMood.text ? ' · ' : null}
              {theirMood.text ? <span>“{theirMood.text}”</span> : null}
              <span className="block text-[var(--muted)]">{ago(theirMood.at)}</span>
            </div>
          ) : (
            <div className="text-sm text-[var(--muted)]">No mood shared today.</div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label={`Send ${partner.name} a touch`}>
        {TOUCHES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="px-option text-sm"
            style={{ minHeight: '2.6em', padding: '0.35em 0.5em 0.5em', justifyContent: 'flex-start', textAlign: 'left' }}
            disabled={busy}
            onClick={() => {
              sendTouch(t.id);
              setSent(t.id);
              setBusy(true);
              window.setTimeout(() => setBusy(false), 900);
              onSent?.();
            }}
          >
            <span className="inline-flex items-center justify-center shrink-0 w-[18px] h-[16px]">
              <PixelIcon sprite={t} scale={2} />
            </span>
            <span className="leading-tight">{t.label}</span>
          </button>
        ))}
      </div>
      <p className="m-0 text-sm text-[var(--muted)] leading-snug min-h-[1.25em]" role="status">
        {sent
          ? `Sent ${touchDef(sent).one}. ${here ? `${partner.name}’s here, so they’ll feel it now.` : `${partner.name} gets it when they’re back.`}`
          : here
            ? `${partner.name} is here right now.`
            : `${partner.name} is away. They’ll see it when they’re back.`}
      </p>
      <div className="px-divider" />
      <button className="px-btn px-btn--paper px-btn--small self-start" onClick={onUs}>
        Our page
      </button>
    </div>
  );
};
