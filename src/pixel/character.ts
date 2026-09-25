import { PixelBuffer, Palette, mix } from './buffer';
import type { AvatarConfig } from '../types';

/* ------------------------------------------------------------------------ */
/*  Colour options                                                            */
/* ------------------------------------------------------------------------ */

export interface Swatch {
  id: string;
  name: string;
  base: string;
  light: string;
  shadow: string;
}

export const SKIN_TONES: Array<Swatch & { blush: string }> = [
  { id: 'porcelain', name: 'Porcelain', base: '#f6dcc8', light: '#fbe9dc', shadow: '#dcb49c', blush: '#eaa39a' },
  { id: 'peach', name: 'Peach', base: '#eec1a0', light: '#f6d4ba', shadow: '#d19c7a', blush: '#d9837a' },
  { id: 'wheat', name: 'Wheat', base: '#dca77c', light: '#e8bc95', shadow: '#bb865e', blush: '#c86f5f' },
  { id: 'caramel', name: 'Caramel', base: '#c18559', light: '#d19a6d', shadow: '#9e6641', blush: '#b05a4a' },
  { id: 'chestnut', name: 'Chestnut', base: '#8f5a3a', light: '#a46c48', shadow: '#704329', blush: '#8e4436' },
  { id: 'espresso', name: 'Espresso', base: '#5e3a28', light: '#724833', shadow: '#472a1c', blush: '#6e3328' },
];

export const HAIR_COLORS: Swatch[] = [
  { id: 'black', name: 'Soft black', base: '#2c2527', light: '#463b3c', shadow: '#1c1718' },
  { id: 'cocoa', name: 'Cocoa', base: '#4a3129', light: '#664439', shadow: '#33211c' },
  { id: 'chestnut', name: 'Chestnut', base: '#6e4131', light: '#8c5641', shadow: '#502e22' },
  { id: 'auburn', name: 'Auburn', base: '#96482e', light: '#b65f3d', shadow: '#6e3220' },
  { id: 'honey', name: 'Honey', base: '#c9974f', light: '#e0b468', shadow: '#a0733a' },
  { id: 'ash', name: 'Silver', base: '#a9a6a4', light: '#c8c5c1', shadow: '#817d7b' },
  { id: 'lilac', name: 'Dusty lilac', base: '#8f7d98', light: '#a996b2', shadow: '#6d5d76' },
];

export const CLOTH_COLORS: Swatch[] = [
  { id: 'terracotta', name: 'Terracotta', base: '#b8674f', light: '#cf7f64', shadow: '#8f4b3a' },
  { id: 'sage', name: 'Sage', base: '#8a9a72', light: '#a2b187', shadow: '#6a7856' },
  { id: 'cream', name: 'Cream', base: '#eadcc0', light: '#f6ecd8', shadow: '#c9b894' },
  { id: 'mustard', name: 'Mustard', base: '#d09a3e', light: '#e2b359', shadow: '#a7772b' },
  { id: 'denim', name: 'Denim', base: '#4f6583', light: '#667d9b', shadow: '#3a4c65' },
  { id: 'forest', name: 'Forest', base: '#4d6b52', light: '#628566', shadow: '#38503c' },
  { id: 'plum', name: 'Plum', base: '#7a5068', light: '#936580', shadow: '#5b3a4e' },
  { id: 'rose', name: 'Dusty rose', base: '#c98f86', light: '#dba69d', shadow: '#a7706a' },
  { id: 'charcoal', name: 'Charcoal', base: '#4a4548', light: '#605a5d', shadow: '#343033' },
  { id: 'cocoa', name: 'Cocoa', base: '#6b4a3c', light: '#825c4b', shadow: '#4f352b' },
];

/* ------------------------------------------------------------------------ */
/*  Style catalogues (ids are what gets saved)                               */
/* ------------------------------------------------------------------------ */

export const HAIR_STYLES = [
  { id: 'tousled', name: 'Tousled' },
  { id: 'crop', name: 'Side part' },
  { id: 'curls', name: 'Curls' },
  { id: 'bob', name: 'Bob' },
  { id: 'long', name: 'Long waves' },
  { id: 'bun', name: 'Top bun' },
  { id: 'braid', name: 'Side braid' },
  { id: 'hijab', name: 'Hijab' },
  { id: 'buzz', name: 'Buzz' },
  { id: 'bald', name: 'Bald' },
] as const;

export const FACIAL_HAIR = [
  { id: 'none', name: 'None' },
  { id: 'stubble', name: 'Stubble' },
  { id: 'mustache', name: 'Mustache' },
  { id: 'beard', name: 'Beard' },
] as const;

