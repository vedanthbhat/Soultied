/**
 * Decorating the living room. The layout stays the same; each spot in it (the
 * wallpaper, the couch, the rug, the pet, the view, the painting, the plant)
 * has a few pixel-art pieces to choose from. Everything is bought with
 * stitches, which you earn by showing up.
 *
 * Kept as plain data: the room draws whatever is placed, and the place's
 * `meta/decor` document (or this browser, before you're online) remembers
 * what you've earned, bought and put out.
 */

export type SlotId = 'wall' | 'couch' | 'rug' | 'pet' | 'view' | 'painting' | 'plant';

export interface DecorItem {
  id: string;
  slot: SlotId;
  name: string;
  /** in stitches; 0 is free (the room you start with, and "no pet") */
  price: number;
  blurb: string;
}

export interface Slot {
  id: SlotId;
  name: string;
  /** what's there when you move in */
  start: string;
}

export const SLOTS: Slot[] = [
  { id: 'wall', name: 'Wallpaper', start: 'sage' },
  { id: 'couch', name: 'Couch', start: 'terracotta' },
  { id: 'rug', name: 'Rug', start: 'diamond' },
  { id: 'pet', name: 'Pet', start: 'ginger' },
  { id: 'view', name: 'Window', start: 'snow' },
  { id: 'painting', name: 'Painting', start: 'dusk' },
  { id: 'plant', name: 'Plant', start: 'monstera' },
];

const item = (slot: SlotId, id: string, name: string, price: number, blurb: string): DecorItem => ({ id, slot, name, price, blurb });

export const ITEMS: DecorItem[] = [
  item('wall', 'sage', 'Sage stripes', 0, 'The green you moved in with, with tiny sprigs.'),
  item('wall', 'blush', 'Blush damask', 60, 'Dusty rose with a soft damask print.'),
  item('wall', 'gingham', 'Cottage gingham', 60, 'Warm cream checks, like a farmhouse kitchen.'),
  item('wall', 'midnight', 'Midnight stars', 80, 'Deep blue, with little gold stars all over.'),
  item('wall', 'clay', 'Clay arches', 100, 'Terracotta with a row of soft arches.'),
  item('wall', 'forest', 'Forest leaves', 100, 'Dark green, scattered with leaves.'),

  item('couch', 'terracotta', 'Terracotta', 0, 'The couch you started on.'),
  item('couch', 'sage', 'Sage velvet', 120, 'Soft green velvet, with a terracotta throw.'),
  item('couch', 'mustard', 'Mustard', 120, 'Sunny and a little retro.'),
  item('couch', 'linen', 'Oat linen', 120, 'Pale and calm, with rust and sage cushions.'),
  item('couch', 'navy', 'Navy', 150, 'Deep blue, with mustard and cream cushions.'),
  item('couch', 'plum', 'Plum', 150, 'Rich plum velvet, very cosy.'),

  item('rug', 'diamond', 'Diamond rug', 0, 'The cream rug with terracotta diamonds.'),
  item('rug', 'moss', 'Moss rug', 50, 'Plain soft green, with a cream border.'),
  item('rug', 'kilim', 'Kilim stripes', 80, 'Woven bands of rust, cream, sage and gold.'),
  item('rug', 'checker', 'Checkerboard', 80, 'Cream and sage squares.'),
  item('rug', 'braided', 'Braided oval', 120, 'A round rug of braided rings.'),

  item('pet', 'ginger', 'Ginger cat', 0, 'Asleep by the fire, as always.'),
  item('pet', 'none', 'No pet', 0, 'Just the cushion by the hearth.'),
  item('pet', 'tuxedo', 'Tuxedo cat', 150, 'Black and white, very dignified, very asleep.'),
  item('pet', 'bunny', 'White bunny', 180, 'A fluffy loaf with its ears tucked back.'),
  item('pet', 'pug', 'Sleepy pug', 200, 'Snores a little. Worth it.'),
  item('pet', 'corgi', 'Corgi', 250, 'Big ears, short legs, deeply asleep.'),

  item('view', 'snow', 'Snowy night', 0, 'Snow falling on the hills, and a moon.'),
  item('view', 'rain', 'Rainy evening', 80, 'Rain against the glass. Best with the fire on.'),
  item('view', 'summer', 'Summer night', 120, 'Warm hills and fireflies drifting about.'),
  item('view', 'blossom', 'Spring blossom', 150, 'A pink dusk and petals on the breeze.'),
  item('view', 'city', 'City lights', 150, 'A skyline, its windows going on and off.'),
  item('view', 'aurora', 'Northern lights', 250, 'Green lights rippling over the snow.'),

  item('painting', 'dusk', 'Dusk hills', 0, 'The warm landscape over the mantel.'),
  item('painting', 'sea', 'Seaside', 60, 'A little boat on a calm sea.'),
  item('painting', 'peaks', 'Moonlit peaks', 80, 'Snowy mountains under a full moon.'),
  item('painting', 'flowers', 'Flowers in a vase', 80, 'A still life in warm colours.'),
  item('painting', 'shapes', 'Shapes', 100, 'Sun, arch and hill, in blocks of colour.'),
  item('painting', 'us', 'A portrait of you two', 200, 'The two of you, framed over the fire.'),

  item('plant', 'monstera', 'Big leafy plant', 0, 'The one in the corner.'),
  item('plant', 'snake', 'Snake plant', 40, 'Tall striped leaves. Impossible to kill.'),
  item('plant', 'fern', 'Fern', 60, 'Soft, arching fronds.'),
  item('plant', 'cactus', 'Cactus', 60, 'With a little pink flower on top.'),
  item('plant', 'lemon', 'Lemon tree', 120, 'A small tree with real lemons.'),
];

