import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTogether } from '../together/TogetherContext';
import { ABOUT, ABOUT_STEPS, aboutFit } from '../together/about';
import { daysLeft } from '../together/visit';
import { addDays } from '../letters/engine';
import { inApp } from '../cloud/firebase';
import { PERKS } from '../plus/rules';

/**
 * About the two of you: five quick questions the first time you're in your place (the iPhone app asks the same
 * ones, and keeps them in the same place). Each is a tap, and the third is the next time you'll see each other,
 * which starts the countdown. Then what in Soultied fits what you said, and Soultied Plus to look at.
 */
export const AboutUs: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { today, partnerUser, space, hasPlus, cloudMode } = useApp();
  const { visit, setVisit, saveAbout } = useTogether();
  const name = partnerUser?.name || space?.partnerPlaceholderName || 'your person';
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const already = daysLeft(visit, today) !== null;
  const [date, setDate] = useState(() => (already ? visit.date : addDays(today, 21)));


  const answer = (id: string, a: string) => {
    setAnswers((s) => ({ ...s, [id]: a }));
    setStep((s) => s + 1);
  };
  const finish = () => { saveAbout(answers); onDone(); };

  // the question for this step: two taps, then the date, then two more
  const question = step < 2 ? ABOUT[step] : step > 2 && step < ABOUT_STEPS ? ABOUT[step - 1] : null;

  const nearby = answers.far === 'city' || answers.far === 'together';
  const fit = aboutFit(answers.miss, name);
  const offerPlus = !hasPlus && cloudMode && !inApp();

  return (
    <div className="fixed inset-0 z-[70] flex items-start sm:items-center justify-center p-4 overflow-y-auto" style={{ background: 'rgba(20, 14, 16, 0.55)' }} role="dialog" aria-modal="true" aria-label="About the two of you">
      <div className="px-box px-shadow px-pop w-full max-w-[440px] p-5 flex flex-col gap-3.5 my-auto" key={step}>
        <div className="flex gap-1.5" aria-label={`Question ${Math.min(step + 1, ABOUT_STEPS)} of ${ABOUT_STEPS}`}>
          {Array.from({ length: ABOUT_STEPS + 1 }, (_, i) => (
            <span key={i} className="h-2 flex-1" style={{ background: i <= step ? 'var(--terracotta, #c4673f)' : 'rgba(58, 42, 38, 0.18)' }} />
          ))}
        </div>

        {question && (
          <>
            <div className="text-xs font-semibold tracking-[0.16em] text-[var(--terracotta-d,#9c4a2c)]">ABOUT THE TWO OF YOU</div>
            <h2 className="m-0 text-2xl leading-tight">{nearby && question.id === 'often' ? 'How often do you make time for a date?' : nearby && question.id === 'miss' ? 'What do you love doing together?' : question.ask(name)}</h2>
            <div className="flex flex-col gap-2">
              {question.answers.map((a) => (
                <button key={a.id} className={`px-btn w-full text-left ${answers[question.id] === a.id ? 'px-btn--sage' : 'px-btn--paper'}`} onClick={() => answer(question.id, a.id)}>
                  {a.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!date) return;
              setAnswers((s) => ({ ...s, next: 'set' }));
              // (the same day that's already set keeps what it's for)
              setVisit(date, date === visit.date ? visit.what : '');
              setStep(3);
            }}
          >
            <div className="text-xs font-semibold tracking-[0.16em] text-[var(--terracotta-d,#9c4a2c)]">ABOUT THE TWO OF YOU</div>
            <h2 className="m-0 text-2xl leading-tight">{nearby ? 'When’s your next date?' : `When will you see ${name} next?`}</h2>
            <p className="m-0 text-sm text-[var(--muted)]">{already ? 'There’s already a day set. Keep it, or pick another.' : 'You’ll both count down to it, here and on the iPhone app’s widgets.'}</p>
            <label>
              <span className="px-label">The day</span>
              <input className="px-input" type="date" required min={today} max={addDays(today, 3 * 365)} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <button className="px-btn w-full" type="submit">
              That’s the day →
            </button>
            <button
              className="px-btn px-btn--paper w-full"
              type="button"
              onClick={() => {
                setAnswers((s) => ({ ...s, next: 'unknown' }));
                setStep(3);
              }}
            >
              We don’t know yet
            </button>
          </form>
        )}

        {step >= ABOUT_STEPS && <>
          <img src="/plus-popcorn.png" alt="A couple sharing popcorn on the couch" style={{imageRendering:'pixelated'}} />
          <h2 className="text-2xl font-bold">{offerPlus ? 'Soultied Plus' : 'Your place is ready'}</h2>
          <p>You picked “{ABOUT.find(q => q.id === 'miss')?.answers.find(a => a.id === answers.miss)?.label}”. {fit.line}</p>
          {offerPlus && <>
            <strong>One of you pays, you both get it.</strong>
            <ul>{PERKS.slice(0,5).map(perk => <li key={perk.title}>{perk.title}</li>)}</ul>
            <a href="/plus/" target="_blank" rel="noopener" className="px-btn text-center">See plans and prices</a>
          </>}
          <button className="px-btn px-btn--paper" onClick={finish}>{offerPlus ? 'Continue with the free version' : 'Continue'}</button>
          {offerPlus && <small>No hard feelings. Spoiler alert: Plus is so much more fun ;)</small>}
        </>}

        {step > 0 && step < ABOUT_STEPS && (
          <button className="px-btn px-btn--paper px-btn--small self-start" onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
      </div>
    </div>
  );
};