export const TOPS = [
  { id: 'sweater', name: 'Sweater' },
  { id: 'cardigan', name: 'Cardigan' },
  { id: 'hoodie', name: 'Hoodie' },
  { id: 'shirt', name: 'Shirt' },
  { id: 'turtleneck', name: 'Turtleneck' },
  { id: 'tee', name: 'Tee' },
  { id: 'kurta', name: 'Kurta' },
] as const;

export const BOTTOMS = [
  { id: 'trousers', name: 'Trousers' },
  { id: 'jeans', name: 'Jeans' },
  { id: 'joggers', name: 'Joggers' },
  { id: 'pajamas', name: 'Pyjamas' },
  { id: 'skirt', name: 'Skirt' },
  { id: 'shorts', name: 'Shorts' },
] as const;

export const SHOES = [
  { id: 'socks', name: 'Cosy socks' },
  { id: 'slippers', name: 'Slippers' },
  { id: 'sneakers', name: 'Sneakers' },
  { id: 'boots', name: 'Boots' },
] as const;

export const GLASSES = [
  { id: 'none', name: 'None' },
  { id: 'round', name: 'Round' },
  { id: 'square', name: 'Square' },
  { id: 'gold', name: 'Gold wire' },
] as const;

export const HATS = [
  { id: 'none', name: 'None' },
  { id: 'beanie', name: 'Beanie' },
  { id: 'cap', name: 'Cap' },
  { id: 'clip', name: 'Hair clip' },
] as const;

export const EXTRAS = [
  { id: 'none', name: 'None' },
  { id: 'scarf', name: 'Red thread scarf' },
  { id: 'headphones', name: 'Headphones' },
  { id: 'hoops', name: 'Gold hoops' },
  { id: 'blanket', name: 'Blanket (sitting)' },
] as const;

export const DEFAULT_AVATAR_A: AvatarConfig = {
  rendererVersion: 2,
  height: 'medium',
  skin: 'wheat',
  hairStyle: 'long',
  hairColor: 'cocoa',
  facialHair: 'none',
  top: 'sweater',
  topColor: 'sage',
  bottom: 'trousers',
  bottomColor: 'cream',
  shoes: 'socks',
  shoesColor: 'terracotta',
  glasses: 'none',
  hat: 'none',
  extra: 'hoops',
};

export const DEFAULT_AVATAR_B: AvatarConfig = {
  rendererVersion: 2,
  height: 'tall',
  skin: 'caramel',
  hairStyle: 'tousled',
  hairColor: 'black',
  facialHair: 'none',
  top: 'cardigan',
  topColor: 'terracotta',
  bottom: 'jeans',
  bottomColor: 'denim',
  shoes: 'socks',
  shoesColor: 'cream',
  glasses: 'round',
  hat: 'none',
  extra: 'none',
};

/** Accept anything that was ever saved and return a valid v2 config. */
export function normalizeAvatar(raw: unknown, fallback: AvatarConfig = DEFAULT_AVATAR_A): AvatarConfig {
  if (!raw || typeof raw !== 'object') return { ...fallback };
  const r = raw as Record<string, unknown>;
  if (r.rendererVersion !== 2) return { ...fallback };
  const pick = <T extends { id: string }>(list: readonly T[], v: unknown, d: string) =>
    typeof v === 'string' && list.some((x) => x.id === v) ? v : d;
  return {
    rendererVersion: 2,
    height: r.height === 'short' || r.height === 'tall' ? r.height : 'medium',
    skin: pick(SKIN_TONES, r.skin, fallback.skin),
    hairStyle: pick(HAIR_STYLES, r.hairStyle, fallback.hairStyle),
    hairColor:
      r.hairStyle === 'hijab'
        ? pick(CLOTH_COLORS, r.hairColor, 'sage')
        : pick(HAIR_COLORS, r.hairColor, fallback.hairColor),
    facialHair: pick(FACIAL_HAIR, r.facialHair, 'none'),
    top: pick(TOPS, r.top, fallback.top),
    topColor: pick(CLOTH_COLORS, r.topColor, fallback.topColor),
    bottom: pick(BOTTOMS, r.bottom, fallback.bottom),
    bottomColor: pick(CLOTH_COLORS, r.bottomColor, fallback.bottomColor),
    shoes: pick(SHOES, r.shoes, fallback.shoes),
    shoesColor: pick(CLOTH_COLORS, r.shoesColor, fallback.shoesColor),
    glasses: pick(GLASSES, r.glasses, 'none'),
    hat: pick(HATS, r.hat, 'none'),
    extra: pick(EXTRAS, r.extra, 'none'),
  };
}

