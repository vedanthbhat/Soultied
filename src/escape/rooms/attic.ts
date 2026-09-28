import { mix } from '../../pixel/buffer';
import { Scene, SW, planks, candle, clockFace, lightScene, MOONLIGHT, CANDLE } from '../scene';
import type { RoomDef } from '../types';

/* ---------- the story and puzzles ---------- */

const C = {
  board: '#5c4a3d',
  boardD: '#524235',
  beam: '#3b2d25',
  beamL: '#4d3a2f',
  floorA: '#6b4a33',
  floorB: '#61432e',
  seam: '#40291c',
  wood: '#7a4a2e',
  woodL: '#96603d',
  brass: '#c49a4e',
  cream: '#e6d6b8',
  paper: '#efe3cb',
};

export const ATTIC: RoomDef = {
  id: 'attic',
  title: 'The Old Attic',
  tagline: 'A love story, left in boxes.',
  mood: 'Cozy mystery',
  accent: '#c49a4e',
  minutes: 15,
  intro:
    'Above the living room is an attic nobody has opened in fifty years. Leela and Kabir lived here once. He sailed, she waited, and they wrote to each other across the sea. Somewhere up here is the last letter she never sent. You’re each in a different corner of the attic with a wall between you. What one of you sees, the other one needs.',
  sides: {
    a: { name: 'The eaves', blurb: 'Under the sloping roof, by the round window.' },
    b: { name: 'The back room', blurb: 'Leela’s little writing room, behind the wall.' },
  },
  objects: [
    // --- side A: the eaves ---
    {
      id: 'trunk',
      side: 'a',
      label: 'Old sea trunk',
      rect: { x: 14, y: 64, w: 48, h: 29 },
      views: [
        { from: 0, puzzle: 'trunk', text: 'An old sea trunk with a brass padlock.' },
        {
          from: 1,
          clue: {
            kind: 'glyphs',
            title: 'Half a photograph',
            text: 'Leela and Kabir on a pier, torn down the middle. On the back, four little drawings in faded ink:',
            glyphs: ['anchor', 'rose', 'moon', 'heart'],
          },
        },
      ],
    },
    {
      id: 'window',
      side: 'a',
      label: 'Round window',
      rect: { x: 86, y: 14, w: 28, h: 28 },
      views: [
        {
          from: 0,
          clue: { kind: 'note', title: 'Scratched into the window frame', text: 'K + L\nThe Evening Star, 1968\n“Look at the moon and I’ll be looking too.”' },
        },
      ],
    },
    {
      id: 'dressform',
      side: 'a',
      label: 'Dress form',
      rect: { x: 66, y: 40, w: 22, h: 53 },
      views: [
        { from: 0, text: 'An old dress form wearing a moth-eaten shawl. Nothing pinned to it… yet.' },
        {
          from: 2,
          clue: {
            kind: 'note',
            title: 'A note pinned to the shawl',
            text: 'Every night at quarter past nine, I’ll look at the moon and think of you. Wind the clock to our time.',
            sign: '— K.',
          },
        },
      ],
    },
    {
      id: 'musicbox',
      side: 'a',
      label: 'Music box',
      rect: { x: 106, y: 64, w: 32, h: 16 },
      views: [
        { from: 0, text: 'A wooden music box with five coloured keys. It won’t play without the right tune.' },
        { from: 3, puzzle: 'musicbox' },
        { from: 4, text: 'The music box plays their song, slightly out of tune. It’s perfect.' },
      ],
    },
    {
      id: 'photos',
      side: 'a',
      label: 'Photo wall',
      rect: { x: 142, y: 36, w: 54, h: 34 },
      views: [
        {
          from: 0,
          clue: {
            kind: 'letters',
            title: 'Four framed photographs',
            text: 'Each frame has a number painted on its corner. Two of them also have a letter scratched into the glass.',
            letters: [
              [1, 'H'],
              [2, null],
              [3, 'M'],
              [4, null],
            ],
          },
        },
      ],
    },
    {
      id: 'letterbox',
      side: 'a',
      label: 'Hidden letterbox',
      rect: { x: 154, y: 72, w: 30, h: 18 },
      from: 4,
      views: [
        { from: 4, puzzle: 'letterbox' },
        { from: 5, text: 'Empty now. The letter is safe.' },
      ],
    },
    // --- side B: the back room ---
    {
      id: 'desk',
      side: 'b',
      label: 'Writing desk',
      rect: { x: 10, y: 54, w: 58, h: 39 },
      views: [
        {
          from: 0,
          clue: { kind: 'note', title: 'A luggage tag on the desk', text: 'TRUNK\nL & K\n3 · 1 · 8', sign: 'Leela’s handwriting' },
        },
      ],
    },
    {
      id: 'hatbox',
      side: 'b',
      label: 'Hat box',
      rect: { x: 70, y: 70, w: 34, h: 23 },
      views: [
        { from: 0, puzzle: 'hatbox', text: 'A striped hat box, held shut by four little picture wheels.' },
        { from: 2, text: 'Inside, wrapped in a silk scarf: Kabir’s pocket watch and a folded train ticket.' },
      ],
    },
    {
      id: 'clock',
      side: 'b',
      label: 'Wall clock',
      rect: { x: 84, y: 16, w: 32, h: 46 },
      views: [
        { from: 0, text: 'A wall clock, stopped at 3:40. The glass is locked shut for now.' },
        { from: 2, puzzle: 'clock' },
        {
          from: 3,
          clue: {
            kind: 'colors',
            title: 'Sheet music from the clock’s drawer',
            text: '“Our song,” written above five notes, each one coloured in by hand:',
            colors: ['red', 'gold', 'gold', 'blue', 'green'],
            style: 'notes',
          },
        },
      ],
    },
    {
      id: 'books',
      side: 'b',
      label: 'Bookshelf',
      rect: { x: 136, y: 26, w: 58, h: 67 },
      views: [
        {
          from: 0,
          clue: {
            kind: 'letters',
            title: 'Four numbered books',
            text: 'Leela numbered her favourite books 1 to 4. Two of the spines have a single gold letter.',
            letters: [
              [1, null],
              [2, 'O'],
              [3, null],
              [4, 'E'],
            ],
          },
        },
      ],
    },
  ],
  puzzles: [
    {
      id: 'trunk',
      side: 'a',
      title: 'The sea trunk',
      prompt: 'A brass padlock with three number wheels.',
      lock: { kind: 'digits', length: 3 },
      answer: '318',
      hints: [
        'Your partner is in Leela’s writing room. Ask what’s on the desk.',
        'There’s a luggage tag on the writing desk in the back room.',
        'The code is 3 · 1 · 8.',
      ],
      solved: 'The trunk creaks open. Under old sweaters: half of a photograph, with drawings on the back.',
    },
    {
      id: 'hatbox',
      side: 'b',
      title: 'The hat box',
      prompt: 'Four little picture wheels hold the lid shut.',
      lock: { kind: 'glyphs', slots: 4, set: ['moon', 'star', 'heart', 'anchor', 'rose', 'bird'] },
      answer: 'anchor,rose,moon,heart',
      hints: [
        'The lock uses pictures, not numbers. Your partner just found something in the trunk.',
        'Look at the back of the torn photograph from the trunk, left to right.',
        'Anchor, rose, moon, heart.',
      ],
      solved: 'The hat box opens: a pocket watch and a train ticket. Somewhere in the eaves, a note appears on the dress form.',
    },
    {
      id: 'clock',
      side: 'b',
      title: 'The stopped clock',
      prompt: 'Set the hands to the time that matters to these two.',
      lock: { kind: 'clock', minuteStep: 5 },
      answer: '9:15',
      hints: [
        'The clock needs a time. There’s a new note in the eaves.',
        'Read the note pinned to the dress form: quarter past something.',
        'Set the clock to 9:15.',
      ],
      solved: 'The clock chimes a quarter past nine and a little drawer slides out: sheet music, coloured in by hand.',
    },
    {
      id: 'musicbox',
      side: 'a',
      title: 'The music box',
      prompt: 'Five coloured keys. Play their song.',
      lock: { kind: 'sequence', length: 5, colors: ['red', 'gold', 'blue', 'green', 'white'], noun: 'key' },
      answer: 'red,gold,gold,blue,green',
      hints: [
        'Is there any music in the back room?',
        'The sheet music from the clock drawer shows the colours in order.',
        'Red, gold, gold, blue, green.',
      ],
      solved: 'Their song fills the attic. Behind the photo wall something clicks, and a hidden letterbox slides out.',
    },
    {
      id: 'letterbox',
      side: 'a',
      title: 'The hidden letterbox',
      prompt: 'Four letter wheels. The last word of the letter.',
      lock: { kind: 'letters', length: 4 },
      answer: 'HOME',
      hints: [
        'It’s a four-letter word and you each have half of it.',
        'The photo frames in the eaves give letters 1 and 3. The numbered books in the back room give 2 and 4.',
        'HOME.',
      ],
      solved: 'The letterbox opens.',
    },
  ],
  ending: {
    title: 'The last letter',
    text: 'Inside is the letter Leela never sent, because Kabir came home the very next morning. The last line reads: “I don’t mind how far you sail. Wherever you are is home.” You fold it carefully and put it back where it belongs.',
  },
  draw: (s, side, step, t) => (side === 'a' ? drawEaves(s, step, t) : drawBackRoom(s, step, t)),
};

