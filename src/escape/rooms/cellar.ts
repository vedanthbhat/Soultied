import { mix } from '../../pixel/buffer';
import { Scene, SW, stoneWall, candle, lightScene, CANDLE, GHOST, WARM } from '../scene';
import { COLORS } from '../glyphs';
import type { RoomDef } from '../types';

export const CELLAR: RoomDef = {
  id: 'cellar',
  title: 'The Haunted Cellar',
  tagline: 'Someone down here needs your help.',
  mood: 'Spooky, but friendly',
  accent: '#6fcfb4',
  minutes: 15,
  intro:
    'The cellar lights died years ago, and the neighbours say someone still hums down there. His name is Edgar: a gentle ghost who can’t remember how to leave. One of you is in the wine cellar, the other in the boiler room next door. Help Edgar finish his last evening so he can finally rest.',
  sides: {
    a: { name: 'The wine cellar', blurb: 'Barrels, candles and a portrait that watches you.' },
    b: { name: 'The boiler room', blurb: 'Pipes, a fuse box and a very old boiler.' },
  },
  objects: [
    // --- side A: the wine cellar ---
    {
      id: 'post',
      side: 'a',
      label: 'Wooden post',
      rect: { x: 100, y: 18, w: 14, h: 75 },
      views: [
        {
          from: 0,
          clue: {
            kind: 'glyphs',
            title: 'Arrows scratched into the post',
            text: 'Under the arrows, someone carved: “for the lights — E.”',
            glyphs: ['up', 'down', 'down', 'up'],
          },
        },
      ],
    },
    {
      id: 'radio',
      side: 'a',
      label: 'Old radio',
      rect: { x: 118, y: 60, w: 32, h: 33 },
      views: [
        { from: 0, puzzle: 'radio', text: 'A valve radio with a dial for three numbers. It needs power first.' },
        { from: 2, text: 'The radio hums softly, tuned to Edgar’s station.' },
      ],
    },
    {
      id: 'barrels',
      side: 'a',
      label: 'Wine barrels',
      rect: { x: 10, y: 62, w: 86, h: 24 },
      views: [
        { from: 0, text: 'Four barrels on a rack. It’s too dark to see much.' },
        {
          from: 1,
          clue: {
            kind: 'glyphs',
            title: 'Symbols painted on the barrel ends',
            text: 'From left to right:',
            glyphs: ['moon', 'key', 'bat', 'crown'],
          },
        },
      ],
    },
    {
      id: 'candles',
      side: 'a',
      label: 'Candle shelf',
      rect: { x: 150, y: 40, w: 46, h: 14 },
      views: [
        { from: 0, text: 'Five unlit candles in five colours. A match box sits beside them.' },
        { from: 3, puzzle: 'candles' },
        { from: 4, text: 'All five candles burn steadily now.' },
      ],
    },
    {
      id: 'portrait',
      side: 'a',
      label: 'Portrait',
      rect: { x: 150, y: 8, w: 30, h: 30 },
      views: [{ from: 0, clue: { kind: 'note', title: 'A brass plaque under the portrait', text: 'EDGAR PINTO\n1901 – 1958\nHe loved the radio, his scarf, and a good goodbye.' } }],
    },
    {
      id: 'ghostA',
      side: 'a',
      label: 'Edgar',
      rect: { x: 60, y: 20, w: 36, h: 44 },
      from: 4,
      views: [{ from: 4, puzzle: 'goodbye' }],
    },
    // --- side B: the boiler room ---
    {
      id: 'fuses',
      side: 'b',
      label: 'Fuse box',
      rect: { x: 10, y: 26, w: 28, h: 34 },
      views: [{ from: 0, puzzle: 'fuses', text: 'The lights are on again.' }],
    },
    {
      id: 'chalk',
      side: 'b',
      label: 'Chalk on the wall',
      rect: { x: 44, y: 16, w: 58, h: 36 },
      views: [
        { from: 0, text: 'Something is scrawled on the wall, but it’s too dark to read.' },
        { from: 1, clue: { kind: 'note', title: 'Chalk on the bricks', text: 'EDGAR’S STATION\n91.7\n(always)', sign: 'in shaky handwriting' } },
      ],
    },
    {
      id: 'boiler',
      side: 'b',
      label: 'Boiler hatch',
      rect: { x: 118, y: 26, w: 74, h: 66 },
      views: [
        { from: 0, puzzle: 'valves', text: 'A big iron boiler. The hatch has four valve wheels with symbols on them.' },
        { from: 3, text: 'The hatch hangs open. It was hiding a moth-eaten scarf.' },
      ],
    },
    {
      id: 'scarf',
      side: 'b',
      label: 'Striped scarf',
      rect: { x: 100, y: 22, w: 14, h: 44 },
      from: 3,
      views: [
        {
          from: 3,
          clue: {
            kind: 'colors',
            title: 'Edgar’s scarf',
            text: 'Hanging from the pipe. The stripes, from top to bottom:',
            colors: ['green', 'white', 'red', 'gold', 'blue'],
            style: 'stripes',
          },
        },
      ],
    },
    {
      id: 'ghostB',
      side: 'b',
      label: 'Edgar',
      rect: { x: 60, y: 44, w: 36, h: 44 },
      from: 4,
      views: [{ from: 4, puzzle: 'goodbye' }],
    },
  ],
  puzzles: [
    {
      id: 'fuses',
      side: 'b',
      title: 'The fuse box',
      prompt: 'Four switches. Each one goes up or down.',
      lock: { kind: 'switches', count: 4 },
      answer: 'UDDU',
      hints: [
        'Something in the wine cellar might say which way the switches go.',
        'There are arrows scratched into the wooden post in the wine cellar.',
        'Up, down, down, up.',
      ],
      solved: 'The bulbs buzz and flicker on. For a second, you both hear someone humming.',
    },
    {
      id: 'radio',
      side: 'a',
      title: 'The old radio',
      prompt: 'Tune the dial: three numbers.',
      lock: { kind: 'digits', length: 3 },
      answer: '917',
      hints: [
        'Did Edgar have a favourite station? Now the lights are on, look around the boiler room.',
        'The chalk on the boiler-room wall has his station.',
        'Tune to 9 · 1 · 7.',
      ],
      solved: 'Through the crackle, a soft old voice: “My things are all muddled. The boiler valves should match my barrels…”',
    },
    {
      id: 'valves',
      side: 'b',
      title: 'The boiler valves',
      prompt: 'Four valve wheels, each with a symbol. Match Edgar’s barrels.',
      lock: { kind: 'glyphs', slots: 4, set: ['bat', 'moon', 'key', 'feather', 'crown', 'star'] },
      answer: 'moon,key,bat,crown',
      hints: [
        'The wine barrels have symbols painted on their ends.',
        'Read the barrel ends in the wine cellar from left to right.',
        'Moon, key, bat, crown.',
      ],
      solved: 'The boiler hatch groans open. Inside: Edgar’s striped scarf. His voice: “Light my candles like my scarf, would you?”',
    },
    {
      id: 'candles',
      side: 'a',
      title: 'The candle shelf',
      prompt: 'Light the five candles in the right order.',
      lock: { kind: 'sequence', length: 5, colors: ['red', 'green', 'gold', 'white', 'blue'], noun: 'candle' },
      answer: 'green,white,red,gold,blue',
      hints: [
        'Edgar’s scarf is in the boiler room now.',
        'Light the candles in the order of the scarf’s stripes, top to bottom.',
        'Green, white, red, gold, blue.',
      ],
      solved: 'The candles flare, and Edgar appears in both rooms at once, clear as day. “Will you see me off? Both of you, together.”',
    },
    {
      id: 'goodbye',
      side: 'both',
      title: 'Say goodbye',
      prompt: 'Edgar is ready. Hold the button at the same time as your partner.',
      lock: { kind: 'together', label: 'Wave goodbye', holdMs: 2000 },
      answer: 'together',
      hints: ['You both need to hold your button at the same moment.', 'Count down together: three, two, one, hold.', 'Keep holding until the light fills up.'],
      solved: 'Edgar tips his hat.',
    },
  ],
  ending: {
    title: 'Edgar rests',
    text: 'Edgar tips his hat, hums the last line of his favourite song, and fades into a warm golden light. The cellar is quiet now, and somehow a little warmer. On the radio, very faintly: “Thank you, you two.”',
  },
  draw: (s, side, step, t) => (side === 'a' ? drawWine(s, step, t) : drawBoiler(s, step, t)),
};