export function randomAvatar(): AvatarConfig {
  const any = <T extends { id: string }>(l: readonly T[]) => l[Math.floor(Math.random() * l.length)].id;
  const hairStyle = any(HAIR_STYLES);
  return {
    rendererVersion: 2,
    height: (['short', 'medium', 'tall'] as const)[Math.floor(Math.random() * 3)],
    skin: any(SKIN_TONES),
    hairStyle,
    hairColor: hairStyle === 'hijab' ? any(CLOTH_COLORS) : any(HAIR_COLORS.slice(0, 6)),
    facialHair: Math.random() < 0.3 ? any(FACIAL_HAIR) : 'none',
    top: any(TOPS),
    topColor: any(CLOTH_COLORS),
    bottom: any(BOTTOMS),
    bottomColor: any(CLOTH_COLORS),
    shoes: any(SHOES),
    shoesColor: any(CLOTH_COLORS),
    glasses: Math.random() < 0.35 ? any(GLASSES.slice(1)) : 'none',
    hat: Math.random() < 0.2 && hairStyle !== 'hijab' ? any(HATS.slice(1)) : 'none',
    extra: Math.random() < 0.4 ? any(EXTRAS.slice(1, 4)) : 'none',
  };
}

/* ------------------------------------------------------------------------ */
/*  Sprite parts. Coordinates are relative to the 24 x 48 character canvas. */
/*  Head occupies x 6..17. Keys:                                             */
/*    s skin  l skin light  d skin shadow  b blush  e eye  m mouth           */
/*    h hair  H hair light  j hair shadow                                    */
/*    c cloth C cloth light k cloth shadow  i inner/trim  I inner shadow     */
/* ------------------------------------------------------------------------ */

const HEAD = [
  '..ssssssss..',
  '.ssssssssss.',
  'slsssssssssd',
  'slsssssssssd',
  'ssssssssssss',
  'sssesssseddd',
  'sssesssseddd',
  'ssbssssssbsd',
  'sssssmmssssd',
  '.dssssssssd.',
  '..dddddddd..',
];
// eyes/blush get patched in code so skin shading doesn't eat them
const EYE_L = 3;
const EYE_R = 8;

/** Front hair (14 wide, starts 1px left of head, `top` rows above head). */
const HAIR_FRONT: Record<string, { top: number; rows: string[] }> = {
  tousled: {
    top: 3,
    rows: [
      '....hhh.hh....',
      '..hhHHhhHhhh..',
      '.hhHHhhhhHhhh.',
      '.hHHhhhhhhhhhh',
      'hhHhhhhhhhhhhh',
      'hhhhjhhhhjhhhh',
      'hhj..jhhj..jhh',
      'hh.........jhh',
      'hj...........h',
    ],
  },
  crop: {
    top: 2,
    rows: [
      '...hhhhhhhh...',
      '..hHHHHhhhhh..',
      '.hHHhhhhhhhhh.',
      'hhHhhhhhhhhhhh',
      'hhhhhhhhjjjhhh',
      'hhhhhjj....jhh',
      'hj.........jhh',
      'h............h',
    ],
  },
  curls: {
    top: 4,
    rows: [
      '...hH.hHh.Hh..',
      '..hHhhHhhhhHh.',
      '.hHhhjhHhhjhhh',
      'hHhjhhhhhjhhhH',
      'hhhhhHhhhhHhjh',
      'hjhHhhjhHhhhhh',
      'hhhhjhhhhjhhjh',
      'hhj.hh.jh.hhhh',
      'hh..........hh',
      'hj..........jh',
      'h............h',
    ],
  },
  bob: {
    top: 2,
    rows: [
      '...hhhhhhhh...',
      '..hHHHhhhhhh..',
      '.hHHhhhhhhhhh.',
      'hHHhhhhhhhhhhh',
      'hHhhhhhhhhhhhh',
      'hhhjjjjjjjjhhh',
      'hhh........hhh',
      'hhh........hhh',
      'hhh........hhh',
      'hhj........jhh',
      'hhj........jhh',
      'hj..........jh',
    ],
  },
  long: {
    top: 2,
    rows: [
      '...hhhhhhhh...',
      '..hHHHhhhhhh..',
      '.hHHhhhhhjhhh.',
      'hHHhhhhhjhhhhh',
      'hHhhhhhjhhhhhh',
      'hhhhhhj..jhhhh',
      'hhhhj......hhh',
      'hhh........hhh',
      'hhh........jhh',
      'hhj........jhh',
      'hhj........jhh',
      'hj..........jh',
    ],
  },
  bun: {
    top: 7,
    rows: [
      '.....hhhh.....',
      '....hHHhhh....',
      '....hHhhhh....',
      '.....hhhj.....',
      '...hhhjjhhh...',
      '..hHHhhhhhhh..',
      '.hHHhhhhhhhhh.',
      'hHHhhhhhhhhhhh',
      'hHhhhhhhhhhhhh',
      'hhhhjj..jjhhhh',
      'hhj........jhh',
      'hj..........jh',
    ],
  },
  braid: {
    top: 2,
    rows: [
      '...hhhhhhhh...',
      '..hHHHhhhhhh..',
      '.hHHhhhhhhhhh.',
      'hHHhhhhhhhhhhh',
      'hHhhhhhhhhhhhh',
      'hhhjjjj..jjhhh',
      'hhj........hhh',
      'hh.........hhh',
      'h..........jhh',
      '...........hhj',
      '...........jhh',
      '...........hhj',
    ],
  },
  hijab: {
    top: 3,
    rows: [
      '....hhhhhh....',
      '..hhHHHhhhhh..',
      '.hHHhhhhhhhhh.',
      'hHhhhhhhhhhhhj',
      'hHhhhhhhhhhhhj',
      'hHhjjjjjjjjhhj',
      'hHj........jhj',
      'hHj........jhj',
      'hhj........jhj',
      'hhj........jhj',
      'hhhj......jhhj',
      'hHhhj....jhhhj',
      'hHhhhhhhhhhhhj',
      'jhhhhhHHhhhhjj',
    ],
  },
  buzz: {
    top: 1,
    rows: [
      '..jjjjjjjjjj..',
      '.jhjhjhjhjhjj.',
      '.jjhjhjhjhjhj.',
      '.j..........j.',
    ],
  },
  bald: { top: 0, rows: [] },
};

