import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTogether } from '../together/TogetherContext';
import { ABOUT, QUICK_DAY_KEY } from '../together/about';
import { daysLeft } from '../together/visit';
import { addDays } from '../letters/engine';
import { inApp } from '../cloud/firebase';
import { BONUS_STITCHES, FREE_GAMES, FREE_ROOMS } from '../plus/rules';
import { PixelIcon, SpriteName } from './letters/PixelIcon';

/**
 * About the two of you, the first time you're in your place (the iPhone app asks the same, and keeps it in the same
 * place): how far apart you are, which sets what your place counts down to, with the next time you'll see each
 * other right under your answer. Then Soultied Plus to look at. The other questions come one a day, on the Us page
 * (QuickAsk).
 */

const HINTS: Record<string, string> = {
  together: 'Plan your next date night',
  city: 'Count down to your next date',
  hours: 'Count down to your next visit',
  country: 'A countdown, and both your times',
  zones: 'Always know what time it is for them',
};

/** a little picture for each answer (the same as the iPhone app's) */
const ICONS: Record<string, { rows: string[]; pal: Record<string, string> }> = {
  together: { rows: ['....r....', '...rrr...', '..rrrrr..', '.rrrrrrr.', 'rrrrrrrrr', '.bbbbbbb.', '.bbbcbbb.', '.bbbcbbb.'], pal: { r: '#b8674f', b: '#8a6a50', c: '#f4e8d0' } },
  city: { rows: ['......bbb', 'bbb...byb', 'byb...bbb', 'bbb...byb', 'byb.b.bbb', 'bbbbbbbyb', 'bbbbbbbbb'], pal: { b: '#5a79a3', y: '#f2d48a' } },
  hours: { rows: ['..rrrr....', '.rwwrr....', 'rrrrrrrrr.', 'rrrrrrrrrr', '.kk....kk.'], pal: { r: '#b8674f', w: '#cfe3f2', k: '#2b1e1c' } },
  country: { rows: ['..bbbb..', '.bgbbgb.', 'bggbbggb', 'bbbbbbbb', 'bggbbggb', '.bgbbgb.', '..bbbb..'], pal: { b: '#5a79a3', g: '#8a9a72' } },
  zones: { rows: ['..kkkk..', '.k....k.', 'k...k..k', 'k...k..k', 'k...kk.k', 'k......k', '.k....k.', '..kkkk..'], pal: { k: '#3a2a26' } },
};

const plusLine = (far: string | null) => {
  switch (far) {
    case 'together':
      return 'You said you live together. Plus is made for your nights in.';
    case 'city':
      return 'You said you’re in the same city. Plus makes the nights apart feel shorter.';
    case 'hours':
      return 'You said you’re a few hours apart. Plus is made for the nights in between.';
    case 'zones':
      return 'You said you’re in different time zones. Plus is made for nights like yours.';
    default:
      return 'You said you’re in different countries. Plus is made for nights like yours.';
  }
};

/** the fairy lights along the top of the picture (its pixels, across) */
const BULBS = [10, 34, 58, 82, 106, 130, 154, 178, 202, 226, 250, 274, 297, 322, 346];
const BULB_COLORS = ['#f2d66b', '#f08a8a', '#7fb2d9', '#a8d08d'];

