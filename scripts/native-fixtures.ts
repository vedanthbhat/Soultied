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
import { TUG } from '../src/games/tug';
import { RPS } from '../src/games/rps';
import { QUICK } from '../src/games/quickdraw';
import { COUNTDOWN_MS, type LiveDef, seeded } from '../src/games/live/lobby';
import { WORDS, brushLine, fillCells, judge, pickChoices } from '../src/games/doodle';
import { COASTERS } from '../src/games/coasters';
import { KITCHEN } from '../src/games/kitchen';
import { ROOMS } from '../src/escape/rooms';
import { Scene } from '../src/escape/scene';
import { RECORD_MS, startFor, whereAt } from '../src/music/records';
import { parseYouTubeId, parseYouTubeStart } from '../src/watch/youtubeLink';
import { renderWatchRoom, type WatchState } from '../src/pixel/watchRoom';
import { renderRoom, type RoomState } from '../src/pixel/room';
import { START_DECOR } from '../src/decor/catalogue';
import { fireOf, type CouchState } from '../src/couch';
import { daysLeft, normalizeVisit, visitLine } from '../src/together/visit';
import { SNAP_PROMPTS, normalizeSnap, snapPrompt, snapStage } from '../src/together/snap';
import { type RecapInput, monthRecap, recapMonth } from '../src/together/recap';
import { aheadLine, apartKm, apartLabel, distanceKm, normalizeWhere } from '../src/together/where';
import { BUCKET_IDEAS, bucketOverflow, bucketView, cleanText, normalizeBucket, plannedLine } from '../src/together/bucket';
import { normalizeVoice, peaksFrom, unheardVoice, voiceLength } from '../src/together/voice';
import { renderCharacterBack } from '../src/pixel/characterBack';
import { DEMO_DOODLE, OLD_DOODLE_H, OLD_DOODLE_W, DOODLE_H, DOODLE_W, doodleArt, fullDoodle, smallDoodle } from '../src/together/board';

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

// the live games: whole games between two of the demo room's partners as the host runs them (time passing in
// small steps, each partner asked for a move every so often), with Math.random made repeatable, so the iPhone's
// rules can be checked step by step
type LiveStep = { t: number; op: 'init' | 'tick' | 'act'; seat?: Seat; a?: unknown; changed?: boolean; s: unknown };
const live: Array<{ kind: string; seed: number; start: number; steps: LiveStep[]; result: unknown }> = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const liveDefs: Record<string, LiveDef<any, any>> = { tug: TUG, rps: RPS, quickdraw: QUICK, kitchen: KITCHEN };
const realRandom = Math.random;
for (const kind of Object.keys(liveDefs)) {
  const def = liveDefs[kind];
  for (let g = 0; g < 6; g++) {
    const seed = int(2 ** 31);
    Math.random = rng(seed ^ 0x5bd1e995);
    const start = 1_790_000_000_000 + g * 1000;
    let s = def.init(seeded(seed), start);
    const steps: LiveStep[] = [{ t: start, op: 'init', s }];
    const begin = start + COUNTDOWN_MS;
    let res = null;
    for (let t = begin; t < begin + 180_000 && !res; t += 5) {
      const el = t - begin;
      if (def.tick && el % (def.tickMs || 100) === 0) {
        const n = def.tick(s, t);
        if (n !== s) steps.push({ t, op: 'tick', s: (s = n) });
        res = def.result(s);
        if (res) break;
      }
      if (def.bot && el % (def.botMs || 400) === 0) {
        for (const seat of ['a', 'b'] as Seat[]) {
          const a = def.bot(s, seat, t);
          if (a === null || a === undefined) continue;
          const n = def.act(s, seat, a, t);
          steps.push({ t, op: 'act', seat, a, changed: n !== s, s: n });
          s = n;
          res = def.result(s);
          if (res) break;
        }
      }
    }
    Math.random = realRandom;
    live.push({ kind, seed, start, steps: JSON.parse(JSON.stringify(steps)), result: res });
  }
}

