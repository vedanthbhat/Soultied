// Works out a few thousand answers with the website's letters engine (which cards on which day, streaks,
// scores, the 30 days), for the iPhone app's tests to check its own engine against. Both apps must agree
// exactly, or partners on a phone and a laptop would get different letters.
//   npx esbuild scripts/native-fixtures.ts --bundle --platform=node --outfile=/tmp/fx.cjs && node /tmp/fx.cjs out.json
import { writeFileSync } from 'node:fs';
import { addDays, cardsFor, emptyLetters, hashStr, journeyInfo, journeyChapter, rng, streakInfo, weekday, weekStart, type LetterKind, type LettersState } from '../src/letters/engine';
import { cardsOf, demoLetters, isAnswered, sameAnswer, scoreDay } from '../src/letters/cards';
import type { GameKind, Match, Seat } from '../src/games/types';
import * as play from '../src/games/registry';
import { botColumn } from '../src/games/fireflies';
import { botCell } from '../src/games/noughts';
import { botEdge } from '../src/games/fence';
import { botLantern } from '../src/games/lanterns';
import { botShot, randomFleet } from '../src/games/boats';

const r = rng(20261029);
const int = (n: number) => Math.floor(r() * n);
const pickOf = <T,>(xs: T[]) => xs[int(xs.length)];
const date = (from: number, span: number) => new Date(Date.UTC(2000, 0, 1) + (from + int(span)) * 86400000).toISOString().slice(0, 10);
const ID = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const coupleId = () => {
  const k = int(4);
  if (k === 0) return 'space-demo';
  if (k === 1) return 'space-' + Array.from({ length: 12 }, () => ID[int(36)]).join('');
  if (k === 2) return Array.from({ length: 20 }, () => ID[int(ID.length)]).join('');
  return pickOf(['space-ü', 'space-😀-love', 'घर', 'space-ﬁ']) + int(1000);
};

// which cards on which day
const cards: Array<{ kind: LetterKind; coupleId: string; dateKey: string; startKey: string; heat: number; ids: string[] }> = [];
for (let i = 0; i < 1500; i++) {
  const kind = pickOf<LetterKind>(['daily', 'daily', 'daily', 'afterDark', 'afterDark', 'journey']);
  const startKey = date(8000, 3000);
  // mostly after the start, sometimes long after (cards cycle), sometimes before
  const dateKey = i % 10 === 0 ? date(7000, 2000) : addDays(startKey, int(i % 7 === 0 ? 3000 : 400));
  const key = kind === 'journey' ? pickOf(['j01', 'j05', 'j17', 'j30', 'j31', 'j00', '2026-10-29', `j${String(1 + int(30)).padStart(2, '0')}`]) : dateKey;
  const heat = 1 + int(2);
  const id = coupleId();
  cards.push({ kind, coupleId: id, dateKey: key, startKey, heat, ids: cardsFor(kind, id, key, startKey, heat) });
}

// dates
const days = Array.from({ length: 400 }, (_, i) => {
  const k = i < 6 ? ['2024-02-29', '1999-12-31', '2000-03-01', '1970-01-01', '2100-02-28', '2026-10-29'][i] : date(-12000, 40000);
  const n = int(800) - 400;
  return { key: k, n, added: addDays(k, n), weekday: weekday(k), weekStart: weekStart(k) };
});

const hashes = ['', 'a', 'space-demo:tot', 'space-😀:open', 'घर:lk', 'x'.repeat(300)].map((s) => ({ s, h: hashStr(s) }));
const rngSeq = [0, 1, 123456789, 4294967295].map((seed) => {
  const g = rng(seed);
  return { seed, xs: Array.from({ length: 8 }, () => g()) };
});

// streaks
const today0 = '2026-10-29';
const streaks: Array<{ today: string; sinceKey?: string; revealed: string[]; unopened: string[]; repairs: string[]; out: unknown }> = [];
for (let i = 0; i < 300; i++) {
  const today = addDays(today0, int(60) - 30);
  const revealed: string[] = [];
  const unopened: string[] = [];
  const density = r();
  for (let back = 0; back < 40; back++) {
    const k = addDays(today, -back);
    const x = r();
    if (x < density) revealed.push(k);
    else if (x < density + 0.1) unopened.push(k);
  }
  const repairs = Array.from({ length: int(3) }, () => addDays(today, -int(20)));
  const sinceKey = r() < 0.4 ? undefined : addDays(today, -int(25));
  const st: LettersState = emptyLetters();
  for (const k of revealed) st.daily[k] = { dateKey: k, cardIds: [], by: {}, revealedAt: k + 'T21:00:00' };
  for (const k of unopened) st.daily[k] = { dateKey: k, cardIds: [], by: {} };
  st.repairs = repairs;
  streaks.push({ today, sinceKey, revealed, unopened, repairs, out: streakInfo(st, today, sinceKey) });
}