/** the two of you under a blanket with popcorn: the fairy lights twinkle and hearts float up */
const PopcornPicture: React.FC = () => (
  <div className="relative overflow-hidden" style={{ border: '3px solid #2b1e1c', boxShadow: '4px 4px 0 rgba(0,0,0,.3)', aspectRatio: '354 / 162' }}>
    <img src="/plus-popcorn.png" alt="The two of you on a little sofa under a blanket, sharing popcorn, with fairy lights" className="block w-full h-full" style={{ imageRendering: 'pixelated' }} />
    <span aria-hidden="true">
      {BULBS.map((x, i) => (
        <span
          key={x}
          className="st-bulb absolute"
          style={{ left: `${(x / 354) * 100}%`, top: `${(14 / 162) * 100}%`, width: '1%', height: '3.2%', background: BULB_COLORS[i % 4], color: BULB_COLORS[i % 4], animationDelay: `${-(i * 0.3) % 2.4}s` }}
        />
      ))}
      {[-8, 10, 2].map((dx, k) => (
        <span key={k} className="st-heart absolute" style={{ left: `${(176 / 354) * 100}%`, top: `${(30 / 162) * 100}%`, ['--dx' as string]: `${dx}px`, animationDelay: `${k * 1.2}s` }}>
          <PixelIcon name="heart" scale={1} />
        </span>
      ))}
    </span>
    <span className="absolute left-2 top-2 text-[11px] font-bold tracking-wider px-1.5 py-0.5" style={{ background: '#e2b359', color: '#2b1e1c', border: '2px solid #2b1e1c' }}>
      SOULTIED PLUS
    </span>
  </div>
);

/** a little record, for Our song */
const RECORD = {
  rows: ['..kkkkk..', '.kkgkgkk.', 'kkkkkkkkk', 'kgkrrrkgk', 'kkkrwrkkk', 'kgkrrrkgk', 'kkkkkkkkk', '.kkgkgkk.', '..kkkkk..'],
  pal: { k: '#1f1718', g: '#3a3035', r: '#b8674f', w: '#efdcb8' },
};

const Perk: React.FC<{ icon: SpriteName; title: string; line: string; isNew?: boolean; sprite?: typeof RECORD }> = ({ icon, title, line, isNew, sprite }) => (
  <div className="flex items-center gap-2.5">
    <span className="shrink-0 w-[40px] h-[40px] flex items-center justify-center overflow-hidden" style={{ background: '#fff8ea', border: '3px solid #2b1e1c' }}>
      <PixelIcon name={icon} sprite={sprite} scale={2} />
    </span>
    <span className="flex flex-col leading-tight">
      <strong className="text-[15px]">
        {title}
        {isNew && (
          <span className="ml-1.5 text-[10px] px-1 align-[2px]" style={{ background: '#8a9a72', color: '#fff8ea' }}>
            NEW
          </span>
        )}
      </strong>
      <small className="text-xs text-[var(--muted)]">{line}</small>
    </span>
  </div>
);