// Doodle Guess: how guesses are judged, the brush, the paint bucket, the words offered, and whole games
// between two of the demo room's partners (with Math.random and the clock made repeatable)
const typo = (w: string) => {
  const i = int(w.length);
  const k = int(3);
  const ch = 'abcdefghijklmnopqrstuvwxyz'[int(26)];
  return k === 0 ? w.slice(0, i) + w.slice(i + 1) : k === 1 ? w.slice(0, i) + ch + w.slice(i) : w.slice(0, i) + ch + w.slice(i + 1);
};
const judges: Array<[string, string, string]> = [];
for (let i = 0; i < 1500; i++) {
  const w = pickOf(WORDS);
  const k = int(12);
  const g =
    k === 0 ? w
    : k === 1 ? w + 's'
    : k === 2 ? w + 'es'
    : k === 3 ? w.toUpperCase() + '!'
    : k === 4 ? `the ${w}`
    : k === 5 ? `  A ${w}  `
    : k === 6 ? typo(w)
    : k === 7 ? typo(typo(w))
    : k === 8 ? w.slice(0, 1 + int(w.length))
    : k === 9 ? pickOf(WORDS)
    : k === 10 ? pickOf(['', '   ', 'the', 'an a', 'Café', 'naïve', '😀 cat', 'ice-cream', 'icecream', 'the end', 'thermos', 'another'])
    : `${pickOf(WORDS)} ${w}`;
  judges.push([g, w, judge(g, w)]);
}
const brushes = Array.from({ length: 400 }, () => {
  const a = [int(50) - 5, int(40) - 5, int(50) - 5, int(40) - 5, 1 + int(3)];
  return [...a, brushLine(a[0], a[1], a[2], a[3], a[4])];
});
const fills = Array.from({ length: 60 }, () => {
  const cols = ['.', 'k', 'r', 'y'];
  let p = '';
  for (let i = 0; i < 40 * 30; i++) p += i % 40 === 0 || int(5) === 0 ? pickOf(cols) : p[i - 1];
  const start = int(40 * 30);
  return [p, start, fillCells(p, start)];
});
const choices = Array.from({ length: 200 }, () => {
  const seed = int(2 ** 31);
  const avoid = Array.from({ length: int(6) }, () => pickOf(WORDS));
  return [seed, avoid, pickChoices(rng(seed), avoid)];
});
const doodles: Array<{ seat: Seat; seed: number; now: number; before: Match; after: Match }> = [];
const realNow = Date.now;
for (let g = 0; g < 12; g++) {
  let t = 1_790_000_000_000 + g * 3_600_000;
  Date.now = () => t;
  let m: Match = { ...play.newDoodle(g % 2 ? 'b' : 'a', g), id: `mdoodle${g}` };
  for (let step = 0; step < 400 && m.status !== 'over'; step++) {
    const seat = (['a', 'b'] as Seat[]).find((s) => play.botTurn(m, s));
    if (!seat) throw new Error('nobody to move in doodle');
    t += 1000 + int(20000);
    const seed = int(2 ** 31);
    Math.random = rng(seed);
    const after = play.botAct(m, seat);
    Math.random = realRandom;
    if (!after) throw new Error(`no doodle move for ${seat} in ${(m.state as { phase: string }).phase}`);
    doodles.push({ seat, seed, now: t, before: m, after });
    m = { ...after, seq: m.seq + 1, updatedAt: t, updatedBy: seat };
  }
}
Date.now = realNow;

// Coasters: the host's steps between two of the demo room's partners (every touch, a sample of the ticks), so the
// iPhone's table can be checked against the website's, step by step
type CoasterStep = { op: 'tick' | 'act'; now: number; seat?: Seat; a?: unknown; before: unknown; after: unknown };
const coasterSteps: CoasterStep[] = [];
for (let g = 0; g < 3; g++) {
  const seed = int(2 ** 31);
  const start = 1_790_000_000_000 + g * 100_000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any = COASTERS.init(seeded(seed), start);
  const begin = start + COUNTDOWN_MS;
  let ticks = 0;
  for (let t = begin; t < begin + 60_000 && !COASTERS.result(s); t += 2) {
    const el = t - begin;
    if (el % 16 === 0) {
      const n = COASTERS.tick!(s, t);
      if (ticks++ % 5 === 0 || n.score.a + n.score.b !== s.score.a + s.score.b) coasterSteps.push({ op: 'tick', now: t, before: s, after: n });
      s = n;
      if (COASTERS.result(s)) break;
    }
    if (el % 90 === 0) {
      for (const seat of ['a', 'b'] as Seat[]) {
        const a = COASTERS.bot!(s, seat, t);
        if (!a) continue;
        const n = COASTERS.act(s, seat, a, t);
        coasterSteps.push({ op: 'act', now: t, seat, a, before: s, after: n === s ? null : n });
        s = n;
      }
    }
  }
}
// and some shots at an open goal (the bots above defend too well to score), up to the goal and the serve after
for (const [x, y, vx, vy] of [[40, 140, 10, 200], [60, 25, -20, -230], [30, 120, 60, 240], [52, 100, 0, 90]]) {
  const start = 1_790_100_000_000 + x * 1000;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let s: any = COASTERS.init(seeded(x), start);
  s = { ...s, serveAt: start, puck: { x, y, vx, vy }, mal: { a: { x: 90, y: 150, vx: 0, vy: 0, tx: 90, ty: 150 }, b: { x: 10, y: 10, vx: 0, vy: 0, tx: 10, ty: 10 } }, score: { a: 6, b: 6 } };
  for (let t = start + 16, k = 0; k < 120 && !COASTERS.result(s); t += 16, k++) {
    const n = COASTERS.tick!(s, t);
    coasterSteps.push({ op: 'tick', now: t, before: s, after: n });
    s = n;
  }
}

