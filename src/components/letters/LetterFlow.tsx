import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../../types';
import { AvatarThumb } from '../PixelAvatarRenderer';
import { PixelIcon } from './PixelIcon';
import { Card, CardAnswer, KIND_LABEL, LetterDay, OPEN_MAX } from '../../letters/engine';
import { cardTitle, cardsOf, isAnswered } from '../../letters/cards';

interface Props {
  day: LetterDay;
  me: UserProfile;
  partner: UserProfile;
  night?: boolean;
  /** shown instead of the card's kind (e.g. "Day 7 · Your story") */
  tag?: string;
  /** the look-back heading and the seal button */
  title?: string;
  sealLabel?: string;
  onAnswer: (cardId: string, answer: CardAnswer) => void;
  onSeal: () => void;
}

/**
 * One card at a time, then a quick look back and a wax seal. Taps move you
 * on by themselves so the whole letter takes about a minute and a half.
 */
export const LetterFlow: React.FC<Props> = ({ day, me, partner, night, tag, title, sealLabel, onAnswer, onSeal }) => {
  const cards = useMemo(() => cardsOf(day.cardIds), [day.cardIds]);
  const answers = day.by[me.id]?.cards || {};
  const partnerSealed = !!day.by[partner.id]?.sealedAt;
  const firstOpen = cards.findIndex((c) => !isAnswered(c, answers[c.id]));
  const [step, setStep] = useState(firstOpen === -1 ? cards.length : firstOpen);
  /** on a Know Me card: showing your own answer or your guess for your partner */
  const [mode, setMode] = useState<{ id: string; m: 'pick' | 'guess' } | null>(null);
  const [note, setNote] = useState('');
  /** an answer in your own words, as you type it */
  const [text, setText] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const card: Card | undefined = cards[step];
  const ans = card ? answers[card.id] : undefined;
  // straight on to the guess once you've picked, unless there's a line to write first (then "Next" takes you there)
  const guessing = !!card?.guess && ans?.pick != null && (mode?.id === card.id ? mode.m === 'guess' : ans.guess == null && !card.note);
  const setGuessing = (g: boolean) => card && setMode({ id: card.id, m: g ? 'guess' : 'pick' });

  // entering a card: back to the top, and bring back any note or answer already written
  useEffect(() => {
    rootRef.current?.closest('.px-scroll')?.scrollTo({ top: 0 });
    setNote((card && answers[card.id]?.note) || '');
    setText((card && answers[card.id]?.text) || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /** keep what you've written so far (leaving the card, or tapping away) */
  const saveText = () => {
    if (!card || card.style !== 'open') return;
    const v = text.trim();
    if (v === (ans?.text || '')) return;
    if (v) onAnswer(card.id, { pick: 0, text: v });
  };

  const go = (to: number) => {
    saveText();
    setStep(Math.max(0, Math.min(cards.length, to)));
  };
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
    // with a note to write, wait for "Next"
    if (card.note) return;
    if (card.guess) later(() => setGuessing(true));
    else later(() => go(step + 1));
  };

  const saveNote = () => {
    if (!card || !ans) return;
    onAnswer(card.id, { ...ans, note: note.trim() || undefined });
    if (card.guess) setGuessing(true);
    else go(step + 1);
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
          <span className="text-xl font-bold">{title || 'Your letter'}</span>
          {cards.length > 1 && pips}
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
                    <span className="block font-semibold whitespace-pre-line">
                      {!a ? '—' : c.style === 'open' ? a.text || '—' : c.style === 'likely' ? (a.pick === 0 ? me.name : partner.name) : c.options[a.pick]}
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
          <PixelIcon name="seal" scale={2} /> {partnerSealed ? 'Seal it and open together' : sealLabel || 'Seal the letter'}
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
          <span className={`px-tag ${night ? 'px-tag--night' : ''}`}>{tag || KIND_LABEL[card.kind]}</span>
          {cards.length > 1 && (
            <span className="text-sm text-[var(--muted)]">
              Card {step + 1} of {cards.length}
            </span>
          )}
        </span>
        {cards.length > 1 && pips}
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

        {card.style === 'likely' ? (
          <div className="grid grid-cols-2 gap-3" role="group" aria-label={header}>
            {[me, partner].map((who, i) => (
              <button
                key={who.id}
                className="px-option px-option--big flex flex-col items-center justify-center gap-1.5"
                aria-pressed={ans?.pick === i}
                onClick={() => choose(i)}
              >
                <AvatarThumb config={who.avatar} region="head" size={44} />
                <span>{i === 0 ? `Me (${who.name})` : who.name}</span>
              </button>
            ))}
          </div>
        ) : card.style === 'open' ? (
          <div className="flex flex-col gap-1.5">
            <textarea
              className="px-input"
              rows={4}
              value={text}
              maxLength={OPEN_MAX}
              onChange={(e) => setText(e.target.value)}
              onBlur={saveText}
              aria-label={card.prompt}
              placeholder="In your own words"
              autoFocus
            />
            <span className="text-sm text-[var(--muted)]">
              {partner.name} reads this once you’ve both sealed · {OPEN_MAX - text.length} left
            </span>
          </div>
        ) : two ? (
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

        {card.note && !guessing && (
          <div className="flex flex-col gap-2">
            <label className="px-label m-0" htmlFor="letter-note">
              {card.noteLabel ? card.noteLabel.replace(/\bthem\b/, partner.name) : `Add a line for ${partner.name}`}{' '}
              <span className="font-normal">(optional)</span>
            </label>
            {(card.noteMax || 140) > 140 ? (
              <textarea
                id="letter-note"
                className="px-input"
                rows={5}
                value={note}
                maxLength={card.noteMax}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Something only they’ll read"
              />
            ) : (
              <input
                id="letter-note"
                className="px-input"
                value={note}
                maxLength={140}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && ans && saveNote()}
                placeholder={card.guess ? 'Say more, if you like' : 'Something only they’ll read'}
              />
            )}
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
            {cards.length > 1
              ? `${cards.length} cards · ${cards.length > 3 ? 'about two minutes' : 'under a minute'}`
              : card.guess
                ? `Your answer, then a guess at ${partner.name}’s`
                : 'One card'}
          </span>
        )}
        {card.style === 'open' ? (
          <button
            className="px-btn shrink-0 whitespace-nowrap"
            disabled={!text.trim()}
            onClick={() => {
              onAnswer(card.id, { pick: 0, text: text.trim() });
              setStep(step + 1);
            }}
          >
            Next →
          </button>
        ) : card.note && !guessing ? (
          <button className="px-btn shrink-0 whitespace-nowrap" disabled={!ans} onClick={saveNote}>
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
