import React, { useEffect, useState } from 'react';
import type { UserProfile } from '../../types';
import { AvatarThumb } from '../PixelAvatarRenderer';
import { PixelIcon } from './PixelIcon';
import { useTogether } from '../../together/TogetherContext';
import { ASK_ANSWER_MAX, ASK_OPTION_MAX, ASK_PROMPT_MAX, type Ask, type AskAnswer } from '../../together/asks';
import { OPEN } from '../../letters/deckOpen';
import { DISTANCE } from '../../letters/deckDistance';

/**
 * Ask: questions the two of you write for each other. You ask (in your own words, or with answers
 * to pick from) and answer it yourself; your answer stays hidden until your person has answered too.
 */

const Head: React.FC<{ who: UserProfile; size?: number }> = ({ who, size = 26 }) => (
  <span className="shrink-0 -my-1" title={who.name}>
    <AvatarThumb config={who.avatar} region="head" size={size} />
  </span>
);

/** ideas for when you can't think what to ask: the In your words deck and Far apart's open ones */
const IDEAS = [...OPEN.map((x) => x[0]), ...DISTANCE.filter((x) => x.length === 1).map((x) => x[0])].filter(
  (p) => !p.startsWith('Finish this')
);

function when(at: number) {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : d < 7 ? `${d} days ago` : new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** pick one, or write it: the answer part of asking and answering */
const AnswerInput: React.FC<{
  options: string[];
  value: Omit<AskAnswer, 'at'>;
  onChange: (v: Omit<AskAnswer, 'at'>) => void;
  label: string;
  placeholder?: string;
}> = ({ options, value, onChange, label, placeholder }) =>
  options.length ? (
    <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={label}>
      {options.map((o, i) => (
        <button key={i} type="button" className="px-option" aria-pressed={value.pick === i} onClick={() => onChange({ pick: i })}>
          {o}
        </button>
      ))}
    </div>
  ) : (
    <textarea
      className="px-input"
      rows={3}
      maxLength={ASK_ANSWER_MAX}
      value={value.text || ''}
      onChange={(e) => onChange({ text: e.target.value })}
      aria-label={label}
      placeholder={placeholder || 'In your own words'}
    />
  );

const answered = (v: Omit<AskAnswer, 'at'>) => v.pick != null || !!v.text?.trim();
const tidy = (v: Omit<AskAnswer, 'at'>): Omit<AskAnswer, 'at'> => (v.pick != null ? { pick: v.pick } : { text: (v.text || '').trim() });

/* ---------- writing a question ---------- */

const Composer: React.FC<{ partner: UserProfile; onDone: () => void }> = ({ partner, onDone }) => {
  const { ask } = useTogether();
  const [prompt, setPrompt] = useState('');
  const [withOptions, setWithOptions] = useState(false);
  const [options, setOptions] = useState<string[]>(['', '']);
  const [mine, setMine] = useState<Omit<AskAnswer, 'at'>>({});
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const opts = withOptions ? filled : [];
  const ready = !!prompt.trim() && (!withOptions || filled.length >= 2) && answered(mine) && (!withOptions || (mine.pick ?? -1) < filled.length);

  const idea = () => {
    const pool = IDEAS.filter((p) => p !== prompt);
    setPrompt(pool[Math.floor(Math.random() * pool.length)]);
    setWithOptions(false);
    setMine({});
  };

  return (
    <form
      className="px-inset p-4 flex flex-col gap-4 px-fade"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ready) return;
        ask(prompt, opts, tidy(mine));
        onDone();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <label className="px-label m-0" htmlFor="ask-prompt">
            Your question for {partner.name}
          </label>
          <button type="button" className="px-link text-sm" onClick={idea}>
            Need an idea?
          </button>
        </div>
        <textarea
          id="ask-prompt"
          className="px-input"
          rows={2}
          maxLength={ASK_PROMPT_MAX}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Anything at all. What do you want to know?"
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="px-label m-0">How they answer</span>
        <div className="flex gap-2 flex-wrap">
          {[
            { on: false, label: 'In their own words' },
            { on: true, label: 'Pick from answers' },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              className={`px-btn px-btn--small ${withOptions === o.on ? '' : 'px-btn--paper'}`}
              aria-pressed={withOptions === o.on}
              onClick={() => {
                setWithOptions(o.on);
                setMine({});
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        {withOptions && (
          <div className="flex flex-col gap-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="px-input"
                  value={o}
                  maxLength={ASK_OPTION_MAX}
                  onChange={(e) => {
                    const next = [...options];
                    next[i] = e.target.value;
                    setOptions(next);
                    if (mine.pick != null) setMine({});
                  }}
                  placeholder={`Answer ${i + 1}`}
                  aria-label={`Answer ${i + 1}`}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    className="px-link text-sm shrink-0"
                    onClick={() => {
                      setOptions(options.filter((_, j) => j !== i));
                      setMine({});
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            {options.length < 4 && (
              <button type="button" className="px-link text-sm self-start" onClick={() => setOptions([...options, ''])}>
                + Add an answer
              </button>
            )}
          </div>
        )}
      </div>

      {(!withOptions || filled.length >= 2) && (
        <div className="flex flex-col gap-2">
          <span className="px-label m-0">Your answer (hidden until {partner.name} answers)</span>
          <AnswerInput options={opts} value={mine} onChange={setMine} label="Your answer" placeholder="Answer it yourself too" />
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <button className="px-btn" type="submit" disabled={!ready}>
          <PixelIcon name="envelope" scale={2} /> Send it to {partner.name}
        </button>
        <button className="px-btn px-btn--paper px-btn--small" type="button" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  );
};

/* ---------- one question ---------- */

const ForMe: React.FC<{ a: Ask; partner: UserProfile }> = ({ a, partner }) => {
  const { answerAsk } = useTogether();
  const [mine, setMine] = useState<Omit<AskAnswer, 'at'>>({});
  return (
    <li className="px-inset p-3.5 flex flex-col gap-3 px-fade">
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Head who={partner} /> {partner.name} asked you · {when(a.at)}
      </div>
      <div className="text-xl font-bold leading-snug">{a.prompt}</div>
      <AnswerInput options={a.options} value={mine} onChange={setMine} label="Your answer" />
      <div className="flex items-center gap-3 flex-wrap">
        <button className="px-btn px-btn--small" disabled={!answered(mine)} onClick={() => answerAsk(a.id, tidy(mine))}>
          Answer and open it
        </button>
        <span className="text-sm text-[var(--muted)]">{partner.name} has answered already, so you’ll both see it straight away.</span>
      </div>
    </li>
  );
};

const Opened: React.FC<{ a: Ask; me: UserProfile; partner: UserProfile; fresh: boolean }> = ({ a, me, partner, fresh }) => {
  const asker = a.by === me.id ? me : partner;
  const said = (x?: AskAnswer) => (!x ? '—' : a.options.length ? a.options[x.pick ?? 0] ?? '—' : x.text || '—');
  const same = a.options.length > 0 && a.answers[me.id]?.pick === a.answers[partner.id]?.pick;
  return (
    <li className={`px-inset p-3.5 flex flex-col gap-2 ${fresh ? 'px-pop' : ''}`}>
      <div className="flex items-center gap-2 text-sm text-[var(--muted)] flex-wrap">
        <Head who={asker} size={22} /> {asker.id === me.id ? 'You asked' : `${partner.name} asked`} · {when(a.at)}
        {fresh && <span className="px-tag px-tag--sage">New</span>}
      </div>
      <div className="text-lg font-bold leading-snug">{a.prompt}</div>
      {same ? (
        <div className="flex items-center gap-2">
          <Head who={me} />
          <Head who={partner} />
          <span className="font-semibold">Both: {said(a.answers[me.id])}</span>
          <PixelIcon name="check" scale={2} label="Same answer" />
        </div>
      ) : (
        [me, partner].map((who) => (
          <div key={who.id} className="flex items-start gap-2">
            <Head who={who} />
            <span className="leading-snug whitespace-pre-line">{said(a.answers[who.id])}</span>
          </div>
        ))
      )}
    </li>
  );
};

/* ---------- the tab ---------- */

export const AskPanel: React.FC<{ me: UserProfile; partner: UserProfile }> = ({ me, partner }) => {
  const { asks, markAskSeen, withdrawAsk, asksReady } = useTogether();
  const [writing, setWriting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // what's opened since you last looked: shown as new this time, then marked seen
  const [freshIds] = useState(() => new Set(asks.fresh.map((a) => a.id)));
  useEffect(() => {
    asks.fresh.forEach((a) => markAskSeen(a.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asks.fresh.map((a) => a.id).join(',')]);

  const opened = showAll ? asks.opened : asks.opened.slice(0, 8);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <PixelIcon name="envelope" scale={4} />
        <div className="leading-snug flex-1 min-w-0">
          <div className="text-xl font-bold">Ask each other anything</div>
          <div className="text-sm text-[var(--muted)]">
            Write a question for {partner.name} and answer it yourself. Your answer stays hidden until {partner.name} answers too.
          </div>
        </div>
      </div>

      {writing ? (
        <Composer partner={partner} onDone={() => setWriting(false)} />
      ) : (
        <button className="px-btn px-btn--sage self-start" onClick={() => setWriting(true)}>
          Ask {partner.name} something
        </button>
      )}

      {!asksReady && <p className="m-0 text-[var(--muted)]">Opening…</p>}

      {asks.forMe.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h3 className="m-0 text-lg font-bold">{partner.name} asked you</h3>
          <ol className="list-none p-0 m-0 flex flex-col gap-2.5">
            {asks.forMe.map((a) => (
              <ForMe key={a.id} a={a} partner={partner} />
            ))}
          </ol>
        </section>
      )}

      {asks.waiting.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h3 className="m-0 text-lg font-bold">Waiting for {partner.name}</h3>
          <ol className="list-none p-0 m-0 flex flex-col gap-2">
            {asks.waiting.map((a) => (
              <li key={a.id} className="px-inset px-3.5 py-2.5 flex items-center gap-3 flex-wrap justify-between">
                <span className="leading-snug">
                  <span className="font-semibold">{a.prompt}</span>
                  <span className="block text-sm text-[var(--muted)]">Asked {when(a.at)} · your answer is sealed</span>
                </span>
                <button className="px-link text-sm" onClick={() => withdrawAsk(a.id)}>
                  Take it back
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      {asks.opened.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <div className="px-divider" />
          <h3 className="m-0 text-lg font-bold">Answered</h3>
          <ol className="list-none p-0 m-0 flex flex-col gap-2.5">
            {opened.map((a) => (
              <Opened key={a.id} a={a} me={me} partner={partner} fresh={freshIds.has(a.id)} />
            ))}
          </ol>
          {asks.opened.length > opened.length && (
            <button className="px-link text-sm self-start" onClick={() => setShowAll(true)}>
              Show all {asks.opened.length}
            </button>
          )}
        </section>
      )}

      {asksReady && !asks.forMe.length && !asks.waiting.length && !asks.opened.length && !writing && (
        <p className="m-0 text-[var(--muted)] leading-snug">
          Nothing asked yet. The best ones are small and specific: “What did you have for lunch on our first visit?”
        </p>
      )}
    </div>
  );
};