// every escape room, both halves, at every step and a few moments: a hash of the pixels (and which ones glow)
const fnv = (a: ArrayLike<number>, h: number) => {
  for (let i = 0; i < a.length; i++) h = Math.imul(h ^ a[i], 0x01000193) >>> 0;
  return h;
};
const escape: Array<{ room: string; side: string; step: number; t: number; hash: number }> = [];
for (const room of ROOMS)
  for (const side of ['a', 'b'] as const)
    for (let step = 0; step <= room.puzzles.length; step++)
      for (const t of [0, 0.73, 2.41, 7.9]) {
        const s = new Scene();
        s.reset();
        room.draw(s, side, step, t);
        escape.push({ room: room.id, side, step, t, hash: fnv(s.data, fnv(s.emit, 0x811c9dc5)) });
      }

// the record player: where the record is at any moment (from both sides of the start, and many times round),
// where each track starts, and reading YouTube links
const record: { where: Array<[number, string, number, string]>; starts: number[][]; links: Array<[string, string | null, number]> } = { where: [], starts: [], links: [] };
{
  const r = rng(77);
  const base = 1_790_000_000_000;
  for (let i = 0; i < 400; i++) {
    const startedAt = base + Math.floor(r() * 4e9) - 2e9;
    const now = i % 7 === 0 ? startedAt + Math.floor(r() * 5) * RECORD_MS / 5 : base + Math.floor(r() * 4e9) - 2e9 + r();
    const w = whereAt(startedAt, now);
    // (fractions as text: JSON readers don't all turn a long number back into exactly the same double)
    record.where.push([startedAt, String(now), w.index, String(w.offset)]);
  }
  for (const i of [-7, -1, 0, 1, 2, 3, 4, 5, 6, 11]) record.starts.push([i, base + i, startFor(i, base + i)]);
  for (const l of [
    'dQw4w9WgXcQ', ' dQw4w9WgXcQ ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s',
    'https://youtu.be/dQw4w9WgXcQ?t=42', 'https://youtu.be/dQw4w9WgXcQ?si=abc&t=2h3m4s', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ&start=75',
    'https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=RD', 'https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ?start=9',
    'https://www.youtube.com/live/dQw4w9WgXcQ', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=&t=5', 'https://www.youtube.com/watch?t=5&v=dQw4w9WgXcQ', 'https://vimeo.com/123456', 'not a link',
    'https://youtu.be/dQw4w9WgXcQ?t=1m30', 'https://youtu.be/dQw4w9WgXcQ?t=30s1m', 'https://youtu.be/dQw4w9WgXcQ?t=&start=12',
    'https://youtu.be/dQw4w9WgXcQ?t=1h', 'https://youtu.be/dQw4w9WgXcQ?t=m', 'https://youtu.be/dQw4w9WgXcQ?t=007', 'https://youtu.be/abc',
    'https://www.youtube.com/playlist?list=PL123', 'https://WWW.YouTube.com/watch?v=dQw4w9WgXcQ', '',
  ])
    record.links.push([l, parseYouTubeId(l), parseYouTubeStart(l)]);
}

