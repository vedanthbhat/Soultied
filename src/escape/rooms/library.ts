import { mix } from '../../pixel/buffer';
import { Scene, SW, candle, clockFace, lightScene, CANDLE, MAGIC } from '../scene';
import { COLORS } from '../glyphs';
import type { RoomDef } from '../types';

const PATTERN = ['.##.', '####', '#..#', '####'];

export const LIBRARY: RoomDef = {
  id: 'library',
  title: 'The Lost Library',
  tagline: 'The books have started whispering.',
  mood: 'Magical',
  accent: '#a987d6',
  minutes: 15,
  intro:
    'Behind the dark door is a library that couldn’t possibly fit inside your house. The Librarian has vanished and the books are restless: pages flutter, shelves creak, something hums. One of you is in the reading hall, the other in the tall stacks. Put the library back to sleep before the last candle burns down.',
  sides: {
    a: { name: 'The reading hall', blurb: 'A stained-glass window, a globe and a lectern.' },
    b: { name: 'The stacks', blurb: 'Shelves to the ceiling, a grandfather clock and a ladder.' },
  },
  objects: [
    // --- side A: the reading hall ---
    {
      id: 'glass',
      side: 'a',
      label: 'Stained-glass window',
      rect: { x: 78, y: 4, w: 44, h: 58 },
      views: [
        {
          from: 0,
          clue: {
            kind: 'colors',
            title: 'The stained-glass window',
            text: 'Four bands of coloured glass, from the top of the arch down:',
            colors: ['blue', 'gold', 'red', 'violet'],
            style: 'panes',
          },
        },
      ],
    },
    {
      id: 'globe',
      side: 'a',
      label: 'Brass globe',
      rect: { x: 22, y: 44, w: 40, h: 49 },
      views: [
        { from: 0, puzzle: 'globe', text: 'A brass globe with four little symbol dials on its stand. It won’t turn yet.' },
        { from: 2, text: 'The globe spins slowly on its own now.' },
      ],
    },
    {
      id: 'hourglass',
      side: 'a',
      label: 'Hourglass',
      rect: { x: 62, y: 64, w: 16, h: 22 },
      views: [
        { from: 0, text: 'An hourglass with an engraved base. The engraving is covered in dust.' },
        {
          from: 2,
          clue: { kind: 'note', title: 'Engraved on the hourglass', text: 'The Librarian sleeps at half past three, when the dust settles.' },
        },
      ],
    },
    {
      id: 'floor',
      side: 'a',
      label: 'Glowing floor tiles',
      rect: { x: 76, y: 94, w: 48, h: 24 },
      from: 3,
      views: [
        {
          from: 3,
          clue: { kind: 'pattern', title: 'The glowing floor', text: 'Sixteen tiles in a 4 × 4 square. Some of them glow:', rows: PATTERN },
        },
      ],
    },
    {
      id: 'spellbook',
      side: 'a',
      label: 'Spellbook',
      rect: { x: 132, y: 46, w: 34, h: 47 },
      views: [
        { from: 0, text: 'A huge spellbook on a lectern, fluttering its pages by itself. It won’t close.' },
        { from: 4, puzzle: 'close' },
      ],
    },
    // --- side B: the stacks ---
    {
      id: 'shelf',
      side: 'b',
      label: 'Coloured books',
      rect: { x: 14, y: 36, w: 78, h: 22 },
      views: [
        { from: 0, puzzle: 'books', text: 'Five big books, one of each colour, sticking out a little. They look like levers.' },
        { from: 1, text: 'The shelf has swung aside.' },
      ],
    },
    {
      id: 'chart',
      side: 'b',
      label: 'Star chart',
      rect: { x: 98, y: 8, w: 44, h: 42 },
      from: 1,
      views: [
        {
          from: 1,
          clue: {
            kind: 'glyphs',
            title: 'A star chart hidden behind the shelf',
            text: 'Four constellations are circled in silver, numbered 1 to 4:',
            glyphs: ['star', 'moon', 'comet', 'sun'],
          },
        },
      ],
    },
    {
      id: 'clock',
      side: 'b',
      label: 'Grandfather clock',
      rect: { x: 148, y: 14, w: 28, h: 79 },
      views: [
        { from: 0, puzzle: 'clock', text: 'A grandfather clock, ticking backwards. Its glass door is locked.' },
        { from: 3, text: 'The clock ticks the right way round now.' },
      ],
    },
    {
      id: 'tiles',
      side: 'b',
      label: 'Tile panel',
      rect: { x: 98, y: 58, w: 40, h: 34 },
      views: [
        { from: 0, puzzle: 'tiles', text: 'A 4 × 4 panel of stone tiles set into the shelf. Nothing happens when you press them.' },
        { from: 4, text: 'The tiles glow softly in the shape of a little house.' },
      ],
    },
    {
      id: 'lastcandle',
      side: 'b',
      label: 'The last candle',
      rect: { x: 176, y: 60, w: 20, h: 33 },
      from: 4,
      views: [{ from: 4, puzzle: 'close' }],
    },
  ],
  puzzles: [
    {
      id: 'books',
      side: 'b',
      title: 'The book levers',
      prompt: 'Pull four of the coloured books, in the right order.',
      lock: { kind: 'sequence', length: 4, colors: ['red', 'blue', 'green', 'gold', 'violet'], noun: 'book' },
      answer: 'blue,gold,red,violet',
      hints: ['Is there anything coloured in the reading hall?', 'The stained-glass window shows the order, from the top of the arch down.', 'Blue, gold, red, violet.'],
      solved: 'The shelf swings aside, revealing a star chart painted on the wall behind it.',
    },
    {
      id: 'globe',
      side: 'a',
      title: 'The brass globe',
      prompt: 'Four symbol dials on the globe’s stand.',
      lock: { kind: 'glyphs', slots: 4, set: ['sun', 'moon', 'star', 'comet', 'crown', 'feather'] },
      answer: 'star,moon,comet,sun',
      hints: ['Something just appeared behind the shelf in the stacks.', 'Read the star chart’s circled constellations, 1 to 4.', 'Star, moon, comet, sun.'],
      solved: 'The globe spins and the dust blows off the hourglass. Something is engraved on it.',
    },
    {
      id: 'clock',
      side: 'b',
      title: 'The grandfather clock',
      prompt: 'Set the time the Librarian goes to sleep.',
      lock: { kind: 'clock', minuteStep: 5 },
      answer: '3:30',
      hints: ['The hourglass in the reading hall has an engraving now.', 'Half past three.', 'Set the clock to 3:30.'],
      solved: 'The clock strikes half past three, and tiles on the reading-hall floor start to glow.',
    },
    {
      id: 'tiles',
      side: 'b',
      title: 'The tile panel',
      prompt: 'Press the tiles to match the glowing floor.',
      lock: { kind: 'grid', size: 4 },
      answer: PATTERN.join('/'),
      hints: [
        'The floor in the reading hall is glowing in a pattern.',
        'Describe the glowing floor row by row, from the top.',
        'Rows: two middle tiles / all four / the two ends / all four.',
      ],
      solved: 'The spellbook slows down. A whisper: “Close me together, and we all sleep.”',
    },
    {
      id: 'close',
      side: 'both',
      title: 'Put the library to sleep',
      prompt: 'Hold the button at the same time as your partner.',
      lock: { kind: 'together', label: 'Close the book', holdMs: 2000 },
      answer: 'together',
      hints: ['You both need to hold your button at the same moment.', 'Count down together: three, two, one, hold.', 'Keep holding until the light fills up.'],
      solved: 'The spellbook closes with a soft thump.',
    },
  ],
  ending: {
    title: 'The library sleeps',
    text: 'The spellbook closes with a soft thump. One by one the books drift back to their shelves, the candles lower their flames, and somewhere far away the Librarian yawns. You both tiptoe out, and the dark door clicks shut behind you.',
  },
  draw: (s, side, step, t) => (side === 'a' ? drawHall(s, step, t) : drawStacks(s, step, t)),
};