/** Back hair drawn behind head + body (14 wide, same origin as front). */
const HAIR_BACK: Record<string, { from: number; rows: string[] }> = {
  long: {
    from: 9, // starts at this row of the front-hair grid
    rows: [
      'jhh........hhj',
      'jhh........hhj',
      'jhhh......hhhj',
      'jhhh......hhhj',
      'jhhh......hhhj',
      'jhhj......jhhj',
      '.hhj......jhh.',
      '.jh........hj.',
      '..j........j..',
    ],
  },
  bob: {
    from: 10,
    rows: ['jhh........hhj', 'jhhj......jhhj', '.jj........jj.'],
  },
  hijab: {
    from: 12,
    rows: [
      'jhhhhhhhhhhhhj',
      'jhhhhhhhhhhhhj',
      'jhhhhhhhhhhhhj',
      '.jhhhhhhhhhhj.',
      '..jjhhhhhhjj..',
    ],
  },
  braid: {
    from: 11,
    rows: ['...........hhj', '...........jhh', '...........hhj', '...........jhh', '...........hjj', '...........Hh.'],
  },
  curls: {
    from: 10,
    rows: ['hj..........jh', 'hh..........hh', '.j..........j.'],
  },
};

/** Torso, 12 wide at x 6. Row 0 is the neck. */
const TOPS_ART: Record<string, string[]> = {
  sweater: [
    '.....dd.....',
    '...kkkkkk...',
    '.ccccCCcccc.',
    'cCcccccccckc',
    'cCkcccccckkc',
    'cCkcccccckkc',
    'cCkcccccckkc',
    'cCkcccccckkc',
    'kkkkkkkkkkkk',
  ],
  cardigan: [
    '.....dd.....',
    '...ciiiic...',
    '.cccciiiccc.',
    'cCcckiiikckc',
    'cCckciiickkc',
    'cCckcIiickkc',
    'cCckciiickkc',
    'cCckciiickkc',
    'kkkkkiiikkkk',
  ],
  hoodie: [
    '..kccddcck..',
    '.kcCkkkkCck.',
    '.ccciccicccc',
    'cCccicciccKc',
    'cCkcccccckkc',
    'cCkkkkkkkkkc',
    'cCkcccccckkc',
    'cCkcccccckkc',
    'kkkkkkkkkkkk',
  ],
  shirt: [
    '.....dd.....',
    '...cckkcc...',
    '.ccCckkcCcc.',
    'cCcccikcccKc',
    'cCkccikcckkc',
    'cCkccikcckkc',
    'cCkccikcckkc',
    'cCkccikcckkc',
    'kkkkkikkkkkk',
  ],
  turtleneck: [
    '....kCCk....',
    '....kkkk....',
    '.ccccCCcccc.',
    'cCcccccccckc',
    'cCkcccccckkc',
    'cCkcccccckkc',
    'cCkcccccckkc',
    'cCkcccccckkc',
    'kCkccccccckk',
  ],
  tee: [
    '.....dd.....',
    '...kkddkk...',
    '.cccckkcccc.',
    'cCcccccccckc',
    'sscccccccccd',
    'slkcccccckdd',
    'slkcccccckdd',
    'slkcccccckdd',
    'sdkkkkkkkkdd',
  ],
  kurta: [
    '.....dd.....',
    '...ckkkkc...',
    '.cccCkiccccc',
    'cCcccikccckc',
    'cCkccikcckkc',
    'cCkccikcckkc',
    'cCkcccccckkc',
    'cCkcccccckkc',
    'cCkcccccckkc',
  ],
};