// the watch room (watching together, from behind the couch) and the characters seen from behind, as hashes of
// their pixels: every hair style, hat, extra and top, both seats, the TV idle, paused and playing, reactions
// at different ages, and karaoke's microphones
const looks = (() => {
  const base = { rendererVersion: 2, height: 'medium', skin: 'wheat', hairStyle: 'long', hairColor: 'cocoa', facialHair: 'none', top: 'sweater', topColor: 'sage', bottom: 'trousers', bottomColor: 'cream', shoes: 'socks', shoesColor: 'terracotta', glasses: 'none', hat: 'none', extra: 'none' };
  const v = (o: Record<string, string>) => ({ ...base, ...o });
  return [
    v({}),
    v({ hairStyle: 'tousled', hairColor: 'black', skin: 'caramel', height: 'tall', top: 'cardigan', topColor: 'terracotta', extra: 'hoops' }),
    v({ hairStyle: 'crop', hairColor: 'chestnut', skin: 'chestnut', top: 'hoodie', topColor: 'denim', hat: 'cap' }),
    v({ hairStyle: 'curls', hairColor: 'auburn', skin: 'porcelain', top: 'turtleneck', topColor: 'mustard', hat: 'beanie', extra: 'hoops' }),
    v({ hairStyle: 'bob', hairColor: 'honey', skin: 'peach', height: 'short', top: 'shirt', topColor: 'forest', hat: 'clip' }),
    v({ hairStyle: 'bun', hairColor: 'ash', skin: 'espresso', top: 'kurta', topColor: 'plum', extra: 'scarf' }),
    v({ hairStyle: 'braid', hairColor: 'lilac', skin: 'wheat', top: 'tee', topColor: 'rose', extra: 'headphones' }),
    v({ hairStyle: 'hijab', hairColor: 'forest', skin: 'caramel', top: 'sweater', topColor: 'cream' }),
    v({ hairStyle: 'buzz', hairColor: 'black', skin: 'chestnut', height: 'tall', top: 'hoodie', topColor: 'charcoal', hat: 'beanie', extra: 'headphones' }),
    v({ hairStyle: 'bald', hairColor: 'cocoa', skin: 'espresso', top: 'shirt', topColor: 'cocoa', extra: 'scarf' }),
    v({ hairStyle: 'hijab', hairColor: 'nope', skin: 'peach', height: 'short', top: 'cardigan', topColor: 'mustard', hat: 'beanie' }),
    // the sillier pieces, and the newer hair
    v({ hairStyle: 'afro', hairColor: 'black', skin: 'espresso', top: 'hoodie', topColor: 'coral', hat: 'party' }),
    v({ hairStyle: 'pigtails', hairColor: 'honey', skin: 'peach', height: 'short', top: 'tee', topColor: 'sky', hat: 'crown' }),
    v({ hairStyle: 'afro', hairColor: 'auburn', skin: 'caramel', height: 'tall', topColor: 'lilac', hat: 'bunny', extra: 'headphones' }),
    v({ hairStyle: 'tousled', hairColor: 'cocoa', top: 'shirt', topColor: 'sky', hat: 'propeller' }),
    v({ hairStyle: 'pigtails', hairColor: 'auburn', top: 'cardigan', topColor: 'rose', hat: 'flowers', extra: 'scarf' }),
    v({ hairStyle: 'bun', hairColor: 'ash', skin: 'chestnut', top: 'turtleneck', topColor: 'forest', hat: 'frog' }),
  ];
})();
const watch: { backs: Array<{ look: number; lean: number; bob: number; hash: number; headTop: number }>; scenes: Array<{ left: number; right: number; tv: string; t: number; reactions: Array<[string, string, number]>; singing: [boolean, boolean] | null; hash: number }> } = { backs: [], scenes: [] };
for (let i = 0; i < looks.length; i++)
  for (const [lean, bob] of [[0, 0], [1, 0], [-1, 1]]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = renderCharacterBack(looks[i] as any, { lean, bob });
    watch.backs.push({ look: i, lean, bob, hash: fnv(r.buf.data, 0x811c9dc5), headTop: r.headTop });
  }
{
  const now = 1_790_000_000_000;
  const pairs: Array<[number, number]> = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10, -1], [-1, 3], [-1, -1], [1, 0]];
  let n = 0;
  for (const [l, r] of pairs)
    for (const tv of ['idle', 'paused', 'playing'] as const)
      for (const t of [0.4, 3.17]) {
        n++;
        const reactions: Array<[string, string, number]> = n % 3 === 0 ? [] : [['heart', 'left', now - 200], ['laugh', 'right', now - 900], ['star', 'left', now - 1500], ['cry', 'right', now - 2500], ['wow', 'right', now + 50]];
        const singing: [boolean, boolean] | null = n % 5 === 0 ? [true, n % 2 === 0] : null;
        const state: WatchState = {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          left: { avatar: l >= 0 ? (looks[l] as any) : null },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          right: { avatar: r >= 0 ? (looks[r] as any) : null },
          tv,
          reactions: reactions.map(([kind, seat, t0]) => ({ kind: kind as 'heart', seat: seat as 'left', t0 })),
          singing: singing ? { left: singing[0], right: singing[1] } : undefined,
        };
        const buf = renderWatchRoom(state, t, now);
        watch.scenes.push({ left: l, right: r, tv, t, reactions, singing, hash: fnv(buf.data, 0x811c9dc5) });
      }
}