/* ---------- side A: the reading hall ---------- */

function checkerFloor(s: Scene, y0: number) {
  for (let y = y0; y < 120; y++) for (let x = 0; x < SW; x++) s.set(x, y, (Math.floor(x / 10) + Math.floor((y - y0) / 6)) % 2 ? '#3d3350' : '#4a3f60');
}

function drawHall(s: Scene, step: number, t: number) {
  for (let y = 0; y < 92; y++) for (let x = 0; x < SW; x++) s.set(x, y, x % 16 < 2 ? '#2e2640' : '#3a3150');
  s.rect(0, 86, SW, 6, '#241d33');
  checkerFloor(s, 92);

  // stained-glass window (arched)
  const bands = ['blue', 'gold', 'red', 'violet'] as const;
  for (let y = 6; y < 60; y++)
    for (let x = 80; x < 120; x++) {
      const arch = y < 22 && (x + 0.5 - 100) ** 2 + ((y - 22) * 1.3) ** 2 > 400;
      if (arch) continue;
      const band = Math.min(3, Math.floor((y - 6) / 13.5));
      const c = COLORS[bands[band]].hex;
      const lead = (x - 80) % 10 === 0 || (y - 6) % 13 === 0;
      s.glow(x, y, lead ? '#1a1424' : (x + y) % 5 ? c : mix(c, '#ffffff', 0.25));
    }

  // globe on a stand
  s.vline(42, 70, 22, '#8a6a3a');
  s.hline(34, 91, 17, '#8a6a3a');
  const spin = step >= 2 ? Math.floor(t * 4) : 0;
  s.disc(42, 58, 12, '#3f6a8a');
  for (let y = 47; y < 70; y++)
    for (let x = 31; x < 54; x++)
      if ((x + 0.5 - 42) ** 2 + (y + 0.5 - 58) ** 2 < 140 && (x * 3 + y * 5 + spin * 2) % 13 < 4) s.set(x, y, '#6f8f4e');
  for (let a = 0; a < 40; a++) s.set(Math.round(42 + Math.cos(a / 6.4) * 13), Math.round(58 + Math.sin(a / 6.4) * 13), '#c49a4e');
  s.box(30, 76, 24, 6, '#6b4633');
  if (step < 2) for (let i = 0; i < 4; i++) s.rect(32 + i * 5, 78, 3, 3, '#c49a4e');

  // hourglass
  s.box(62, 84, 16, 3, '#6b4633');
  s.hline(64, 66, 12, '#6b4633');
  s.hline(64, 83, 12, '#6b4633');
  for (let j = 0; j < 16; j++) {
    const half = Math.max(1, Math.abs(8 - j) * 0.7);
    for (let i = -half; i <= half; i++) s.set(Math.round(70 + i), 67 + j, j > 9 ? '#e2c38a' : '#8fa0b8');
  }
  if (step < 2) s.rect(62, 86, 16, 1, '#8a7f70');

  // glowing floor pattern
  if (step >= 3) {
    PATTERN.forEach((row, j) =>
      [...row].forEach((c, i) => {
        if (c !== '#') return;
        const pulse = Math.sin(t * 2 + i + j) > -0.2;
        s.glowRect(80 + i * 10 + 1, 96 + j * 6, 8, 4, pulse ? '#cdb3ff' : '#a987d6');
      })
    );
  }

  // lectern + spellbook
  s.vline(149, 64, 28, '#4d3224');
  s.hline(140, 91, 18, '#4d3224');
  s.box(136, 58, 26, 6, '#5a3a2c');
  if (step >= 5) {
    s.box(139, 52, 20, 6, '#6a2f4a');
  } else {
    const flap = Math.floor(t * 6) % 3;
    s.rect(137, 50, 11, 8, '#efe3cb');
    s.rect(150, 50, 11, 8, '#efe3cb');
    s.rect(148, 50 - flap, 2, 8, '#d8c9ad');
    for (let k = 0; k < 3; k++) s.glow(142 + k * 6, 46 - ((flap + k) % 3), '#cdb3ff');
  }

  candle(s, 180, 86, '#efe3cb', step < 5, t, 10);
  candle(s, 20, 86, '#efe3cb', step < 5, t, 8);

  lightScene(
    s,
    [
      { x: 100, y: 30, r: 100, c: MAGIC, k: 0.8 },
      { x: 181, y: 74, r: 70, c: CANDLE, k: 0.9 },
      { x: 21, y: 76, r: 60, c: CANDLE, k: 0.8 },
      ...(step >= 3 ? [{ x: 100, y: 106, r: 50, c: MAGIC, k: 0.9 }] : []),
    ],
    [0.2, 0.18, 0.28]
  );
}