/* ---------- shared bits ---------- */

function floor(s: Scene) {
  for (let y = 92; y < 120; y++)
    for (let x = 0; x < SW; x++) {
      const row = y < 97 ? 0 : y < 104 ? 1 : y < 112 ? 2 : 3;
      const seam = (x + row * 9) % 22 === 0 || y === 92 || y === 97 || y === 104 || y === 112;
      s.set(x, y, seam ? '#2c2a2c' : row % 2 ? '#4a4648' : '#524d4f');
    }
}

function ghost(s: Scene, cx: number, cy: number, t: number) {
  const bob = Math.round(Math.sin(t * 2) * 2);
  for (let j = 0; j < 34; j++) {
    const half = j < 10 ? Math.round(Math.sqrt(100 - (10 - j) ** 2)) : 10 + Math.floor((j - 10) / 8);
    for (let i = -half; i <= half; i++) {
      if (j > 28 && (i + Math.floor(t * 6)) % 4 === 0) continue;
      s.glow(cx + i, cy + j + bob, j < 2 ? '#e9fff7' : '#bff2e2', 170);
    }
  }
  s.glow(cx - 4, cy + 8 + bob, '#1f3b36');
  s.glow(cx + 3, cy + 8 + bob, '#1f3b36');
  s.hline(cx - 3, cy + 14 + bob, 6, '#6a9e90');
  // hat
  s.rect(cx - 7, cy - 4 + bob, 14, 3, '#2f3a3a');
  s.rect(cx - 5, cy - 10 + bob, 10, 7, '#2f3a3a');
}