/** Glasses over head (12 wide at x 6, rows relative to head top). */
const GLASSES_ART: Record<string, { rows: string[]; y: number }> = {
  round: { y: 4, rows: ['..ggg..ggg..', '.gw..fgw...g', '.g...f.....g', '..fff..fff..'] },
  square: { y: 4, rows: ['.gggggggggg.', '.gw..ggw..g.', '.f...f.f..f.', '.fffff.ffff.'] },
  gold: { y: 4, rows: ['..GGG..GGG..', '.Gw..GGw..G.', '.G...G.G..G.', '..GGG..GGG..'] },
};

const HAT_ART: Record<string, { rows: string[]; top: number }> = {
  beanie: {
    top: 5,
    rows: [
      '.....tTt......',
      '....tttttt....',
      '..tTTtttttt...',
      '.tTTttttttttt.',
      'tTtttttttttttt',
      'rRrRrRrRrRrRrR',
      'rrrrrrrrrrrrrr',
    ],
  },
  cap: {
    top: 3,
    rows: [
      '....tTTttt....',
      '..tTTtttttttt.',
      '.tTttttttttttt',
      'tTttttttttttttr',
      'rrrrrrrrrrrrrrrrr',
    ],
  },
  clip: { top: 0, rows: ['..........yY..', '..........Yy..'] },
};

/* ------------------------------------------------------------------------ */

export type Pose = 'stand' | 'sit';

export interface CharacterFrame {
  blink?: boolean;
  bob?: number; // 0 or 1 px breathing offset (upper body)
  sleepy?: boolean; // eyes closed
}

export const CHAR_W = 24;
export const CHAR_H = 48;

const find = <T extends { id: string }>(l: readonly T[], id: string) => l.find((x) => x.id === id) || l[0];

/**
 * Render a character into a fresh 24x48 buffer. The returned `anchor` tells
 * you where the character's feet (stand) or seat (sit) are, so callers can
 * position by that point instead of the box.
 */