/* ---------- side B: the stacks ---------- */

function shelves(s: Scene) {
  s.rect(0, 0, SW, 92, '#2b2030');
  const cols = ['#7a5068', '#4f6583', '#d09a3e', '#8a9a72', '#b8674f', '#efe3cb', '#5e3f7a'];
  for (let sh = 0; sh < 5; sh++) {
    const y = 4 + sh * 18;
    s.rect(0, y + 15, SW, 3, '#5a3a2c');
    s.hline(0, y + 15, SW, '#7a5540');
    let x = 0;
    let k = sh * 7;
    while (x < SW) {
      const w = 3 + (k % 3);
      const h = 10 + ((k * 7) % 5);
      const c = cols[k % cols.length];
      s.rect(x, y + 15 - h, w, h, mix(c, '#000000', 0.25));
      x += w + ((k * 13) % 7 === 0 ? 2 : 0);
      k++;
    }
  }
  for (let y = 92; y < 120; y++) for (let x = 0; x < SW; x++) s.set(x, y, (x + (y >> 1)) % 12 < 6 ? '#3a2a26' : '#342522');
}

function drawStacks(s: Scene, step: number, t: number) {
  shelves(s);

  // five coloured lever-books (swing away once solved, revealing the star chart area)
  s.rect(14, 38, 78, 20, '#241a2a');
  const levers = ['red', 'blue', 'green', 'gold', 'violet'] as const;
  levers.forEach((c, i) => {
    const x = 18 + i * 15;
    s.box(x, 40, 11, 16, COLORS[c].hex);
    s.hline(x + 2, 44, 7, mix(COLORS[c].hex, '#ffffff', 0.35));
  });

  // star chart behind the shelf
  if (step >= 1) {
    s.box(98, 8, 44, 42, '#1a1830');
    for (let k = 0; k < 16; k++) s.glow(100 + ((k * 17) % 40), 10 + ((k * 11) % 38), '#8fa0c8');
    (['star', 'moon', 'comet', 'sun'] as const).forEach((g, i) => s.glyph(g, 102 + (i % 2) * 20, 12 + Math.floor(i / 2) * 18, '#e8e0ff', true));
  }

  // grandfather clock
  s.box(150, 14, 24, 78, '#4d3224');
  s.box(153, 44, 18, 40, '#5a3a2c');
  // ticks backwards until it's set right
  const [h, m] = step >= 3 ? [3, 30] : [11, (60 - (Math.floor(t) % 12) * 5) % 60];
  clockFace(s, 162, 28, 9, h, m);
  const swing = Math.round(Math.sin(t * (step >= 3 ? 3 : -3)) * 3);
  s.line(162, 46, 162 + swing, 74, '#c49a4e');
  s.disc(162 + swing, 76, 3, '#c49a4e');

  // tile panel
  s.box(100, 60, 36, 30, '#4a4250');
  PATTERN.forEach((row, j) =>
    [...row].forEach((c, i) => {
      const lit = step >= 4 && c === '#';
      const x = 103 + i * 8;
      const y = 62 + j * 7;
      if (lit) s.glowRect(x, y, 6, 5, '#cdb3ff');
      else s.box(x, y, 6, 5, '#6a6272');
    })
  );

  // the last candle
  if (step >= 4) {
    s.box(180, 86, 12, 6, '#5a3a2c');
    candle(s, 185, 86, '#efe3cb', step < 5, t, 14);
  }

  // ladder
  s.line(140, 92, 146, 4, '#6b4633');
  s.line(146, 92, 152, 4, '#6b4633');

  lightScene(
    s,
    [
      { x: 100, y: 50, r: 120, c: MAGIC, k: 0.55 },
      { x: 186, y: 70, r: step >= 4 && step < 5 ? 90 : 1, c: CANDLE, k: 1.0 },
      { x: 60, y: 30, r: 90, c: CANDLE, k: 0.5 },
    ],
    [0.22, 0.2, 0.3]
  );
}
