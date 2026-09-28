import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../../types';
import { AvatarThumb } from '../PixelAvatarRenderer';
import { PixelIcon } from './PixelIcon';
import { Card, CardAnswer, KIND_LABEL, LetterDay, cardTitle, cardsOf, isAnswered } from '../../letters/engine';

interface Props {
  day: LetterDay;
  me: UserProfile;
  partner: UserProfile;
  night?: boolean;
  onAnswer: (cardId: string, answer: CardAnswer) => void;
  onSeal: () => void;
}

/**
 * One card at a time, then a quick look back and a wax seal. Taps move you
 * on by themselves so the whole letter takes about a minute and a half.
 */
export const LetterFlow: React.FC<Props> = ({ day, me, partner, night, onAnswer, onSeal }) => {
  const cards = useMemo(() => cardsOf(day.cardIds), [day.cardIds]);
  const answers = day.by[me.id]?.cards || {};
  const partnerSealed = !!day.by[partner.id]?.sealedAt;
  const firstOpen = cards.findIndex((c) => !isAnswered(c, answers[c.id]));
  const [step, setStep] = useState(firstOpen === -1 ? cards.length : firstOpen);
  /** on a Know Me card: showing your own answer or your guess for your partner */
  const [mode, setMode] = useState<{ id: string; m: 'pick' | 'guess' } | null>(null);
  const [note, setNote] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const card: Card | undefined = cards[step];
  const ans = card ? answers[card.id] : undefined;
  const guessing = !!card?.guess && ans?.pick != null && (mode?.id === card.id ? mode.m === 'guess' : ans.guess == null);
  const setGuessing = (g: boolean) => card && setMode({ id: card.id, m: g ? 'guess' : 'pick' });

  // entering a card: back to the top, and bring back any note already written
  useEffect(() => {
    rootRef.current?.closest('.px-scroll')?.scrollTo({ top: 0 });
    setNote((card && answers[card.id]?.note) || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const go = (to: number) => setStep(Math.max(0, Math.min(cards.length, to)));
  const later = (fn: () => void) => window.setTimeout(fn, 170);

  const choose = (i: number) => {
    if (!card) return;
    if (card.guess && guessing && ans) {
      onAnswer(card.id, { ...ans, guess: i });
      later(() => go(step + 1));
      return;
    }
    const next: CardAnswer = { ...(ans || {}), pick: i };
    if (card.note) next.note = note.trim() || undefined;
    onAnswer(card.id, next);
    if (card.guess) later(() => setGuessing(true));
    else if (!card.note) later(() => go(step + 1));
  };

  const saveNote = () => {
    if (!card || !ans) return;
    onAnswer(card.id, { ...ans, note: note.trim() || undefined });
    go(step + 1);
  };

  const pips = (
    <span className="flex items-center gap-1.5" aria-label={`Card ${Math.min(step + 1, cards.length)} of ${cards.length}`}>
      {cards.map((c, i) => {
        const done = isAnswered(c, answers[c.id]);
        return (
          <button
            key={c.id}
            onClick={() => go(i)}
            aria-label={`Card ${i + 1}`}
            className="border-0 p-0 cursor-pointer"
            style={{
              width: 14,
              height: 14,
              background: done ? 'var(--terracotta)' : 'var(--paper-2)',
              boxShadow: i === step ? '0 0 0 3px var(--ink)' : 'inset 0 -3px 0 0 rgba(0,0,0,0.12)',
            }}
          />
        );
      })}
    </span>
  );

  /* ---------- the look-back before sealing ---------- */
  if (!card) {
    return (
      <div ref={rootRef} className="flex flex-col gap-4 px-fade">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xl font-bold">Your letter</span>
          {pips}
        </div>
        <ol className="flex flex-col gap-2 list-none p-0 m-0">
          {cards.map((c, i) => {
            const a = answers[c.id];
            return (
              <li key={c.id}>
                <button
                  className="px-inset w-full text-left border-0 cursor-pointer px-3 py-2 flex items-start gap-3"
                  onClick={() => go(i)}
                >
                  <span className="flex-1 min-w-0 leading-snug">
                    <span className="block text-sm text-[var(--muted)]">{cardTitle(c)}</span>
                    <span className="block font-semibold">
                      {a ? c.options[a.pick] : '—'}
                      {c.guess && a?.guess != null && (
                        <span className="font-normal text-sm text-[var(--muted)]">
                          {' '}
                          · guess for {partner.name}: {c.options[a.guess]}
                        </span>
                      )}
                    </span>
                    {a?.note && <span className="block text-sm italic">“{a.note}”</span>}
                  </span>
                  <span className="text-sm text-[var(--terracotta-d)] underline shrink-0">Change</span>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="text-[var(--muted)] leading-snug m-0">
          {partnerSealed
            ? `${partner.name} has already sealed theirs, so this opens the moment you seal yours.`
            : `Once it’s sealed you can’t change it. It waits on the table until ${partner.name} seals theirs, then you both see everything.`}
        </p>
        <button className="px-btn self-start text-lg" onClick={onSeal}>
          <PixelIcon name="seal" scale={2} /> {partnerSealed ? 'Seal it and open together' : 'Seal the letter'}
        </button>
      </div>
    );
  }

  /* ---------- one card ---------- */
  const two = card.options.length === 2;
  const header = card.guess && guessing ? `What will ${partner.name} pick?` : card.prompt;

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="flex items-center gap-2">
          <span className={`px-tag ${night ? 'px-tag--night' : ''}`}>{KIND_LABEL[card.kind]}</span>
          <span className="text-sm text-[var(--muted)]">
            Card {step + 1} of {cards.length}
          </span>
        </span>
        {pips}
      </div>

      <div key={`${card.id}-${guessing}`} className="flex flex-col gap-4 px-fade">
        {card.guess && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <AvatarThumb config={(guessing ? partner : me).avatar} region="head" size={28} />
            {guessing ? (
              <span>
                You said <strong className="text-[var(--ink-soft)]">{card.options[ans?.pick ?? 0]}</strong>. Now guess {partner.name}’s
                answer to “{card.prompt}”
              </span>
            ) : (
              <span>Your answer first. Then you’ll guess {partner.name}’s.</span>
            )}
          </div>
        )}
        <h3 className="text-2xl font-bold leading-snug m-0">{header}</h3>

        {two ? (
          <div className="grid items-center gap-3" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
            <button className="px-option px-option--big" aria-pressed={ans?.pick === 0} onClick={() => choose(0)}>
              {card.options[0]}
            </button>
            <span className="font-bold text-[var(--muted)]">or</span>
            <button className="px-option px-option--big" aria-pressed={ans?.pick === 1} onClick={() => choose(1)}>
              {card.options[1]}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3" role="group" aria-label={header}>
            {card.options.map((o, i) => {
              const pressed = guessing ? ans?.guess === i : ans?.pick === i;
              return (
                <button key={i} className="px-option" aria-pressed={pressed} onClick={() => choose(i)}>
                  <span>{o}</span>
                  {guessing && ans?.pick === i && <span className="px-tag">you</span>}
                </button>
              );
            })}
          </div>
        )}

        {card.note && (
          <div className="flex flex-col gap-2">
            <label className="px-label m-0" htmlFor="letter-note">
              Add a line for {partner.name} <span className="font-normal">(optional)</span>
            </label>
            <input
              id="letter-note"
              className="px-input"
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && ans && saveNote()}
              placeholder="Something only they’ll read"
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        {step > 0 || guessing ? (
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => (guessing ? setGuessing(false) : go(step - 1))}>
            ← {guessing ? 'Change my answer' : 'Back'}
          </button>
        ) : (
          <span className="text-sm text-[var(--muted)]">
            {cards.length} cards · {cards.length > 3 ? 'about 90 seconds' : 'under a minute'}
          </span>
        )}
        {card.note ? (
          <button className="px-btn" disabled={!ans} onClick={saveNote}>
            Next →
          </button>
        ) : (
          isAnswered(card, ans) && (
            <button className="px-btn px-btn--paper px-btn--small" onClick={() => go(step + 1)}>
              Next →
            </button>
          )
        )}
      </div>
    </div>
  );
};