// doodles on the wall: made today's size, shrunk for apps from before and for the frame over the couch
const wallDoodles: Array<{ px: string; full: string; small: string; art: string }> = [];
for (let k = 0; k < 24; k++) {
  const [w, h] = k % 3 ? [DOODLE_W, DOODLE_H] : [OLD_DOODLE_W, OLD_DOODLE_H];
  const a = new Array<string>(w * h).fill('0');
  // a few strokes and a few lone dots, in a few inks
  for (let n = 0, m = 3 + int(30); n < m; n++) {
    const ink = (1 + int(15)).toString(16);
    let x = int(w);
    let y = int(h);
    for (let t = 0, len = int(k % 2 ? 40 : 3); t < len; t++) {
      a[y * w + x] = ink;
      x = Math.max(0, Math.min(w - 1, x + int(3) - 1));
      y = Math.max(0, Math.min(h - 1, y + int(3) - 1));
    }
  }
  const px = a.join('');
  wallDoodles.push({ px, full: fullDoodle(px), small: smallDoodle(px), art: doodleArt(px, 'n', 'u').px });
}
wallDoodles.push({ px: DEMO_DOODLE, full: fullDoodle(DEMO_DOODLE), small: smallDoodle(DEMO_DOODLE), art: doodleArt(DEMO_DOODLE, 'n', 'u').px });

// the living room, as hashes of its pixels: the fire at every strength (with your logs on it, and poked), the two
// of you near and far, a few decors, a picture on the wall, touches, moods, and things hovered
type RoomScene = { left: number; right: number; leftStatus?: string; rightStatus?: string; t: number; hash?: number; [k: string]: unknown };
const roomScenes: RoomScene[] = [];
{
  const heart = { rows: ['.##.##.', '#h#####', '#######', '.#####.', '..###..', '...#...'], pal: { '#': '#d9534f', h: '#f3a19c' } };
  const five = { rows: ['y..y..y', '.y.y.y.', '..yyy..', 'yyywyyy', '..yyy..', '.y.y.y.', 'y..y..y'], pal: { y: '#d99a2b', w: '#fff1c9' } };
  const art = doodleArt(DEMO_DOODLE, 'n', 'u');
  const wallArt = { w: art.w, h: art.h, pal: art.pal, px: art.px };
  const scenes: RoomScene[] = [
    { left: 0, right: 1, t: 1.3 },
    { left: 1, right: 2, t: 2.7, letterUnread: true, music: true, gamesWaiting: true, hover: 'door', fire: 0.9, closeness: 0.5, decor: { wall: 'blush', view: 'rain', rug: 'kilim', couch: 'navy', pet: 'pug', painting: 'sea', plant: 'fern' } },
    { left: 3, right: 4, rightStatus: 'away', t: 5.1, closeness: 1, moodLeft: heart, wallNews: true, wallArt, decor: { wall: 'midnight', view: 'aurora', rug: 'braided', couch: 'plum', pet: 'corgi', painting: 'peaks', plant: 'cactus' } },
    { left: 5, right: 6, t: 7.9, closeness: 0.3, moodRight: heart, touch: { kind: 'hug', together: true, from: 'left', at: 6.9, glyph: heart } },
    { left: 7, right: -1, t: 3.3, hover: 'right', decor: { wall: 'clay', view: 'blossom', rug: 'moss', couch: 'mustard', pet: 'tuxedo', painting: 'us', plant: 'snake' } },
    { left: 8, right: 9, rightStatus: 'offline', t: 11.45, hover: 'board', letterUnread: true, heartAt: 10.5, closeness: 0.8, scooting: true, decor: { wall: 'gingham', view: 'summer', rug: 'diamond', couch: 'sage', pet: 'none', painting: 'shapes', plant: 'monstera' } },
    { left: 11, right: 12, t: 20.2, closeness: 0.2, touch: { kind: 'highfive', together: true, from: 'right', at: 19.4, glyph: five }, hover: 'music', music: true },
    { left: 13, right: 14, t: 1.3, bare: true, decor: { wall: 'forest', couch: 'plum' } },
    // the fire
    { left: 0, right: 1, t: 2.1, flame: 0 },
    { left: 0, right: 1, t: 4.4, flame: 0, fire: 1, logs: { left: true, right: false } },
    { left: 15, right: 16, t: 3.3, flame: 1, logs: { left: false, right: true }, wallArt },
    { left: 2, right: 3, t: 6.25, flame: 2, logs: { left: true, right: true }, hover: 'fire' },
    { left: 4, right: 5, t: 8.8, flame: 3, logs: { left: true, right: true }, closeness: 1 },
    { left: 6, right: -1, t: 12.05, flame: 3, fire: 1, hover: 'photo' },
    { left: 0, right: 1, t: 0.37, flame: 3, fire: 0.75, decor: { view: 'rain', wall: 'midnight' } },
  ];
  const seat = (l: number, status = 'online') => (l >= 0 ? { avatar: looks[l], name: 'x', status } : { avatar: null, name: '', status: 'empty' });
  for (const sc of scenes) {
    const st = {
      left: seat(sc.left, sc.leftStatus),
      right: seat(sc.right, sc.rightStatus),
      letterUnread: !!sc.letterUnread,
      fire: sc.fire ?? 0.6,
      flame: sc.flame,
      logs: sc.logs,
      hover: sc.hover ?? null,
      closeness: sc.closeness ?? 0,
      scooting: !!sc.scooting,
      heartAt: sc.heartAt ?? -1,
      gamesWaiting: !!sc.gamesWaiting,
      music: !!sc.music,
      decor: { ...START_DECOR, ...(sc.decor as object) },
      bare: !!sc.bare,
      moods: { left: sc.moodLeft || null, right: sc.moodRight || null },
      touch: sc.touch || null,
      wallArt: sc.wallArt || null,
      wallNews: !!sc.wallNews,
    } as unknown as RoomState;
    roomScenes.push({ ...sc, hash: fnv(renderRoom(st, sc.t).data, 0x811c9dc5) });
  }
}

