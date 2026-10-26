import type { Seat } from './types';
import type { LiveDef } from './live/lobby';
import { COUNTDOWN_MS } from './live/lobby';

/**
 * Kitchen Rush: one of you chops, the other cooks, and the orders keep coming. Ninety seconds, and
 * you're on the same side: every order you get out before its ticket runs out counts for both of you.
 *
 * The chopper takes vegetables from the crates and chops them (CHOPS taps each); chopped ones go on
 * the pass. The cook puts what an order needs from the pass into the pot, cooks it, and serves it.
 * Leave a cooked pot too long and it burns. Who chops and who cooks is drawn at the start.
 */

export const SHIFT_MS = 90_000;
export const CHOPS = 4;
export const COOK_MS = 3500;
/** a finished pot burns this long after it's done */
export const BURN_MS = 7000;
export const PASS_MAX = 4;
export const POT_MAX = 3;
export const MAX_ORDERS = 4;
/** how long an order waits before the customer gives up */
export const PATIENCE_MS = 45_000;
/** the gap between new orders: starts at the first, and shrinks to the second as the shift goes on */
const ORDER_GAP = [12_000, 7_000];

export type Ing = 'tomato' | 'onion' | 'carrot' | 'mushroom' | 'potato';
export const INGS: Ing[] = ['tomato', 'onion', 'carrot', 'mushroom', 'potato'];
export const ING_NAME: Record<Ing, string> = { tomato: 'Tomato', onion: 'Onion', carrot: 'Carrot', mushroom: 'Mushroom', potato: 'Potato' };

export type DishId = 'tomatoSoup' | 'mushroomSoup' | 'stirFry' | 'stew' | 'minestrone';
export const DISHES: Record<DishId, { name: string; needs: Ing[] }> = {
  tomatoSoup: { name: 'Tomato soup', needs: ['tomato', 'onion'] },
  mushroomSoup: { name: 'Mushroom soup', needs: ['mushroom', 'onion'] },
  stirFry: { name: 'Stir-fry', needs: ['carrot', 'mushroom', 'onion'] },
  stew: { name: 'Potato stew', needs: ['potato', 'carrot', 'onion'] },
  minestrone: { name: 'Minestrone', needs: ['tomato', 'carrot', 'potato'] },
};
const EASY: DishId[] = ['tomatoSoup', 'mushroomSoup'];
const ALL = Object.keys(DISHES) as DishId[];

export interface Order {
  id: number;
  dish: DishId;
  at: number;
  until: number;
}

export type KitchenNews = { kind: 'served' | 'wrong' | 'burnt' | 'missed'; at: number; dish?: DishId };

export interface KitchenState {
  roles: { chop: Seat; cook: Seat };
  startAt: number;
  endsAt: number;
  orders: Order[];
  nextOrderAt: number;
  nextId: number;
  /** the shift's own little random numbers, so new orders are the same on both screens */
  seed: number;
  board: { ing: Ing; chops: number } | null;
  /** chopped and waiting for the cook */
  pass: Ing[];
  pot: Ing[];
  /** when the pot went on the stove (null: not cooking) */
  cookStart: number | null;
  served: number;
  missed: number;
  burnt: number;
  news: KitchenNews | null;
  over: boolean;
}

export type KitchenAct =
  | { t: 'take'; ing: Ing }
  | { t: 'chop' }
  | { t: 'toss' }
  | { t: 'add'; i: number }
  | { t: 'cook' }
  | { t: 'serve' }
  | { t: 'bin' };

const rand = (seed: number) => {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return { next, r: next / 4294967296 };
};