// scores and the 30 days, from the demo room's made-up history (and some random answers)
const demo: Array<{ today: string; state: LettersState; me: string; them: string; scores: Record<string, unknown>; journey: unknown; answered: Record<string, boolean[]> }> = [];
for (let i = 0; i < 25; i++) {
  const today = addDays(today0, int(400) - 200);
  const id = coupleId();
  const start = addDays(today, -int(300));
  const st = demoLetters(id, start, 'ua', 'ub', today);
  if (i % 3 === 0) st.journeyStart = undefined;
  const scores: Record<string, unknown> = {};
  const answered: Record<string, boolean[]> = {};
  for (const [k, d] of Object.entries(st.daily)) {
    scores[k] = scoreDay(d, 'ua', 'ub');
    answered[k] = cardsOf(d.cardIds).flatMap((c) => [isAnswered(c, d.by.ua?.cards[c.id]), isAnswered(c, d.by.ub?.cards[c.id])]);
  }
  for (const [k, d] of Object.entries(st.journey)) scores[k] = scoreDay(d, 'ub', 'ua');
  demo.push({ today, state: st, me: i % 2 ? 'ua' : 'ub', them: i % 2 ? 'ub' : 'ua', scores, journey: journeyInfo(st, i % 2 ? 'ua' : 'ub', today), answered });
}
const same = cardsOf(['tot-3', 'lk-7', 'open-2', 'know-9']).map((c) => [sameAnswer(c, { pick: 0 }, { pick: 0 }), sameAnswer(c, { pick: 0 }, { pick: 1 })]);
const chapters = Array.from({ length: 32 }, (_, i) => {
  const c = journeyChapter(i);
  return { n: i, index: c.index, dayInChapter: c.dayInChapter, last: c.last };
});

// the games you take turns at: whole games between two of the demo room's partners, every move written down
// (with the random numbers each pick was made from), so the iPhone's rules and partner can be checked move by move
const games: Array<{ kind: GameKind; seat: Seat; seed: number; arg: unknown; before: Match; after: Match }> = [];
const starters: Record<string, (s: Seat) => Match> = {
  fireflies: (s) => play.newFireflies(s),
  noughts: (s) => play.newNoughts(s),
  fence: (s) => play.newFence(s),
  lanterns: (s) => play.newLanterns(s),
  boats: (s) => play.newBoats(s),
};
for (const kind of Object.keys(starters) as GameKind[]) {
  for (let g = 0; g < 8; g++) {
    let m: Match = { ...starters[kind](g % 2 ? 'b' : 'a'), id: `mtest${g}`, startedAt: 0, updatedAt: 0 };
    for (let step = 0; step < 200 && m.status !== 'over'; step++) {
      const seed = int(2 ** 31);
      const r = rng(seed);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const st = m.state as any;
      let seat: Seat;
      let arg: unknown;
      let after: Match | null;
      if (kind === 'boats' && m.status === 'setup') {
        seat = st.fleets.a ? 'b' : 'a';
        arg = randomFleet(r);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        after = play.boatsReady(m as any, seat, arg as any);
      } else {
        seat = m.turn as Seat;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mm = m as any;
        if (kind === 'fireflies') after = play.fireflyMove(mm, seat, (arg = botColumn(st.board, seat, r)) as number);
        else if (kind === 'noughts') after = play.noughtsMove(mm, seat, (arg = botCell(st.board, seat, r)) as number);
        else if (kind === 'fence') after = play.fenceMove(mm, seat, (arg = botEdge(st, seat, r)) as number);
        else if (kind === 'lanterns') after = play.lanternMove(mm, seat, (arg = botLantern(st.board, seat, r)) as number);
        else after = play.boatsShot(mm, seat, (arg = botShot(st, seat, r)) as number);
      }
      if (!after) throw new Error(`no move in ${kind}`);
      games.push({ kind, seat, seed, arg, before: m, after });
      m = after;
    }
  }
}

const out = process.argv[2] || 'native-fixtures.json';
writeFileSync(out, JSON.stringify({ cards, days, hashes, rngSeq, streaks, demo, same, chapters, games }));
console.log(`wrote ${cards.length} card days, ${streaks.length} streaks, ${demo.length} demo rooms, ${games.length} game moves to ${out}`);
