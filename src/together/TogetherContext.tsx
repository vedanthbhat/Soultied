import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { newKey, useSharedDoc } from './useSharedDoc';
import { type Ask, type AskAnswer, type AsksView, DEMO_REPLIES, demoAsks, normalizeAsks, viewAsks } from './asks';

/**
 * The little shared things of a place that aren't letters, games or decor: for now, the questions
 * you write for each other. (Each lives in its own small document; see useSharedDoc.)
 */

interface TogetherValue {
  asksReady: boolean;
  asks: AsksView;
  /** ask your person something (and give your own answer, which stays hidden until they've answered) */
  ask: (prompt: string, options: string[], mine: Omit<AskAnswer, 'at'>) => void;
  answerAsk: (id: string, mine: Omit<AskAnswer, 'at'>) => void;
  markAskSeen: (id: string) => void;
  /** take back a question they haven't answered yet */
  withdrawAsk: (id: string) => void;
}

const Ctx = createContext<TogetherValue | null>(null);

export const TogetherProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, partnerUser, addActivity } = useApp();
  const me = currentUser.id;
  const them = partnerUser?.id || null;
  const asksDoc = useSharedDoc('asks', normalizeAsks, demoAsks);
  const { write } = asksDoc;
  const asks = useMemo(() => viewAsks(asksDoc.doc, me, them), [asksDoc.doc, me, them]);

  const ask = useCallback<TogetherValue['ask']>(
    (prompt, options, mine) => {
      const id = newKey('ask-');
      const at = Date.now();
      const item: Ask = { id, by: me, prompt: prompt.trim(), options, at, answers: { [me]: { ...mine, at } }, seen: {} };
      write({ items: { [id]: item } });
      // the demo room: Rohan answers a moment later
      if (asksDoc.mode === 'demo' && them) {
        window.setTimeout(() => {
          const reply: AskAnswer = options.length
            ? { pick: Math.floor(Math.random() * options.length), at: Date.now() }
            : { text: DEMO_REPLIES[Math.floor(Math.random() * DEMO_REPLIES.length)], at: Date.now() };
          write({ items: { [id]: { answers: { [them]: reply } } } });
        }, 3500);
      }
    },
    [me, them, write, asksDoc.mode]
  );

  const answerAsk = useCallback<TogetherValue['answerAsk']>(
    (id, mine) => {
      const item = asksDoc.doc.items[id];
      if (!item || item.answers[me]) return;
      write({ items: { [id]: { answers: { [me]: { ...mine, at: Date.now() } } } } });
      if (them && item.answers[them] && partnerUser) {
        addActivity({ type: 'question_revealed', title: 'A question, answered', description: `“${item.prompt}”` });
      }
    },
    [asksDoc.doc, me, them, write, addActivity, partnerUser]
  );

  const markAskSeen = useCallback<TogetherValue['markAskSeen']>(
    (id) => {
      const item = asksDoc.doc.items[id];
      if (!item || item.seen[me]) return;
      write({ items: { [id]: { seen: { [me]: Date.now() } } } });
    },
    [asksDoc.doc, me, write]
  );

  const withdrawAsk = useCallback<TogetherValue['withdrawAsk']>(
    (id) => {
      const item = asksDoc.doc.items[id];
      if (!item || item.by !== me || (them && item.answers[them])) return;
      write({ items: { [id]: null } });
    },
    [asksDoc.doc, me, them, write]
  );

  const value = useMemo<TogetherValue>(
    () => ({ asksReady: asksDoc.ready, asks, ask, answerAsk, markAskSeen, withdrawAsk }),
    [asksDoc.ready, asks, ask, answerAsk, markAskSeen, withdrawAsk]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useTogether() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTogether outside TogetherProvider');
  return v;
}