export const itemById = (slot: SlotId, id: string) => ITEMS.find((i) => i.slot === slot && i.id === id) || null;
export const itemsIn = (slot: SlotId) => ITEMS.filter((i) => i.slot === slot);
export const slotName = (slot: SlotId) => SLOTS.find((s) => s.id === slot)!.name;

/** What's in the room: one piece per spot. */
export type Decor = Record<SlotId, string>;

export const START_DECOR: Decor = Object.fromEntries(SLOTS.map((s) => [s.id, s.start])) as Decor;

/** Fill in anything missing (or no longer in the catalogue) with what you started with. */
export function decorOf(placed: Partial<Record<string, string>> | null | undefined): Decor {
  const d = { ...START_DECOR };
  for (const s of SLOTS) {
    const id = placed?.[s.id];
    if (id && itemById(s.id, id)) d[s.id] = id;
  }
  return d;
}

/* ---------------- stitches ---------------- */

/** How you earn them. */
export const REWARDS = {
  /** each of you, the first time you open Soultied each day */
  visit: 10,
  /** you were both here the same day */
  together: 10,
  /** you opened that day's letter together */
  letter: 10,
};
/** Your first look at the catalogue: something to spend straight away, more if you've been showing up already. */
export const WELCOME = 60;
export const WELCOME_PER_DAY = 10;
export const WELCOME_MAX = 300;

export interface Purchase {
  by: string;
  at: number;
  price: number;
}

/** The place's `meta/decor` document. */
export interface DecorDoc {
  /** stitches earned, once each: "2026-10-06|visit|<uid>", "2026-10-06|together", "2026-10-06|letter", "welcome" */
  earned: Record<string, number>;
  /** what you own (the free pieces are always yours) */
  bought: Record<string, Purchase>;
  /** what's out in the room */
  placed: Partial<Record<SlotId, string>>;
}

export const emptyDecorDoc = (): DecorDoc => ({ earned: {}, bought: {}, placed: {} });

export function normalizeDecorDoc(raw: unknown): DecorDoc {
  const x = (raw && typeof raw === 'object' ? raw : {}) as Partial<DecorDoc>;
  const num = (o: unknown) =>
    Object.fromEntries(Object.entries(o && typeof o === 'object' ? (o as Record<string, unknown>) : {}).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
  return {
    earned: num(x.earned),
    bought: x.bought && typeof x.bought === 'object' ? (x.bought as Record<string, Purchase>) : {},
    placed: x.placed && typeof x.placed === 'object' ? (x.placed as DecorDoc['placed']) : {},
  };
}

export const boughtKey = (i: Pick<DecorItem, 'slot' | 'id'>) => `${i.slot}:${i.id}`;
export const owns = (doc: DecorDoc, i: DecorItem) => i.price === 0 || !!doc.bought[boughtKey(i)];

export function balance(doc: DecorDoc) {
  const earned = Object.values(doc.earned).reduce((n, v) => n + v, 0);
  const spent = Object.values(doc.bought).reduce((n, p) => n + (p?.price || 0), 0);
  return earned - spent;
}

export const earnKey = {
  visit: (day: string, uid: string) => `${day}|visit|${uid}`,
  together: (day: string) => `${day}|together`,
  letter: (day: string) => `${day}|letter`,
  welcome: 'welcome',
};

export const welcomeGift = (daysTogether: number) => Math.min(WELCOME_MAX, WELCOME + WELCOME_PER_DAY * daysTogether);
