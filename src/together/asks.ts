/**
 * Questions you write for each other. One of you asks (in your own words, or with up to four
 * answers to pick from) and answers it too; it opens for both of you once the other has answered.
 * Kept in the place's `meta/asks` document.
 */

export interface AskAnswer {
  /** the option picked, when there are options */
  pick?: number;
  /** the answer in your own words, when there aren't */
  text?: string;
  at: number;
}

export interface Ask {
  id: string;
  by: string;
  prompt: string;
  /** 2–4 answers to pick from, or none to answer in your own words */
  options: string[];
  at: number;
  answers: Record<string, AskAnswer>;
  /** when each of you first saw it open */
  seen: Record<string, number>;
}

export interface AsksDoc {
  items: Record<string, Ask>;
}

export const ASK_PROMPT_MAX = 200;
export const ASK_OPTION_MAX = 60;
export const ASK_ANSWER_MAX = 400;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function normalizeAnswer(raw: unknown): AskAnswer | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<AskAnswer>;
  const out: AskAnswer = { at: typeof a.at === 'number' ? a.at : 0 };
  if (typeof a.pick === 'number') out.pick = a.pick;
  if (typeof a.text === 'string' && a.text.trim()) out.text = a.text.slice(0, ASK_ANSWER_MAX);
  return out.pick != null || out.text ? out : null;
}

export function normalizeAsks(raw: unknown): AsksDoc {
  const items: Record<string, Ask> = {};
  const src = raw && typeof raw === 'object' ? ((raw as { items?: unknown }).items as Record<string, unknown>) : null;
  if (src && typeof src === 'object') {
    for (const [id, v] of Object.entries(src)) {
      if (!v || typeof v !== 'object') continue;
      const x = v as Partial<Ask>;
      const prompt = str(x.prompt, ASK_PROMPT_MAX).trim();
      if (!prompt || typeof x.by !== 'string') continue;
      const options = Array.isArray(x.options) ? x.options.map((o) => str(o, ASK_OPTION_MAX).trim()).filter(Boolean).slice(0, 4) : [];
      const answers: Record<string, AskAnswer> = {};
      for (const [uid, a] of Object.entries(x.answers && typeof x.answers === 'object' ? x.answers : {})) {
        const n = normalizeAnswer(a);
        if (n) answers[uid] = n;
      }
      const seen: Record<string, number> = {};
      for (const [uid, at] of Object.entries(x.seen && typeof x.seen === 'object' ? x.seen : {})) if (typeof at === 'number') seen[uid] = at;
      items[id] = { id, by: x.by, prompt, options: options.length >= 2 ? options : [], at: typeof x.at === 'number' ? x.at : 0, answers, seen };
    }
  }
  return { items };
}

export const emptyAsks = (): AsksDoc => ({ items: {} });

export const isOpen = (a: Ask, me: string, them: string) => !!a.answers[me] && !!a.answers[them];

export interface AsksView {
  /** your person asked, you haven't answered */
  forMe: Ask[];
  /** you asked, they haven't answered */
  waiting: Ask[];
  /** both answered, newest first */
  opened: Ask[];
  /** opened since you last looked */
  fresh: Ask[];
}

export function viewAsks(doc: AsksDoc, me: string, them: string | null): AsksView {
  const all = Object.values(doc.items).sort((a, b) => b.at - a.at);
  if (!them) return { forMe: [], waiting: all.filter((a) => a.by === me), opened: [], fresh: [] };
  const opened = all.filter((a) => isOpen(a, me, them));
  return {
    forMe: all.filter((a) => a.by !== me && !a.answers[me]),
    waiting: all.filter((a) => a.by === me && !a.answers[them]),
    opened,
    fresh: opened.filter((a) => !a.seen[me]),
  };
}

/** The demo room: Rohan has asked Aanya something, and one they've both answered already. */
export function demoAsks(): AsksDoc {
  const now = Date.now();
  return {
    items: {
      'ask-demo-1': {
        id: 'ask-demo-1',
        by: 'user-rohan',
        prompt: 'What’s the first thing you want to do when I land?',
        options: [],
        at: now - 2 * 3600e3,
        answers: { 'user-rohan': { text: 'Hug you at arrivals for an embarrassingly long time.', at: now - 2 * 3600e3 } },
        seen: {},
      },
      'ask-demo-0': {
        id: 'ask-demo-0',
        by: 'user-aanya',
        prompt: 'Which of our trips would you do again tomorrow?',
        options: ['The beach weekend', 'The rainy city one', 'The mountain cabin', 'The one we haven’t had yet'],
        at: now - 3 * 86400e3,
        answers: {
          'user-aanya': { pick: 2, at: now - 3 * 86400e3 },
          'user-rohan': { pick: 2, at: now - 3 * 86400e3 + 5400e3 },
        },
        seen: { 'user-aanya': now - 2 * 86400e3, 'user-rohan': now - 2 * 86400e3 },
      },
    },
  };
}

/** In the demo room, Rohan answers whatever you ask him, a moment later. */
export const DEMO_REPLIES = [
  'Easy. You, every time.',
  'Ooh. Ask me again on our call, I want to see your face.',
  'This made me smile at my desk.',
  'Honestly? Same as you, probably.',
];