// how the fire burns: the days in a row you've both been here, seen from different days
const fires: Array<{ together: string[]; today: string; streak: number; level: number }> = [];
{
  const t0 = '2026-02-26';
  const runs: number[][] = [[], [0], [-1], [-2], [0, -1], [-1, -2, -3], [0, -1, -2], [-1, -2, -3, -4, -5, -6], [0, -1, -2, -3, -4, -5, -6], [-1, -2, -3, -4, -5, -6, -7, -9], [0, -2, -3, -4], [3, 2, 1, 0, -1], [-30, -29, -1, 0], [0, -1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15, -16, -17, -18, -19, -20, -21, -22, -23, -24, -25, -26, -27, -28, -29, -30, -31, -32, -33, -34, -35, -36, -37, -38, -39, -40]];
  for (const r of runs)
    for (const today of [t0, '2026-03-01', '2024-03-01', '2026-01-01']) {
      const c: CouchState = { seen: {}, together: r.map((n) => addDays(today, n)).sort(), shown: {} };
      fires.push({ together: c.together, today, ...fireOf(c, today) });
    }
}

// the next time you're together: what's kept, and the countdown to it, seen from different days
const visits: Array<{ raw: unknown; today: string; doc: unknown; days: number | null; line: string | null }> = [];
for (const raw of [
  null,
  { date: '2026-03-12', what: 'Goa', by: 'u1', at: 5 },
  { date: '2026-03-01', what: '' },
  { date: '2026-02-28', what: '  the wedding  ' },
  { date: '2026-3-1', what: 'bad date' },
  { date: 20260301, what: 'a number' },
  { date: '2027-01-01', what: 'a very long name for where we are going to be, longer than thirty' },
  { date: '2024-02-29', what: 'leap day' },
  { what: 'no date' },
])
  for (const today of ['2026-02-26', '2026-02-28', '2026-03-01', '2026-03-12', '2024-02-28', '2026-12-31']) {
    const v = normalizeVisit(raw);
    visits.push({ raw, today, doc: v, days: daysLeft(v, today), line: visitLine(v, today) });
  }

// today's photo: the prompt for a place and a day, what's kept, and who sees what
const snaps: { prompts: Array<[string, string, string]>; docs: Array<{ raw: unknown; doc: unknown; stages: Array<[string, string | null, string]> }>; count: number } = { prompts: [], docs: [], count: SNAP_PROMPTS.length };
for (const sid of ['space-demo', 'abc123', 'घर-😀', ''])
  for (let d = 0; d < 40; d++) {
    const day = addDays('2026-02-20', d * 3);
    snaps.prompts.push([sid, day, snapPrompt(sid, day)]);
  }
{
  const pic = 'data:image/jpeg;base64,/9j/AAA';
  for (const raw of [
    null,
    { by: { a: { photo: pic, w: 640, h: 480, caption: '  the hills  ', at: 7 } } },
    { by: { a: { photo: pic, w: 640, h: 480, caption: '', at: 7 }, b: { photo: pic, w: 480, h: 640, caption: 'x'.repeat(100), at: 9 } } },
    { by: { a: { photo: 'http://no', w: 1 }, b: { photo: pic } } },
    { by: { a: 'nope', b: null } },
  ]) {
    const doc = normalizeSnap(raw);
    snaps.docs.push({ raw, doc, stages: [['a', 'b', snapStage(doc, 'a', 'b')], ['b', 'a', snapStage(doc, 'b', 'a')], ['a', null, snapStage(doc, 'a', null)]] });
  }
}