/* ---------- side A: the eaves ---------- */

function roofAndWall(s: Scene, leftSlope: boolean, rightSlope: boolean) {
  for (let y = 0; y < 92; y++) for (let x = 0; x < SW; x++) s.set(x, y, Math.floor(x / 9) % 2 ? C.board : C.boardD);
  for (let x = 0; x < SW; x += 9) s.vline(x, 0, 92, mix(C.board, '#000000', 0.3));
  const slope = (x: number) => {
    let top = -1;
    if (leftSlope) top = Math.max(top, Math.round(46 - x * 0.62));
    if (rightSlope) top = Math.max(top, Math.round(46 - (SW - x) * 0.62));
    return top;
  };
  for (let x = 0; x < SW; x++) {
    const top = slope(x);
    for (let y = 0; y <= top; y++) s.set(x, y, (x + y * 2) % 14 < 2 ? C.beamL : C.beam);
    if (top >= 0) {
      s.set(x, top + 1, '#2a1f1a');
      s.set(x, top + 2, '#2a1f1a');
    }
  }
  s.rect(0, 88, SW, 4, '#3f3026');
  planks(s, 92, C.floorA, C.floorB, C.seam);
}

function drawEaves(s: Scene, step: number, t: number) {
  roofAndWall(s, true, true);

  // round window with the moon
  const wx = 100;
  const wy = 28;
  s.disc(wx, wy, 14, '#3b2d25');
  for (let y = wy - 12; y <= wy + 12; y++)
    for (let x = wx - 12; x <= wx + 12; x++) {
      if ((x + 0.5 - wx) ** 2 + (y + 0.5 - wy) ** 2 > 144) continue;
      s.glow(x, y, y < wy - 4 ? '#1d2544' : y < wy + 4 ? '#243058' : '#2d3a66');
    }
  s.disc(wx + 4, wy - 4, 4, '#f4ecd0', true);
  s.disc(wx + 6, wy - 5, 3, '#243058', true);
  for (const [sx, sy] of [[wx - 7, wy - 6], [wx - 3, wy + 5], [wx + 7, wy + 6]]) s.glow(sx, sy, '#dfe6f0');
  s.rect(wx - 12, wy, 25, 1, '#3b2d25');
  s.rect(wx, wy - 12, 1, 25, '#3b2d25');
  for (let y = wy - 12; y <= wy + 12; y++) {
    s.emit[y * SW + wx] = 0;
  }
  for (let x = wx - 12; x <= wx + 12; x++) s.emit[wy * SW + x] = 0;

  // sea trunk
  const tx = 16;
  const ty = 70;
  if (step >= 1) {
    // lid thrown back against the wall
    s.box(tx + 2, ty - 16, 40, 14, C.wood);
    s.rect(tx + 2, ty - 16, 40, 2, C.brass);
    s.rect(tx, ty, 44, 22, C.wood);
    s.rect(tx + 3, ty + 2, 38, 6, '#2b1d16');
    s.rect(tx + 8, ty + 1, 10, 4, C.paper);
    s.rect(tx + 12, ty + 1, 6, 4, '#b8a488');
    s.rect(tx + 24, ty + 2, 12, 3, '#8a9a72');
  } else {
    s.box(tx, ty - 6, 44, 8, C.woodL);
    s.box(tx, ty, 44, 22, C.wood);
    s.rect(tx + 19, ty - 1, 6, 6, C.brass);
    s.set(tx + 21, ty + 2, '#3b2d25');
  }
  for (const bx of [tx + 6, tx + 36]) s.rect(bx, ty, 2, 22, C.brass);
  s.hline(tx, ty + 21, 44, '#3b2419');

  // dress form
  const dx = 77;
  s.vline(dx, 72, 20, '#3b2d25');
  s.hline(dx - 5, 91, 11, '#3b2d25');
  for (let j = 0; j < 30; j++) {
    const half = j < 4 ? 3 + j : j < 14 ? 7 - Math.floor((j - 4) / 3) : 5 + Math.floor((j - 14) / 4);
    for (let i = -half; i <= half; i++) s.set(dx + i, 44 + j, i > half - 2 ? '#bfae8e' : '#d9c7a4');
  }
  for (let j = 6; j < 20; j++) for (let i = -8; i <= 8; i++) if (Math.abs(i) > 5 - (j - 6) / 4 && (i + j) % 3) s.set(dx + i, 44 + j, '#a84f4b');
  if (step >= 2) {
    s.rect(dx - 2, 62, 5, 6, C.paper);
    s.set(dx, 62, '#a84f4b');
  }

  // side table + music box
  s.box(108, 80, 28, 3, C.woodL);
  s.vline(110, 83, 9, C.wood);
  s.vline(133, 83, 9, C.wood);
  if (step >= 4) {
    s.box(112, 66, 20, 4, '#8a5a3a');
    s.box(112, 72, 20, 8, '#8a5a3a');
    const f = Math.floor(t * 3) % 3;
    s.glow(116 + f * 4, 62 - f, '#ffe7a3');
    s.glow(124 - f * 2, 60 - ((f + 1) % 3), '#fff4c2');
  } else {
    s.box(112, 70, 20, 10, '#8a5a3a');
    s.hline(112, 73, 20, C.brass);
  }
  const keys = ['#c4453f', '#e2b359', '#4f78b8', '#5f9a5a', '#efe6d2'];
  keys.forEach((k, i) => s.rect(113 + i * 4, 76, 3, 2, k));

  // photo wall
  const frames = [
    [146, 40],
    [160, 38],
    [174, 41],
    [186, 39],
  ];
  frames.forEach(([fx, fy], i) => {
    s.box(fx, fy, 11, 13, '#3b2d25');
    s.rect(fx + 1, fy + 1, 9, 11, i % 2 ? '#c8b089' : '#d8c19a');
    s.rect(fx + 3, fy + 4, 2, 4, '#7a5a48');
    s.rect(fx + 6, fy + 5, 2, 4, '#7a5a48');
    if (i === 0 || i === 2) s.set(fx + 9, fy + 2, '#fff4d8');
  });
  frames.forEach(([fx, fy], i) => s.set(fx + 1, fy + 11, i === 0 || i === 2 ? '#a84f4b' : '#3b2d25'));

  // hidden letterbox
  if (step >= 4) {
    s.box(156, 74, 26, 15, '#6b4a2e');
    s.rect(158, 76, 22, 11, step >= 5 ? '#2b1d16' : C.brass);
    if (step < 5) for (let i = 0; i < 4; i++) s.rect(160 + i * 5, 79, 3, 5, '#7a5a30');
    else s.rect(162, 80, 12, 5, C.paper);
    if (step < 5) {
      const g = Math.sin(t * 3) > 0 ? '#fff1c2' : '#ffe7a3';
      s.glow(155, 73, g);
      s.glow(183, 73, g);
    }
  }

  // lantern on the floor
  s.box(92, 86, 8, 7, '#3b3437');
  s.glowRect(94, 87, 4, 4, '#ffd98a');
  s.hline(93, 85, 6, '#3b3437');

  lightScene(
    s,
    [
      { x: 100, y: 30, r: 100, c: MOONLIGHT, k: 0.6 },
      { x: 96, y: 86, r: 120, c: CANDLE, k: 1.1 },
    ],
    [0.36, 0.32, 0.4]
  );
}