export function renderCharacter(cfg: AvatarConfig, pose: Pose, frame: CharacterFrame = {}) {
  const buf = new PixelBuffer(CHAR_W, CHAR_H);
  const skin = find(SKIN_TONES, cfg.skin);
  const hair =
    cfg.hairStyle === 'hijab'
      ? CLOTH_COLORS.find((c) => c.id === cfg.hairColor) || CLOTH_COLORS[1]
      : find(HAIR_COLORS, cfg.hairColor);
  const top = find(CLOTH_COLORS, cfg.topColor);
  const bot = find(CLOTH_COLORS, cfg.bottomColor);
  const shoe = find(CLOTH_COLORS, cfg.shoesColor);

  const legLen = pose === 'sit' ? 6 : cfg.height === 'short' ? 9 : cfg.height === 'tall' ? 13 : 11;
  const bob = frame.bob || 0;

  // Vertical layout, bottom-up so feet/seat stay fixed.
  const feetY = CHAR_H - 2; // last shoe row
  const shoeTop = feetY - 1;
  const legTop = shoeTop - legLen; // where pants start (stand) / shin start (sit)
  const lapTop = pose === 'sit' ? legTop - 3 : legTop;
  const torsoTop = (pose === 'sit' ? lapTop - 8 : legTop - 8) + bob; // 9-row torso, hem overlaps waist
  const headTop = torsoTop - 10;

  const skinPal: Palette = { s: skin.base, l: skin.light, d: skin.shadow, b: skin.blush, e: '#2a1e22', m: mix(skin.shadow, '#6a3030', 0.45) };
  const hairPal: Palette = { h: hair.base, H: hair.light, j: hair.shadow };
  const clothPal = (sw: Swatch, inner = '#efe3cb', innerShadow = '#d3c3a3'): Palette => ({
    c: sw.base,
    C: sw.light,
    k: sw.shadow,
    K: sw.shadow,
    i: inner,
    I: innerShadow,
    s: skin.base,
    l: skin.light,
    d: skin.shadow,
  });

  const hf = HAIR_FRONT[cfg.hairStyle] || HAIR_FRONT.bald;
  const hairX = 5;
  const hairY = headTop - hf.top;

  // 1. back hair
  const hb = HAIR_BACK[cfg.hairStyle];
  if (hb) buf.sprite(hb.rows, hairPal, hairX, hairY + hb.from);

  // 2. legs / bottoms
  drawBottoms(buf, cfg, pose, { lapTop, legTop, legLen, shoeTop }, bot, skin);

  // 3. shoes
  drawShoes(buf, cfg.shoes, shoe, skin, shoeTop);

  // 4. torso
  const tArt = TOPS_ART[cfg.top] || TOPS_ART.sweater;
  const tPal = clothPal(top, cfg.top === 'cardigan' ? '#efe3cb' : top.light, '#d3c3a3');
  if (cfg.top === 'hoodie') {
    tPal.i = '#efe3cb';
  }
  buf.sprite(tArt, tPal, 6, torsoTop);
  if (cfg.top === 'kurta') {
    // long hem over the thighs
    const hemRows = pose === 'sit' ? 3 : 5;
    for (let r = 0; r < hemRows; r++) {
      const y = torsoTop + 9 + r;
      const w = pose === 'sit' ? 12 : 10 + Math.min(r, 2);
      const x0 = 12 - Math.floor(w / 2);
      buf.rect(x0, y, w, 1, r === hemRows - 1 ? top.shadow : top.base);
      buf.set(x0, y, top.shadow);
      if (r < hemRows - 1) buf.set(x0 + w - 1, y, top.shadow);
    }
  }

  // 5. hands
  const handY = torsoTop + 8;
  if (pose === 'stand') {
    buf.rect(6, handY + 1, 2, 2, skin.base);
    buf.set(6, handY + 2, skin.shadow);
    buf.rect(16, handY + 1, 2, 2, skin.base);
    buf.set(17, handY + 2, skin.shadow);
  } else {
    // resting on the lap
    buf.rect(7, lapTop, 3, 2, skin.base);
    buf.set(7, lapTop + 1, skin.shadow);
    buf.rect(14, lapTop, 3, 2, skin.base);
    buf.set(16, lapTop + 1, skin.shadow);
  }

  // 6. head
  buf.sprite(HEAD, skinPal, 6, headTop);
  // eyes (patched so shading never hides them)
  const eyeY = headTop + 5;
  if (frame.blink || frame.sleepy) {
    for (const ex of [EYE_L, EYE_R]) {
      buf.set(6 + ex, eyeY, ex === EYE_R ? skin.shadow : skin.base);
      buf.set(6 + ex, eyeY + 1, '#2a1e22');
    }
  } else {
    for (const ex of [EYE_L, EYE_R]) {
      buf.set(6 + ex, eyeY, '#2a1e22');
      buf.set(6 + ex, eyeY + 1, '#2a1e22');
    }
  }
  buf.set(6 + 2, headTop + 7, skin.blush);
  buf.set(6 + 9, headTop + 7, skin.blush);

  // facial hair
  drawFacialHair(buf, cfg.facialHair, hair, skin, headTop);

  // 7. front hair
  if (hf.rows.length) buf.sprite(hf.rows, hairPal, hairX, hairY);

  // 8. glasses
  const gl = GLASSES_ART[cfg.glasses];
  if (gl) {
    // keep eyes visible through the lenses
    buf.sprite(gl.rows, { g: '#3a2a26', f: mix('#3a2a26', skin.shadow, 0.55), G: '#c9a24e', w: '#fbf3e4' }, 6, headTop + gl.y);
    buf.set(6 + EYE_L, eyeY, frame.blink || frame.sleepy ? skin.base : '#2a1e22');
    buf.set(6 + EYE_R, eyeY, frame.blink || frame.sleepy ? skin.base : '#2a1e22');
  }

  // 9. hats
  const hat = HAT_ART[cfg.hat];
  if (hat) {
    const hatSw = cfg.hat === 'cap' ? top : CLOTH_COLORS.find((c) => c.id === (cfg.topColor === 'mustard' ? 'terracotta' : 'mustard'))!;
    buf.sprite(
      hat.rows,
      { t: hatSw.base, T: hatSw.light, r: hatSw.shadow, R: hatSw.base, y: '#d9a441', Y: '#f0c860' },
      cfg.hat === 'clip' ? 5 : cfg.hat === 'cap' ? 4 : 5,
      cfg.hat === 'clip' ? headTop + 1 : headTop - hat.top
    );
  }

  // 10. extras
  if (cfg.extra === 'scarf') {
    const r = '#a84f4b';
    const R = '#c4625b';
    const k = '#7f3835';
    buf.rect(8, torsoTop + 1, 8, 2, r);
    buf.hline(8, torsoTop + 1, 8, R);
    buf.rect(13, torsoTop + 3, 2, pose === 'sit' ? 4 : 6, r);
    buf.vline(14, torsoTop + 3, pose === 'sit' ? 4 : 6, k);
    buf.hline(13, torsoTop + (pose === 'sit' ? 7 : 9), 2, k);
  } else if (cfg.extra === 'headphones') {
    const k = '#3b3437';
    const K = '#5a5155';
    buf.rect(7, torsoTop + 1, 10, 1, k);
    buf.rect(6, torsoTop, 2, 3, K);
    buf.rect(16, torsoTop, 2, 3, K);
    buf.set(6, torsoTop + 2, k);
    buf.set(17, torsoTop + 2, k);
  } else if (cfg.extra === 'hoops' && cfg.hairStyle !== 'hijab') {
    buf.set(5, headTop + 7, '#e2b555');
    buf.set(5, headTop + 8, '#b88a30');
    buf.set(18, headTop + 7, '#e2b555');
    buf.set(18, headTop + 8, '#b88a30');
  }

  buf.outline(0.38);

  // blanket goes over the outline so it reads as a separate object
  if (cfg.extra === 'blanket' && pose === 'sit') {
    const a = '#d9a441';
    const b = '#efdcb8';
    for (let y = lapTop - 1; y < lapTop + 6; y++) {
      for (let x = 4; x < 20; x++) {
        const edge = x === 4 || x === 19 || y === lapTop + 5;
        const check = ((x >> 1) + (y >> 1)) % 2 === 0;
        buf.set(x, y, edge ? '#8f6424' : check ? a : b);
      }
    }
  }

  return {
    buf,
    /** x,y in the 24x48 buffer: centre-bottom of feet (stand) or seat (sit). */
    anchor: pose === 'sit' ? { x: 12, y: lapTop + 1 } : { x: 12, y: feetY },
    headTop,
  };
}

