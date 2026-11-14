import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTogether } from '../together/TogetherContext';
import { BUCKET_IDEAS, BUCKET_TEXT_MAX, bucketView } from '../together/bucket';
import { daysLeft } from '../together/visit';
import { PixelIcon } from './letters/PixelIcon';

/**
 * Our list: the things you want to do together. Either of you adds to it, stars things for the next time
 * you're together, and ticks them off once you've done them.
 */

const STAR = ['...#...', '...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'];
const starOn = { rows: STAR, pal: { '#': '#e2b359' } };
const starOff = { rows: STAR, pal: { '#': '#c9b89a' } };

const shortDay = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const OurList: React.FC = () => {
  const { partnerUser, today } = useApp();
  const { bucket, addWish, tickWish, starWish, dropWish, visit } = useTogether();
  const [text, setText] = useState('');
  const [ideasAt, setIdeasAt] = useState<number | null>(null);
  const [showDone, setShowDone] = useState(false);
  const { todo, done } = useMemo(() => bucketView(bucket), [bucket]);

  // three ideas that aren't on the list yet (a different three each time you ask)
  const ideas = useMemo(() => {
    if (ideasAt === null) return [];
    const have = new Set(Object.values(bucket.items).map((i) => i.text.toLowerCase()));
    const left = BUCKET_IDEAS.filter((t) => !have.has(t.toLowerCase()));
    return Array.from({ length: Math.min(3, left.length) }, (_, k) => left[(ideasAt * 3 + k) % left.length]);
  }, [ideasAt, bucket.items]);

  if (!partnerUser) return null;
  const nextName = daysLeft(visit, today) !== null && visit.what ? visit.what : 'next time';

  return (
    <section className="px-inset p-4 flex flex-col gap-3" aria-label="Our list">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div className="leading-tight">
          <div className="text-xl font-bold">Our list</div>
          <div className="text-sm text-[var(--muted)]">Things to do together, some day or next time</div>
        </div>
        {(todo.length > 0 || done.length > 0) && (
          <div className="text-sm text-[var(--muted)]">
            {todo.length} to do · {done.length} done
          </div>
        )}
      </div>

      <form
        className="flex gap-2 flex-wrap"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          addWish(text);
          setText('');
        }}
      >
        <input
          className="px-input flex-1 min-w-[12rem]"
          value={text}
          maxLength={BUCKET_TEXT_MAX}
          placeholder="Watch the sunrise from the beach"
          aria-label="Something to do together"
          onChange={(e) => setText(e.target.value)}
        />
        <button className="px-btn px-btn--small" type="submit" disabled={!text.trim()}>
          Add
        </button>
        <button className="px-btn px-btn--paper px-btn--small" type="button" onClick={() => setIdeasAt((n) => (n === null ? Math.floor(Math.random() * 10) : n + 1))}>
          {ideasAt === null ? 'Need ideas?' : 'More ideas'}
        </button>
      </form>

      {ideas.length > 0 && (
        <div className="flex gap-2 flex-wrap" aria-label="Ideas">
          {ideas.map((t) => (
            <button key={t} className="px-btn px-btn--paper px-btn--small" onClick={() => addWish(t)}>
              + {t}
            </button>
          ))}
        </div>
      )}

      {todo.length === 0 && done.length === 0 && <p className="m-0 text-sm text-[var(--muted)]">Nothing on it yet. Add the first thing, or ask for ideas.</p>}

      {todo.length > 0 && (
        <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
          {todo.map((i) => (
            <li key={i.id} className="flex items-center gap-2.5 bg-[var(--paper-2,#efe3cb)] px-2.5 py-2">
              <button
                className="shrink-0 w-[22px] h-[22px] border-2 border-[#3a2a26] bg-[#fffaf0] flex items-center justify-center"
                aria-label={`Done: ${i.text}`}
                onClick={() => tickWish(i.id, true)}
              />
              <div className="flex-1 min-w-0 leading-snug">
                <div className="break-words">{i.text}</div>
                {i.next && <div className="text-xs text-[var(--terracotta-d,#8f4b3a)]">for {nextName}</div>}
              </div>
              <button className="shrink-0 p-1" aria-label={i.next ? `Not for ${nextName}` : `For ${nextName}`} aria-pressed={i.next} title={i.next ? `Planned for ${nextName}` : `Plan it for ${nextName}`} onClick={() => starWish(i.id, !i.next)}>
                <PixelIcon sprite={i.next ? starOn : starOff} scale={2} />
              </button>
              <button className="shrink-0 p-1" aria-label={`Take off the list: ${i.text}`} title="Take it off" onClick={() => dropWish(i.id)}>
                <PixelIcon name="cross" scale={2} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button className="px-link text-sm self-start" aria-expanded={showDone} onClick={() => setShowDone((s) => !s)}>
            {showDone ? 'Hide' : 'Show'} what you’ve done together ({done.length})
          </button>
          {showDone && (
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {done.map((i) => (
                <li key={i.id} className="flex items-center gap-2.5 px-2.5 py-1.5">
                  <button
                    className="shrink-0 w-[22px] h-[22px] border-2 border-[#3a2a26] bg-[#fffaf0] flex items-center justify-center"
                    aria-label={`Not done yet: ${i.text}`}
                    onClick={() => tickWish(i.id, false)}
                  >
                    <PixelIcon name="check" scale={2} />
                  </button>
                  <div className="flex-1 min-w-0 leading-snug">
                    <div className="break-words line-through decoration-2 text-[var(--muted)]">{i.text}</div>
                    <div className="text-xs text-[var(--muted)]">done {shortDay(i.done)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};