/* ---------- side B: the back room ---------- */

function drawBackRoom(s: Scene, step: number, t: number) {
  roofAndWall(s, false, true);

  // writing desk
  s.box(12, 66, 54, 4, C.woodL);
  s.box(14, 70, 16, 22, C.wood);
  s.hline(16, 76, 12, '#5a3a2c');
  s.hline(16, 83, 12, '#5a3a2c');
  s.vline(62, 70, 22, C.wood);
  // tag, inkpot, candle
  s.rect(36, 61, 9, 5, C.paper);
  s.set(36, 61, '#8a6a45');
  s.line(36, 61, 32, 57, '#8a6a45');
  s.rect(48, 62, 4, 4, '#2a2a3a');
  s.line(51, 62, 54, 55, '#efe3cb');
  candle(s, 20, 66, '#efe3cb', true, t, 7);

  // wall clock with pendulum
  const cx = 100;
  const cy = 30;
  s.box(90, 18, 20, 42, '#5a3a2c');
  s.box(92, 42, 16, 16, '#6b4633');
  const swing = step >= 3 ? Math.round(Math.sin(t * 3) * 3) : 0;
  s.line(100, 44, 100 + swing, 53, '#c49a4e');
  s.disc(100 + swing, 54, 2, '#c49a4e');
  const [h, m] = step >= 3 ? [9, 15] : [3, 40];
  clockFace(s, cx, cy, 9, h, m);
  if (step >= 3) {
    s.rect(93, 58, 14, 3, C.paper);
    s.hline(95, 59, 10, '#3a2a26');
  }

  // hat box
  const hx = 72;
  s.box(hx + 2, 76, 28, 16, '#d8c7a6');
  for (let x = hx + 4; x < hx + 30; x += 4) s.vline(x, 77, 14, '#b8674f');
  if (step >= 2) {
    s.box(hx + 18, 86, 16, 6, '#d8c7a6');
    s.rect(hx + 6, 74, 18, 3, '#a84f4b');
    s.disc(hx + 14, 74, 2, C.brass);
  } else {
    s.box(hx, 72, 32, 5, '#e6d6b8');
    for (let i = 0; i < 4; i++) s.rect(hx + 8 + i * 5, 73, 3, 3, C.brass);
  }

  // bookshelf
  const bx = 138;
  s.box(bx, 28, 54, 64, '#4d3224');
  const cols = ['#7a5068', '#4f6583', '#d09a3e', '#8a9a72', '#b8674f', '#efe3cb'];
  for (let sh = 0; sh < 3; sh++) {
    const sy = 31 + sh * 20;
    s.rect(bx + 2, sy + 17, 50, 2, '#6b4633');
    let x = bx + 3;
    let k = sh * 4;
    while (x < bx + 50) {
      const w = 3 + (k % 3);
      const hh = 12 + ((k * 5) % 5);
      const c = cols[k % cols.length];
      s.rect(x, sy + 17 - hh, Math.min(w, bx + 51 - x), hh, c);
      s.hline(x, sy + 19 - hh, Math.min(w, bx + 51 - x), mix(c, '#ffffff', 0.25));
      x += w + (k % 4 === 0 ? 1 : 0);
      k++;
    }
  }
  // the gold-lettered spines (2 and 4) catch the candle light
  s.glow(bx + 16, 40, '#f1d27a');
  s.glow(bx + 34, 60, '#f1d27a');

  lightScene(
    s,
    [
      { x: 21, y: 57, r: 150, c: CANDLE, k: 1.1 },
      { x: 180, y: 10, r: 80, c: MOONLIGHT, k: 0.4 },
    ],
    [0.34, 0.3, 0.36]
  );
}