// your month together: random months of showing up, letters, photos and notes, and what the recap makes of them
const recaps: Array<{ input: RecapInput; month: string; recap: unknown }> = [];
const recapMonths: Array<[string, string, boolean]> = [];
for (let k = 0; k < 12; k++) {
  const start = addDays('2025-12-10', k * 17);
  const day = () => addDays(start, int(70) - 10);
  const input: RecapInput = {
    together: Array.from({ length: int(60) }, day),
    letters: Array.from({ length: int(40) }, () => ({ day: day(), opened: int(4) > 0, same: int(6), total: 5 + int(2) })),
    photos: Array.from({ length: int(12) }, day),
    notes: Array.from({ length: int(15) }, () => ({ day: day(), doodle: int(2) === 1 })),
  };
  for (const month of [start.slice(0, 7), addDays(start, 31).slice(0, 7)]) recaps.push({ input, month, recap: monthRecap(input, month) });
}
for (const t of ['2026-01-01', '2026-01-03', '2026-01-04', '2026-03-02', '2026-03-31', '2024-03-01', '2026-12-04']) {
  const r = recapMonth(t);
  recapMonths.push([t, r.month, r.done]);
}

// how far apart: what's kept, the distance between two places, and how it's all said
const wheres: { docs: unknown[]; dists: number[][]; labels: Array<[number, string, string]>; aheads: Array<[number, string]> } = { docs: [], dists: [], labels: [], aheads: [] };
for (const raw of [
  null,
  { by: { a: { lat: 12.97, lon: 77.59, tz: 'Asia/Kolkata', at: 5 }, b: { lat: 51.507, lon: -0.128, tz: 'Europe/London', at: 7 } } },
  { by: { a: { lat: -33.87, lon: 151.21, tz: 'Australia/Sydney' }, b: { lat: 40.71, lon: -74.01, tz: 'America/New_York' } } },
  { by: { a: { lat: 91, lon: 10, tz: 'Bad Zone!' }, b: { lat: -0.04, lon: -0.15, tz: 'Etc/GMT+5' } } },
  { by: { a: { lat: 10, tz: 'UTC' }, b: { lat: '10', lon: 20, tz: 5 }, c: 'nope' } },
  { by: { a: { lat: 45.25, lon: -179.95, tz: 'America/Argentina/Buenos_Aires' }, b: { lat: -45.25, lon: 179.95, tz: 'Pacific/Auckland', at: 1e12 } } },
  { by: 'nope' },
]) {
  const doc = normalizeWhere(raw);
  wheres.docs.push({ raw, doc, km: apartKm(doc, 'a', 'b') });
}
for (let k = 0; k < 80; k++) {
  const a = { lat: int(1801) / 10 - 90, lon: int(3601) / 10 - 180 };
  const b = k % 4 === 0 ? { lat: a.lat + (int(41) - 20) / 10, lon: a.lon + (int(41) - 20) / 10 } : { lat: int(1801) / 10 - 90, lon: int(3601) / 10 - 180 };
  wheres.dists.push([a.lat, a.lon, b.lat, b.lon, distanceKm(a, b)]);
}
for (const km of [0, 5, 19.9, 20, 22.4, 24.9, 97.4, 97.6, 99.9, 102, 104.9, 999, 1000, 1024, 1608, 8049, 8075, 12345.6, 20015, ...Array.from({ length: 30 }, () => int(2000000) / 100)])
  wheres.labels.push([km, apartLabel(km), apartLabel(km, true)]);
for (const d of [0, 7, 8, -8, 15, 22, 23, 29, 30, 44, 52, 53, 60, 337, -330, 345, 525, -600, 780, -9.6, 59.6, ...Array.from({ length: 30 }, () => int(1561) - 720)]) wheres.aheads.push([d, aheadLine(d)]);