function bulb(s: Scene, x: number, on: boolean) {
  s.vline(x, 0, 6, '#2a2020');
  s.rect(x - 1, 6, 3, 2, '#5a5048');
  if (on) {
    s.glow(x - 1, 8, '#fff2b8');
    s.glow(x, 8, '#fffbe0');
    s.glow(x + 1, 8, '#fff2b8');
    s.glow(x, 9, '#ffe7a3');
  } else s.rect(x - 1, 8, 3, 2, '#6a6058');
}

/* ---------- side A: the wine cellar ---------- */

function drawWine(s: Scene, step: number, t: number) {
  stoneWall(s, 0, 0, SW, 92, '#5a524c', '#4e4742', '#35302d');
  floor(s);
  bulb(s, 100, step >= 1);

  // barrel rack
  s.rect(12, 84, 84, 4, '#4d3224');
  for (let i = 0; i < 4; i++) {
    const cx = 22 + i * 21;
    const cy = 74;
    s.disc(cx, cy, 10, '#5a3a2c');
    s.disc(cx, cy, 8, '#7a5236');
    s.disc(cx, cy, 3, '#6b4630');
    for (let a = 0; a < 12; a++) s.set(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 9), '#b48c4a');
    if (step >= 1) s.glyph((['moon', 'key', 'bat', 'crown'] as const)[i], cx - 3, cy - 3, '#e8dcc0');
  }
  // candle stub on a barrel
  candle(s, 28, 63, '#e6d6b8', true, t, 3);

  // wooden post with scratched arrows
  s.box(102, 18, 10, 75, '#5a3a2c');
  for (let i = 0; i < 4; i++) {
    const y = 34 + i * 9;
    const up = i === 0 || i === 3;
    s.vline(107, y, 6, '#c9b08a');
    s.set(106, up ? y + 1 : y + 4, '#c9b08a');
    s.set(108, up ? y + 1 : y + 4, '#c9b08a');
  }

  // crate + radio
  s.box(118, 78, 32, 14, '#6b4a2e');
  s.hline(118, 84, 32, '#4d3224');
  s.box(121, 62, 26, 16, '#7a5a3a');
  s.rect(124, 65, 12, 10, step >= 1 ? '#e8c787' : '#5a4632');
  if (step >= 1) for (let y = 66; y < 75; y += 2) s.glow(125, y, '#fff1c2');
  for (let i = 0; i < 3; i++) s.disc(140, 66 + i * 4, 1.5, '#c49a4e');
  if (step >= 2) {
    const f = Math.floor(t * 4) % 3;
    s.glow(150 + f, 58 - f * 2, '#bff2e2');
    s.glow(153 + f, 55 - f, '#bff2e2');
  }

  // portrait of Edgar
  s.box(150, 8, 30, 30, '#6b4a2e');
  s.rect(152, 10, 26, 26, '#3a4a45');
  s.disc(165, 21, 6, '#d9b89a');
  s.rect(159, 28, 12, 8, '#2f3a3a');
  s.hline(162, 23, 6, '#5a3a2c');
  s.rect(159, 13, 12, 3, '#2f3a3a');
  s.set(163, 20, '#2a2020');
  s.set(167, 20, '#2a2020');
  if (step >= 4) {
    s.glow(163, 20, '#bff2e2');
    s.glow(167, 20, '#bff2e2');
  }

  // candle shelf
  s.box(150, 52, 46, 3, '#5a3a2c');
  const order = ['red', 'green', 'gold', 'white', 'blue'] as const;
  order.forEach((c, i) => candle(s, 153 + i * 9, 52, COLORS[c].hex, step >= 4, t, 7));

  if (step >= 4 && step < 5) ghost(s, 78, 26, t);

  const lights = [{ x: 29, y: 58, r: step >= 1 ? 50 : 110, c: CANDLE, k: 1.0 }];
  if (step >= 1) lights.push({ x: 100, y: 10, r: 150, c: WARM, k: 0.9 });
  if (step >= 4) lights.push({ x: 172, y: 44, r: 70, c: CANDLE, k: 0.9 });
  if (step >= 4 && step < 5) lights.push({ x: 78, y: 40, r: 70, c: GHOST, k: 0.9 });
  lightScene(s, lights, step >= 1 ? [0.32, 0.3, 0.32] : [0.18, 0.17, 0.22]);
}