export const AboutUs: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { today, partnerUser, space, hasPlus, cloudMode } = useApp();
  const { visit, setVisit, saveAbout } = useTogether();
  const name = partnerUser?.name || space?.partnerPlaceholderName || 'your person';
  const [far, setFar] = useState<string | null>(null);
  const already = daysLeft(visit, today) !== null;
  // (empty: not sure yet)
  const [date, setDate] = useState(() => (already ? visit.date : ''));
  const [atPlus, setAtPlus] = useState(false);
  const offerPlus = !hasPlus && cloudMode && !inApp();
  const nearby = far === 'city' || far === 'together';

  const next = () => {
    if (!far) return;
    // (the same day that's already set keeps what it's for)
    if (date && date !== visit.date) setVisit(date, '');
    saveAbout({ far, next: date ? 'set' : 'unknown' });
    // (the rest of the questions start tomorrow)
    try {
      localStorage.setItem(QUICK_DAY_KEY, today);
    } catch {
      // fine without it
    }
    if (offerPlus) setAtPlus(true);
    else onDone();
  };

  const steps = offerPlus ? 4 : 3;

  return (
    <div className="fixed inset-0 z-[70] flex items-stretch sm:items-center justify-center sm:p-4 overflow-y-auto" style={{ background: 'rgba(20, 14, 16, 0.55)' }} role="dialog" aria-modal="true" aria-label="About the two of you">
      <div className="px-box px-shadow px-pop w-full max-w-[440px] min-h-[100dvh] sm:min-h-0 p-5 flex flex-col gap-3.5" key={atPlus ? 'plus' : 'far'}>
        <div className="flex gap-1.5" aria-label={`Step ${atPlus ? 4 : 3} of ${steps}`}>
          {Array.from({ length: steps }, (_, i) => (
            <span key={i} className="h-2 flex-1" style={{ background: i < (atPlus ? 4 : 3) ? 'var(--terracotta, #c4673f)' : 'rgba(58, 42, 38, 0.18)' }} />
          ))}
        </div>

        {!atPlus && (
          <>
            <div>
              <h2 className="m-0 text-2xl leading-tight">How far apart are you two?</h2>
              <p className="m-0 text-sm text-[var(--muted)]">It sets what your place counts down to.</p>
            </div>
            {/* (the answers share the screen between them, so there's no empty half) */}
            <div className="flex-1 flex flex-col gap-2.5" role="group" aria-label="How far apart">
              {ABOUT[0].answers.map((a) => {
                const on = far === a.id;
                return (
                  <React.Fragment key={a.id}>
                    <button
                      className="flex-1 min-h-[56px] flex items-center gap-3 px-3.5 text-left"
                      style={{ border: `3px solid ${on ? '#6a7856' : '#2b1e1c'}`, background: on ? '#e6edd9' : '#fff8ea', boxShadow: 'inset 0 -4px 0 #e8d9bb, 3px 3px 0 rgba(0,0,0,.18)' }}
                      aria-pressed={on}
                      onClick={() => setFar(a.id)}
                    >
                      <span className="shrink-0 w-11 h-11 flex items-center justify-center" style={{ background: '#f4e8d0', border: '3px solid #2b1e1c' }}>
                        <PixelIcon sprite={ICONS[a.id]} scale={2} />
                      </span>
                      <span className="flex flex-col leading-tight">
                        <strong className="text-[17px]">{a.label}</strong>
                        <small className="text-xs" style={{ color: on ? '#4f5c3f' : 'var(--muted)' }}>
                          {HINTS[a.id]}
                        </small>
                      </span>
                    </button>
                    {on && (
                      <label className="px-inset p-3 flex flex-col gap-1.5">
                        <strong className="text-sm">{nearby ? 'When’s your next date?' : `When do you see ${name} next?`}</strong>
                        <input className="px-input" type="date" min={today} max={addDays(today, 3 * 365)} value={date} onChange={(e) => setDate(e.target.value)} />
                        <small className="text-xs text-[var(--muted)]">
                          {date ? 'You’ll both count down to it.' : 'Not sure yet? Leave it, and set it later on the Us page.'}
                        </small>
                      </label>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <button className="px-btn w-full" disabled={!far} onClick={next}>
              Next
            </button>
          </>
        )}

        {atPlus && (
          <>
            <PopcornPicture />
            <div>
              <h2 className="m-0 text-2xl leading-tight">Make it feel like the same room</h2>
              <p className="m-0 text-sm text-[var(--muted)]">{plusLine(far)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Perk icon="couch" title="Movie night, every night" line="Netflix and Prime Video together, as often as you like" />
              <Perk icon="camera" title="See and hear each other" line="Cameras and voice while you watch and play" />
              <Perk icon="trophy" title="Every game and escape room" line={`Free has ${FREE_GAMES.size} games and ${FREE_ROOMS.size} room${FREE_ROOMS.size === 1 ? '' : 's'}`} />
              <Perk icon="heart" sprite={RECORD} title="Your song, on the record player" line="Any song from Apple Music, in the iPhone app" isNew />
              <Perk icon="flame" title="Bolder After dark questions" line={`And ${BONUS_STITCHES} stitches a month to decorate your room`} />
            </div>
            <strong className="text-sm" style={{ color: '#6a7856' }}>
              One of you pays, you both get it.
            </strong>
            <div className="mt-auto flex flex-col gap-2">
              <a href="/plus/" target="_blank" rel="noopener" className="px-btn text-center">
                See plans and prices
              </a>
              <button className="px-btn px-btn--paper" onClick={onDone}>
                Continue with the free version
              </button>
              <small className="text-center text-[var(--muted)]">No hard feelings. Spoiler alert: Plus is so much more fun ;)</small>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