// our list: what's kept, how it's ordered, what goes when it's too long, and how what's typed is tidied
const bucketRaws: unknown[] = [
  null,
  { items: 'nope' },
  {
    items: {
      a: { text: 'Watch the sunrise', by: 'u1', at: 300, next: true },
      b: { text: '  Eat   at the shack\twith the\nlights  ', by: 'u2', at: 500, next: true },
      c: { text: 'Read the same book', by: 'u1', at: 500 },
      d: { text: 'Escape room', by: 'u1', at: 100, done: 900, doneBy: 'u2' },
      e: { text: 'Fall asleep on a call', by: 'u2', at: 50, done: 900, doneBy: 'u1' },
      f: { text: '   ', by: 'u1', at: 1 },
      g: null,
      h: 'nope',
      i: { text: 42, at: 2 },
      j: { text: 'Next is a string', next: 'yes', at: 'soon', done: 'no' },
      k: { text: '😀'.repeat(100) },
      l: { text: 'x'.repeat(120) },
      m: { text: 'no\u00a0break\u2003space', at: 500 },
    },
  },
];
{
  const items: Record<string, unknown> = {};
  for (let k = 0; k < 206; k++) items[`w${String(k).padStart(3, '0')}`] = { text: `thing ${k}`, at: int(1000), next: int(5) === 0, ...(int(3) === 0 ? { done: 1 + int(1000), doneBy: 'u1' } : {}) };
  bucketRaws.push({ items });
}
const buckets = {
  ideas: BUCKET_IDEAS,
  docs: bucketRaws.map((raw) => {
    const doc = normalizeBucket(raw);
    const v = bucketView(doc);
    return { raw, doc, todo: v.todo.map((i) => i.id), done: v.done.map((i) => i.id), overflow: bucketOverflow(doc), planned: [plannedLine(doc, 'Goa'), plannedLine(doc, '')] };
  }),
  clean: ['', '  hi  ', 'a\tb\n\nc', 'x'.repeat(85), '😀'.repeat(81), ' é '.repeat(30), 'mixed 😀 text '.repeat(8)].map((s) => [s, cleanText(s)]),
};

// voice notes: what's kept (and what isn't), the loudness bars, and how long they say they are
const voiceRaws: Array<[string, unknown]> = [
  ['voice-a', { by: 'u2', at: 500, secs: 6.06, mime: 'audio/mp4', audio: 'AAAAHGZ0eXBNNEEg', peaks: '123456789', heard: { u1: 700, u3: 'x' } }],
  ['voice-b', { by: 'u2', at: 900, secs: 61.3, mime: 'audio/mp4;codecs=mp4a.40.2', audio: 'QUJD', peaks: '12a' }],
  ['voice-c', { by: 'u1', at: 800, secs: -2, mime: 'AUDIO/X-M4A', audio: 'QUJDRA==' }],
  ['voice-d', { by: 'u2', at: 950, mime: 'audio/webm', audio: 'QUJD' }],
  ['voice-e', { by: 'u2', at: 960, mime: 'audio/mp4', audio: 'QU JD' }],
  ['voice-f', { by: 'u2', at: 970, mime: 'audio/mp4', audio: 'QUJD===' }],
  ['voice-g', { by: 'u2', at: 980, gone: true, audio: '' }],
  ['voice-h', { by: '', mime: 'audio/mp4', audio: 'QUJD' }],
  ['voice-i', { by: 'u2', at: 'soon', secs: 'long', mime: 'audio/aac', audio: 'QUJD', peaks: '0'.repeat(65) }],
  ['voice-j', null],
  ['voice-k', { by: 'u2', at: 990, mime: 'audio/mp4', audio: 'A'.repeat(420_001) }],
];
const voiceDocs = voiceRaws.map(([id, raw]) => ({ id, raw: id === 'voice-k' ? { ...(raw as object), audio: 'long' } : raw, long: id === 'voice-k', voice: normalizeVoice(id, raw) }));
const kept = voiceRaws.map(([id, raw]) => normalizeVoice(id, raw)).filter((v): v is NonNullable<typeof v> => !!v);
const voices = {
  docs: voiceDocs,
  unheard: [unheardVoice(kept, 'u1', 'u2')?.id ?? null, unheardVoice(kept, 'u3', 'u2')?.id ?? null, unheardVoice(kept, 'u2', 'u1')?.id ?? null, unheardVoice(kept, 'u1', null)?.id ?? null],
  peaks: [[] as number[], [0, 0, 0], [0.5], [0.1, 0.2, 0.3], ...Array.from({ length: 30 }, () => Array.from({ length: 1 + int(700) }, () => (int(5) === 0 ? 0 : int(10000) / 20000)))].map((l) => [l, peaksFrom(l), peaksFrom(l, 8)]),
  lengths: [0, 0.4, 0.5, 6.06, 59.5, 60, 61, 125.2].map((s) => [s, voiceLength(s)]),
};

const out = process.argv[2] || 'native-fixtures.json';
writeFileSync(out, JSON.stringify({ cards, days, hashes, rngSeq, streaks, demo, same, chapters, games, live, doodle: { judges, brushes, fills, choices, games: doodles }, coasters: coasterSteps, escape, record, watch: { looks, ...watch }, wall: { doodles: wallDoodles }, room: { scenes: roomScenes, fires, visits }, snaps, recaps: { cases: recaps, months: recapMonths }, wheres, buckets, voices }));
console.log(`wrote ${cards.length} card days, ${streaks.length} streaks, ${demo.length} demo rooms, ${games.length} game moves, ${live.length} live games, ${doodles.length} doodle moves to ${out}`);