/* ---------- side B: the boiler room ---------- */

function drawBoiler(s: Scene, step: number, t: number) {
  // bricks
  s.rect(0, 0, SW, 92, '#3a2a26');
  for (let y = 0, r = 0; y < 92; y += 5, r++)
    for (let x = r % 2 ? -6 : 0; x < SW; x += 12) {
      const c = (x * 3 + y) % 7 > 3 ? '#7a4a3a' : '#6b4032';
      s.rect(Math.max(0, x), y, Math.min(11, SW - Math.max(0, x)), 4, c);
    }
  floor(s);
  bulb(s, 70, step >= 1);

  // pipes along the top and down the side
  s.rect(0, 12, SW, 4, '#6b6e70');
  s.hline(0, 12, SW, '#8d9194');
  s.rect(112, 12, 4, 60, '#6b6e70');
  s.vline(112, 12, 60, '#8d9194');
  for (const x of [30, 90, 150]) s.rect(x, 11, 3, 6, '#4a4c4e');

  // fuse box
  s.box(12, 28, 24, 30, '#5c6a6e');
  s.rect(15, 31, 18, 24, '#3d474a');
  const sw = step >= 1 ? 'UDDU' : 'DDDD';
  for (let i = 0; i < 4; i++) {
    const x = 16 + i * 4;
    s.rect(x, 36, 3, 12, '#2a3033');
    const up = sw[i] === 'U';
    s.rect(x, up ? 37 : 43, 3, 4, '#d8d0c0');
  }
  s.glow(33, 30, step >= 1 ? '#8fe08a' : '#c4453f');

  // chalk writing (legible once the lights are on)
  const chalk = step >= 1 ? '#e9e4d8' : '#5a4a44';
  s.rect(50, 22, 22, 1, chalk);
  s.rect(50, 26, 16, 1, chalk);
  for (let i = 0; i < 4; i++) s.rect(56 + i * 6, 34, 4, 7, chalk);
  s.rect(58, 36, 1, 3, '#3a2a26');
  s.rect(74, 36, 1, 3, '#3a2a26');

  // the boiler
  s.box(122, 28, 68, 64, '#4a4c4e');
  s.disc(156, 50, 18, '#3a3c3e');
  s.disc(156, 50, 15, step >= 3 ? '#1a1616' : '#565a5c');
  if (step >= 3) {
    s.rect(170, 36, 8, 30, '#565a5c');
  } else {
    for (let i = 0; i < 4; i++) {
      const vx = 132 + i * 15;
      s.disc(vx, 80, 5, '#a84f4b');
      s.disc(vx, 80, 2, '#3a2a26');
    }
  }
  // fire grate glow
  for (let x = 140; x < 172; x++) s.glow(x, 88, (x + Math.floor(t * 8)) % 3 ? '#c4453f' : '#e2b359');

  // scarf on the pipe
  if (step >= 3) {
    const cols = ['green', 'white', 'red', 'gold', 'blue'] as const;
    for (let j = 0; j < 40; j++) {
      const c = COLORS[cols[Math.min(4, Math.floor(j / 8))]].hex;
      const sway = Math.round(Math.sin(t * 1.5 + j * 0.1) * (j / 20));
      s.rect(102 + sway, 24 + j, 8, 1, j % 8 === 7 ? mix(c, '#000000', 0.3) : c);
    }
  }

  if (step >= 4 && step < 5) ghost(s, 78, 48, t);

  const lights = [{ x: 156, y: 88, r: 70, c: [1.1, 0.6, 0.35] as [number, number, number], k: 0.8 }];
  if (step >= 1) lights.push({ x: 70, y: 10, r: 160, c: WARM, k: 0.95 });
  if (step >= 4 && step < 5) lights.push({ x: 78, y: 62, r: 70, c: GHOST, k: 0.9 });
  lightScene(s, lights, step >= 1 ? [0.32, 0.29, 0.3] : [0.17, 0.16, 0.2]);
}
