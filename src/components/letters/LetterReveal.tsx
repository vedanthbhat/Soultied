import React, { useEffect, useMemo, useRef } from 'react';
import type { UserProfile } from '../../types';
import { AvatarThumb } from '../PixelAvatarRenderer';
import { PixelIcon } from './PixelIcon';
import { KIND_LABEL, LetterDay, cardTitle, cardsOf, scoreDay } from '../../letters/engine';

interface Props {
  day: LetterDay;
  me: UserProfile;
  partner: UserProfile;
  night?: boolean;
  /** smaller version for the list of past letters */
  compact?: boolean;
  /** one 30-day question: its own label, and no "in sync on 1 of 1" */
  tag?: string;
}

const Head: React.FC<{ who: UserProfile }> = ({ who }) => (
  <span className="shrink-0 -my-1" title={who.name}>
    <AvatarThumb config={who.avatar} region="head" size={26} />
  </span>
);

/** Both answers side by side, with how in sync you were. */
export const LetterReveal: React.FC<Props> = ({ day, me, partner, night, compact, tag }) => {
  const cards = useMemo(() => cardsOf(day.cardIds), [day.cardIds]);
  const score = useMemo(() => scoreDay(day, me.id, partner.id), [day, me.id, partner.id]);
  const mine = day.by[me.id]?.cards || {};
  const theirs = day.by[partner.id]?.cards || {};
  const talk = cards.find((c) => c.id === score.talkAbout);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // the letter just opened: start reading from the top
  useEffect(() => {
    if (!compact) rootRef.current?.closest('.px-scroll')?.scrollTo({ top: 0 });
  }, [compact]);

  return (
    <div ref={rootRef} className={`flex flex-col ${compact ? 'gap-3' : 'gap-5 px-pop'}`}>
      {/* score */}
      {tag ? (
        !compact &&
        cards[0] &&
        mine[cards[0].id] &&
        theirs[cards[0].id] && (
          <div className="px-inset p-3.5 flex items-center gap-3">
            <PixelIcon name={score.same ? 'heart' : 'heartEmpty'} scale={3} />
            <span className="font-semibold leading-snug">
              {score.same ? 'Same answer. You two are in sync.' : `Different answers. Ask ${partner.name} why tonight.`}
              {score.myGuesses.total > 0 && (
                <span className="block text-sm font-normal text-[var(--muted)]">
                  {score.myGuesses.right ? 'You read their mind' : 'Your guess was off'} ·{' '}
                  {score.theirGuesses.right ? `${partner.name} read yours` : `${partner.name}’s guess was off`}
                </span>
              )}
            </span>
          </div>
        )
      ) : compact ? (
        score.myGuesses.total > 0 && (
          <div className="text-sm text-[var(--muted)]">
            Mind reading: you {score.myGuesses.right}/{score.myGuesses.total} · {partner.name} {score.theirGuesses.right}/
            {score.theirGuesses.total}
          </div>
        )
      ) : (
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1" aria-hidden="true">
            {cards.map((_, i) => (
              <PixelIcon key={i} name={i < score.same ? 'heart' : 'heartEmpty'} scale={compact ? 2 : 3} />
            ))}
          </div>
          <div className="leading-tight">
            <div className={`${compact ? 'text-lg' : 'text-2xl'} font-bold`}>
              In sync on {score.same} of {score.total}
            </div>
            {score.myGuesses.total > 0 && (
              <div className="text-sm text-[var(--muted)]">
                Mind reading: you {score.myGuesses.right}/{score.myGuesses.total} · {partner.name} {score.theirGuesses.right}/
                {score.theirGuesses.total}
              </div>
            )}
          </div>
        </div>
      )}

      {!compact && !tag && talk && (
        <div className="px-inset p-3.5 flex flex-col gap-1">
          <span className={`px-tag self-start ${night ? 'px-tag--night' : ''}`}>Talk about it tonight</span>
          <span className="font-semibold leading-snug">{cardTitle(talk)}</span>
          <span className="text-sm leading-snug">
            You said <strong>{talk.options[mine[talk.id].pick]}</strong>, {partner.name} said{' '}
            <strong>{talk.options[theirs[talk.id].pick]}</strong>. Ask each other why.
          </span>
        </div>
      )}
      {!compact && !tag && !talk && <div className="px-inset p-3.5 font-semibold">Same answer on every card. Very in sync today.</div>}

      {/* cards */}
      <ol className="flex flex-col gap-3 list-none p-0 m-0">
        {cards.map((c) => {
          const a = mine[c.id];
          const b = theirs[c.id];
          if (!a || !b) return null;
          const same = a.pick === b.pick;
          return (
            <li key={c.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className={`px-tag ${night ? 'px-tag--night' : ''}`}>{tag || KIND_LABEL[c.kind]}</span>
                <span className="font-semibold leading-snug">{cardTitle(c)}</span>
              </div>
              {same ? (
                <div className="flex items-center gap-2 pl-1">
                  <Head who={me} />
                  <Head who={partner} />
                  <span className="font-semibold">Both: {c.options[a.pick]}</span>
                  <PixelIcon name="check" scale={2} label="Same answer" />
                </div>
              ) : (
                <div
                  className="grid gap-1.5 pl-1"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Head who={me} /> {c.options[a.pick]}
                  </span>
                  <span className="flex items-center gap-2">
                    <Head who={partner} /> {c.options[b.pick]}
                  </span>
                </div>
              )}
              {c.guess && !compact && (
                <div className="flex flex-col gap-0.5 pl-1 text-sm text-[var(--muted)]">
                  <span className="flex items-center gap-1.5">
                    <PixelIcon name={a.guess === b.pick ? 'check' : 'cross'} scale={2} label={a.guess === b.pick ? 'Right' : 'Wrong'} />
                    You guessed {partner.name} would say “{c.options[a.guess ?? 0]}”
                  </span>
                  <span className="flex items-center gap-1.5">
                    <PixelIcon name={b.guess === a.pick ? 'check' : 'cross'} scale={2} label={b.guess === a.pick ? 'Right' : 'Wrong'} />
                    {partner.name} guessed you’d say “{c.options[b.guess ?? 0]}”
                  </span>
                </div>
              )}
              {c.note && (a.note || b.note) && (
                <div className="flex flex-col gap-1.5 pl-1">
                  {[
                    { who: me, text: a.note },
                    { who: partner, text: b.note },
                  ]
                    .filter((n) => n.text)
                    .map((n) => (
                      <div key={n.who.id} className="px-inset px-3 py-2 flex items-start gap-2 text-sm">
                        <Head who={n.who} />
                        <span className="italic leading-snug whitespace-pre-line">“{n.text}”</span>
                      </div>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};