function drawBottoms(
  buf: PixelBuffer,
  cfg: AvatarConfig,
  pose: Pose,
  g: { lapTop: number; legTop: number; legLen: number; shoeTop: number },
  sw: Swatch,
  skin: Swatch
) {
  const style = cfg.bottom;
  const base = sw.base;
  const light = sw.light;
  const shadow = sw.shadow;
  const denimSeam = mix(sw.light, '#e8d6a8', 0.4);

  const legPixel = (x: number, y: number, isLeft: boolean, row: number) => {
    let c = base;
    if (isLeft ? x === 8 : x === 13) c = light;
    if (isLeft ? x === 10 : x === 15) c = shadow;
    if (style === 'pajamas' && (x + row) % 3 === 0 && row % 2 === 0) c = mix(base, '#f3e7cf', 0.55);
    return c;
  };

  if (pose === 'stand') {
    // hips
    for (let r = 0; r < 2; r++) {
      for (let x = 8; x <= 15; x++) buf.set(x, g.legTop + r, x === 8 ? light : x === 15 ? shadow : base);
    }
    if (style === 'jeans') { buf.set(9, g.legTop, denimSeam); buf.set(14, g.legTop, denimSeam); }
    if (style === 'skirt') {
      const len = Math.min(g.legLen, 8);
      for (let r = 0; r < len; r++) {
        const spread = Math.floor(r / 2.5);
        const x0 = 8 - spread;
        const x1 = 15 + spread;
        for (let x = x0; x <= x1; x++) {
          let c = base;
          if (x === x0) c = light;
          if (x === x1) c = shadow;
          if (r > 2 && (x - x0) % 3 === 2) c = shadow;
          buf.set(x, g.legTop + r, r === len - 1 ? shadow : c);
        }
      }
      for (let r = len; r < g.legLen; r++) {
        buf.rect(9, g.legTop + r, 2, 1, skin.base);
        buf.rect(13, g.legTop + r, 2, 1, skin.base);
        buf.set(10, g.legTop + r, skin.shadow);
      }
      return;
    }
    const pantsRows = style === 'shorts' ? 5 : g.legLen;
    for (let r = 2; r < g.legLen; r++) {
      const y = g.legTop + r;
      if (r < pantsRows) {
        for (let x = 8; x <= 10; x++) buf.set(x, y, legPixel(x, y, true, r));
        for (let x = 13; x <= 15; x++) buf.set(x, y, legPixel(x, y, false, r));
        if (style === 'joggers' && r === g.legLen - 1) {
          buf.hline(8, y, 3, shadow);
          buf.hline(13, y, 3, shadow);
        }
      } else {
        buf.rect(9, y, 2, 1, skin.base);
        buf.set(10, y, skin.shadow);
        buf.rect(13, y, 2, 1, skin.base);
      }
    }
    if (pantsRows > 2) {
      // gap between legs, top of it is a crotch shadow
      buf.set(11, g.legTop + 2, shadow);
      buf.set(12, g.legTop + 2, shadow);
    }
  } else {
    // sitting: lap block (thighs toward viewer) then hanging shins
    const lapW = 12;
    for (let r = 0; r < 3; r++) {
      for (let x = 6; x < 6 + lapW; x++) {
        let c = r === 2 ? shadow : base;
        if (r === 0) c = light;
        if (x === 11 || x === 12) c = r === 2 ? shadow : mix(base, shadow, 0.5);
        if (style === 'skirt') c = r === 2 ? shadow : r === 0 ? light : base;
        if (style === 'pajamas' && (x + r) % 3 === 0) c = mix(base, '#f3e7cf', 0.55);
        buf.set(x, g.lapTop + r, c);
      }
    }
    const coverRows = style === 'skirt' ? 2 : style === 'shorts' ? 0 : g.legLen;
    for (let r = 0; r < g.legLen; r++) {
      const y = g.legTop + r;
      if (r < coverRows) {
        if (style === 'skirt') {
          buf.rect(6, y, 12, 1, r === coverRows - 1 ? shadow : base);
          continue;
        }
        for (let x = 8; x <= 10; x++) buf.set(x, y, legPixel(x, y, true, r));
        for (let x = 13; x <= 15; x++) buf.set(x, y, legPixel(x, y, false, r));
        if (style === 'joggers' && r === g.legLen - 1) {
          buf.hline(8, y, 3, shadow);
          buf.hline(13, y, 3, shadow);
        }
      } else {
        buf.rect(9, y, 2, 1, skin.base);
        buf.set(10, y, skin.shadow);
        buf.rect(13, y, 2, 1, skin.base);
        buf.set(14, y, skin.shadow);
      }
    }
  }
}