/** same ingredients, in any order */
export const sameDish = (a: Ing[], b: Ing[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
/** can this pot still become that dish? */
export const fitsDish = (pot: Ing[], dish: DishId) => {
  const left = [...DISHES[dish].needs];
  for (const i of pot) {
    const k = left.indexOf(i);
    if (k < 0) return false;
    left.splice(k, 1);
  }
  return true;
};
export const potState = (s: KitchenState, now: number): 'empty' | 'filling' | 'cooking' | 'done' | 'burning' => {
  if (s.cookStart === null) return s.pot.length ? 'filling' : 'empty';
  const t = now - s.cookStart;
  if (t < COOK_MS) return 'cooking';
  return t < COOK_MS + BURN_MS * 0.6 ? 'done' : 'burning';
};

function newOrder(s: KitchenState, now: number, easy: boolean): KitchenState {
  const { next, r } = rand(s.seed);
  const list = easy ? EASY : ALL;
  const dish = list[Math.floor(r * list.length) % list.length];
  return { ...s, seed: next, nextId: s.nextId + 1, orders: [...s.orders, { id: s.nextId, dish, at: now, until: now + PATIENCE_MS }] };
}

/** what the orders still need, less what's chopped, on the board or in the pot (the demo partner uses it) */
export function stillNeeded(s: KitchenState): Ing[] {
  const need: Ing[] = s.orders.flatMap((o) => DISHES[o.dish].needs);
  for (const have of [...s.pass, ...s.pot, ...(s.board ? [s.board.ing] : [])]) {
    const k = need.indexOf(have);
    if (k >= 0) need.splice(k, 1);
  }
  return need;
}

export const KITCHEN: LiveDef<KitchenState, KitchenAct> = {
  init: (rng, now) => {
    const startAt = now + COUNTDOWN_MS;
    const chop: Seat = rng() < 0.5 ? 'a' : 'b';
    let s: KitchenState = {
      roles: { chop, cook: chop === 'a' ? 'b' : 'a' },
      startAt,
      endsAt: startAt + SHIFT_MS,
      orders: [],
      nextOrderAt: startAt + ORDER_GAP[0],
      nextId: 1,
      seed: Math.floor(rng() * 4294967296) >>> 0,
      board: null,
      pass: [],
      pot: [],
      cookStart: null,
      served: 0,
      missed: 0,
      burnt: 0,
      news: null,
      over: false,
    };
    s = newOrder(s, startAt, true);
    s = newOrder(s, startAt, true);
    return s;
  },
  act: (s, seat, a, now) => {
    if (s.over || !a || now >= s.endsAt) return s;
    if (seat === s.roles.chop) {
      if (a.t === 'take' && !s.board && (INGS as string[]).includes(a.ing)) return { ...s, board: { ing: a.ing, chops: 0 } };
      if (a.t === 'toss' && s.board) return { ...s, board: null };
      if (a.t === 'chop' && s.board && s.board.chops < CHOPS) {
        const chops = s.board.chops + 1;
        if (chops >= CHOPS && s.pass.length < PASS_MAX) return { ...s, board: null, pass: [...s.pass, s.board.ing] };
        return { ...s, board: { ...s.board, chops } };
      }
      return s;
    }
    // the cook
    if (a.t === 'add') {
      if (s.cookStart !== null || s.pot.length >= POT_MAX || !Number.isInteger(a.i) || a.i < 0 || a.i >= s.pass.length) return s;
      const pass = [...s.pass];
      const [ing] = pass.splice(a.i, 1);
      return { ...s, pass, pot: [...s.pot, ing] };
    }
    if (a.t === 'cook' && s.cookStart === null && s.pot.length) return { ...s, cookStart: now };
    if (a.t === 'bin' && (s.pot.length || s.cookStart !== null)) return { ...s, pot: [], cookStart: null };
    if (a.t === 'serve' && s.cookStart !== null && now - s.cookStart >= COOK_MS) {
      const o = s.orders.find((x) => sameDish(DISHES[x.dish].needs, s.pot));
      if (!o) return { ...s, pot: [], cookStart: null, news: { kind: 'wrong', at: now } };
      return { ...s, pot: [], cookStart: null, served: s.served + 1, orders: s.orders.filter((x) => x.id !== o.id), news: { kind: 'served', at: now, dish: o.dish } };
    }
    return s;
  },
  tick: (s, now) => {
    if (s.over || now < s.startAt) return s;
    if (now >= s.endsAt) return { ...s, over: true };
    let n = s;
    // a pot left on the stove
    if (n.cookStart !== null && now - n.cookStart >= COOK_MS + BURN_MS) n = { ...n, pot: [], cookStart: null, burnt: n.burnt + 1, news: { kind: 'burnt', at: now } };
    // customers who gave up
    const late = n.orders.filter((o) => o.until <= now);
    if (late.length) n = { ...n, orders: n.orders.filter((o) => o.until > now), missed: n.missed + late.length, news: { kind: 'missed', at: now, dish: late[0].dish } };
    // new orders, more often as the shift goes on
    if (now >= n.nextOrderAt) {
      const k = Math.min(1, (now - n.startAt) / SHIFT_MS);
      const gap = ORDER_GAP[0] + (ORDER_GAP[1] - ORDER_GAP[0]) * k;
      n = n.orders.length < MAX_ORDERS ? newOrder(n, now, n.served + n.missed < 1) : n;
      n = { ...n, nextOrderAt: now + gap };
    }
    // something chopped, waiting for room on the pass
    if (n.board && n.board.chops >= CHOPS && n.pass.length < PASS_MAX) n = { ...n, board: null, pass: [...n.pass, n.board.ing] };
    return n;
  },
  result: (s) => {
    if (!s.over) return null;
    const line = `served ${s.served} ${s.served === 1 ? 'order' : 'orders'} together`;
    return { winner: 'draw', line, score: { a: s.served, b: s.served } };
  },
  // the demo room's partner plays whichever job they were given
  bot: (s, seat, now) => {
    if (s.over || now < s.startAt) return null;
    if (seat === s.roles.chop) {
      if (s.board) return s.board.chops < CHOPS ? { t: 'chop' } : null;
      if (s.pass.length >= PASS_MAX) return null;
      const need = stillNeeded(s);
      const ing = need[0] || (s.orders[0] ? DISHES[s.orders[0].dish].needs[0] : null);
      return ing ? { t: 'take', ing } : null;
    }
    const pot = potState(s, now);
    if (pot === 'done' || pot === 'burning') return { t: 'serve' };
    if (pot === 'cooking') return null;
    const fits = s.orders.filter((o) => fitsDish(s.pot, o.dish));
    if (!fits.length) return s.pot.length ? { t: 'bin' } : null;
    if (fits.some((o) => sameDish(s.pot, DISHES[o.dish].needs))) return { t: 'cook' };
    // add something from the pass that one of those orders still needs
    for (const o of fits) {
      const want = [...DISHES[o.dish].needs];
      for (const i of s.pot) want.splice(want.indexOf(i), 1);
      const i = s.pass.findIndex((x) => want.includes(x));
      if (i >= 0) return { t: 'add', i };
    }
    // the pass is full of things nobody wants: clear some of it through the pot
    if (s.pass.length >= PASS_MAX && s.pot.length < POT_MAX) return { t: 'add', i: 0 };
    return null;
  },
  botMs: 480,
  tickMs: 200,
  phase: (s) => (s.over ? 'over' : 'shift'),
};
