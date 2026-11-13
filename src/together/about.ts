/**
 * About the two of you: five quick questions the first time you're in your place, each a tap (and one a date:
 * the next time you'll see each other, which starts the countdown). Then what in Soultied fits what you said.
 * Kept in the place's `meta/about` document, by person: question id to answer id (the iPhone app asks the same).
 */

export interface AboutQuestion {
  id: string;
  ask: (name: string) => string;
  answers: { id: string; label: string }[];
}

const q = (id: string, ask: (name: string) => string, answers: [string, string][]): AboutQuestion => ({
  id,
  ask,
  answers: answers.map(([a, label]) => ({ id: a, label })),
});

/** the four tap questions (the date comes third, between `often` and `miss`) */
export const ABOUT: AboutQuestion[] = [
  q('far', () => 'How far apart are you?', [
    ['city', 'Same city, different places'],
    ['hours', 'A few hours away'],
    ['country', 'Different countries'],
    ['zones', 'Different time zones'],
  ]),
  q('often', () => 'How often do you get to see each other?', [
    ['weeks', 'Most weeks'],
    ['month', 'Every month or so'],
    ['months', 'Every few months'],
    ['unsure', 'We’re not sure yet'],
  ]),
  q('miss', (n) => `What do you miss most about being with ${n}?`, [
    ['talk', 'Talking for hours'],
    ['touch', 'The little touches'],
    ['watch', 'Watching things together'],
    ['nothing', 'Doing nothing together'],
  ]),
  q('when', () => 'When do you usually have time for each other?', [
    ['morning', 'Mornings'],
    ['day', 'Breaks in the day'],
    ['evening', 'Evenings'],
    ['late', 'Late at night'],
  ]),
];

/** all five, the date included */
export const ABOUT_STEPS = ABOUT.length + 1;

/** what in Soultied fits what they miss most */
export function aboutFit(miss: string | undefined, name: string): { title: string; line: string } {
  switch (miss) {
    case 'touch':
      return { title: 'Send a touch, or hold the couch', line: `A hug, a kiss or a boop pops up on ${name}’s screen. Hold the couch together and you’ll sit side by side.` };
    case 'watch':
      return { title: 'Watch together', line: 'The TV in your room plays YouTube in sync, and the extension does Netflix and Prime Video, with your chat and reactions over it.' };
    case 'nothing':
      return { title: 'Just be in the room', line: 'Your little place is always there: the fire, the record player, the two of you on the couch. Open it and they’ll see you’re here.' };
    default:
      return { title: 'Today’s letter', line: 'Five little questions a day, answered in secret and opened together. They’re what you’ll end up talking about for hours.' };
  }
}

export interface AboutDoc {
  /** by person: question id to answer id (and `at`, when they answered) */
  by: Record<string, Record<string, string>>;
}

export function normalizeAbout(raw: unknown): AboutDoc {
  const r = raw && typeof raw === 'object' ? (raw as { by?: unknown }) : {};
  const by: AboutDoc['by'] = {};
  if (r.by && typeof r.by === 'object')
    for (const [uid, v] of Object.entries(r.by as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const answers: Record<string, string> = {};
      for (const [k, a] of Object.entries(v as Record<string, unknown>)) if (typeof a === 'string') answers[k] = a;
      by[uid] = answers;
    }
  return { by };
}

export const demoAbout = (): AboutDoc => ({ by: {} });