function drawShoes(buf: PixelBuffer, style: string, sw: Swatch, skin: Swatch, y: number) {
  if (style === 'socks') {
    for (const x0 of [8, 13]) {
      buf.rect(x0, y - 1, 3, 1, sw.light);
      buf.rect(x0, y, 3, 2, sw.base);
      buf.set(x0 + (x0 === 8 ? -1 : 3), y + 1, sw.base);
      buf.hline(x0, y + 1, 3, sw.shadow);
    }
    return;
  }
  if (style === 'slippers') {
    for (const x0 of [7, 13]) {
      buf.rect(x0, y, 4, 2, sw.base);
      buf.hline(x0, y, 4, '#f4ead6');
      buf.set(x0 + 1, y, '#fbf5e9');
      buf.hline(x0, y + 1, 4, sw.shadow);
    }
    return;
  }
  if (style === 'boots') {
    for (const x0 of [7, 13]) {
      buf.rect(x0 + 1, y - 2, 3, 2, '#6a4430');
      buf.rect(x0, y, 4, 1, '#7d5238');
      buf.hline(x0, y + 1, 4, '#3a261c');
      buf.set(x0 + 1, y - 2, '#8a5d40');
    }
    return;
  }
  // sneakers
  for (const x0 of [7, 13]) {
    buf.rect(x0, y, 4, 1, '#f1e8d8');
    buf.set(x0 === 7 ? x0 + 2 : x0 + 1, y, sw.base);
    buf.hline(x0, y + 1, 4, '#a39888');
  }
  void skin;
}

function drawFacialHair(buf: PixelBuffer, style: string, hair: Swatch, skin: Swatch, headTop: number) {
  const X = 6;
  if (style === 'stubble') {
    const c = mix(skin.shadow, hair.base, 0.18);
    for (const [x, y] of [
      [2, 9], [4, 10], [7, 10], [9, 9], [5, 10], [6, 10], [3, 9], [8, 9],
    ]) buf.set(X + x, headTop + y, c);
  } else if (style === 'mustache') {
    buf.rect(X + 4, headTop + 7, 4, 1, hair.base);
    buf.set(X + 3, headTop + 8, hair.shadow);
    buf.set(X + 8, headTop + 8, hair.shadow);
  } else if (style === 'beard') {
    for (let y = 7; y <= 11; y++) {
      for (let x = 0; x < 12; x++) {
        const inFace = y === 7 ? x <= 1 || x >= 10 : y === 8 ? x <= 3 || x >= 8 : y === 11 ? x >= 3 && x <= 8 : true;
        if (!inFace) continue;
        if (y === 9 && x >= 5 && x <= 6) continue; // mouth
        if (y === 10 && (x === 0 || x === 11)) continue;
        if (y === 9 && (x === 0 || x === 11)) continue;
        buf.set(X + x, headTop + y, (x + y) % 4 === 0 ? hair.light : hair.base);
      }
    }
    buf.rect(X + 4, headTop + 7, 4, 1, hair.base);
    buf.rect(X + 5, headTop + 9, 2, 1, mix(skin.shadow, '#5a2626', 0.4));
  }
}
