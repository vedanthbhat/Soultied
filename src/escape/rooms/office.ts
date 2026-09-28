import { Scene, SW, planks, lightScene, WARM } from '../scene';
import type { RoomDef } from '../types';

const MAP_CELLS = [
  'Lighthouse',
  'Fish market',
  'Tram depot',
  'Harbour office',
  'Customs house',
  'Old fort',
  'Tea stall',
  'Cinema',
  'Pier 5',
  'Boat yard',
  'Library',
  'Bakery',
  'Post office',
  'Pier 7',
  'Ice factory',
  'Church',
  'Tailor',
  'Bank',
  'Hotel',
  'Railway yard',
  'Park',
  'Detective’s office',
  'Bookshop',
  'Barber',
  'Station',
];

export const OFFICE: RoomDef = {
  id: 'office',
  title: 'The Detective’s Office',
  tagline: 'A missing emerald, a rainy night.',
  mood: 'Noir mystery',
  accent: '#6f8fc4',
  minutes: 15,
  intro:
    'Bombay, 1947. The Duchess’s emerald necklace vanished during last night’s party, and the detective on the case has vanished too, leaving his office unlocked. One of you is at his desk. The other is in the evidence room across the hall. Crack the case before the rain stops.',
  sides: {
    a: { name: 'The desk', blurb: 'Rain on the window, a filing cabinet and a city map.' },
    b: { name: 'The evidence room', blurb: 'A corkboard of suspects, a coat and a table of evidence.' },
  },
  objects: [
    // --- side A: the desk ---
    {
      id: 'window',
      side: 'a',
      label: 'Rainy window',
      rect: { x: 6, y: 8, w: 44, h: 44 },
      views: [{ from: 0, text: 'Rain streaks down the glass. Across the street, a neon sign flickers: HOTEL.' }],
    },
    {
      id: 'cabinet',
      side: 'a',
      label: 'Filing cabinet',
      rect: { x: 8, y: 54, w: 34, h: 39 },
      views: [
        { from: 0, puzzle: 'cabinet', text: 'A steel filing cabinet with a four-number lock.' },
        {
          from: 1,
          clue: {
            kind: 'note',
            title: 'The case file',
            text: 'Three facts I’m sure of:\n1. The ransom note was written left-handed.\n2. The doorman saw the thief wearing a hat.\n3. The thief has no alibi for nine o’clock.',
            sign: '— the detective',
          },
        },
      ],
    },
    {
      id: 'safe',
      side: 'a',
      label: 'Wall safe',
      rect: { x: 60, y: 14, w: 30, h: 30 },
      views: [
        { from: 0, puzzle: 'safe', text: 'A small wall safe with a four-number dial.' },
        {
          from: 3,
          clue: {
            kind: 'letters',
            title: 'A note in the safe',
            text: '“Her lucky word opens her handbag. I only got half of it:”',
            letters: [
              [1, 'L'],
              [2, null],
              [3, 'C'],
              [4, null],
            ],
          },
        },
      ],
    },
    {
      id: 'typewriter',
      side: 'a',
      label: 'Typewriter',
      rect: { x: 66, y: 56, w: 34, h: 14 },
      views: [{ from: 0, text: 'A half-typed report: “The Duchess’s emerald was taken between 8 and 10 p.m. by someone at the party…”' }],
    },
    {
      id: 'map',
      side: 'a',
      label: 'City map',
      rect: { x: 148, y: 10, w: 48, h: 50 },
      views: [
        { from: 0, puzzle: 'map', text: 'A big map of the city under glass. The detective’s office is circled.' },
        { from: 5, text: 'Pier 7, circled in red.' },
      ],
    },
    // --- side B: the evidence room ---
    {
      id: 'coat',
      side: 'b',
      label: 'Trench coat',
      rect: { x: 8, y: 14, w: 28, h: 79 },
      views: [{ from: 0, clue: { kind: 'note', title: 'A matchbook in the coat pocket', text: 'CAFÉ BLUE\nopen late\ncabinet: 5 0 7 3', sign: 'scribbled inside the flap' } }],
    },
    {
      id: 'board',
      side: 'b',
      label: 'Suspect board',
      rect: { x: 44, y: 8, w: 78, h: 50 },
      views: [
        { from: 0, puzzle: 'suspects', text: 'Four suspects pinned to a corkboard with red string.' },
        {
          from: 2,
          clue: { kind: 'note', title: 'Taped behind Miss Kapoor’s photo', text: 'PAWN TICKET\nNo. 2804', sign: 'Grant Road Pawn Shop' },
        },
      ],
    },
    {
      id: 'handbag',
      side: 'b',
      label: 'Handbag',
      rect: { x: 128, y: 58, w: 30, h: 20 },
      views: [
        { from: 0, puzzle: 'handbag', text: 'Miss Kapoor’s beaded handbag, locked with four letter wheels.' },
        {
          from: 4,
          clue: {
            kind: 'note',
            title: 'Folded inside the handbag',
            text: 'From the detective’s office:\n3 blocks north,\n2 blocks east,\n1 block south.',
            sign: 'in Miss Kapoor’s writing',
          },
        },
      ],
    },
    {
      id: 'ticket',
      side: 'b',
      label: 'Evidence box',
      rect: { x: 162, y: 60, w: 30, h: 18 },
      views: [
        {
          from: 0,
          clue: {
            kind: 'letters',
            title: 'A torn cinema ticket in the evidence box',
            text: 'Someone doodled on the back, but the paper is torn. You can make out:',
            letters: [
              [1, null],
              [2, 'U'],
              [3, null],
              [4, 'K'],
            ],
          },
        },
      ],
    },
  ],
  puzzles: [
    {
      id: 'cabinet',
      side: 'a',
      title: 'The filing cabinet',
      prompt: 'Four number wheels.',
      lock: { kind: 'digits', length: 4 },
      answer: '5073',
      hints: ['Detectives write things down everywhere. Check his coat in the evidence room.', 'There’s a matchbook in the coat pocket.', 'The code is 5 · 0 · 7 · 3.'],
      solved: 'The top drawer slides out: the case file, with the three facts the detective was sure of.',
    },
    {
      id: 'suspects',
      side: 'b',
      title: 'Who did it?',
      prompt: 'Pick the suspect who matches every fact in the case file.',
      lock: {
        kind: 'choice',
        options: [
          { id: 'rao', label: 'Mr. Rao', lines: ['Left-handed', 'Always wears a hat', 'At the docks at nine (three sailors saw him)'] },
          { id: 'fernandes', label: 'Mrs. Fernandes', lines: ['Right-handed', 'Wears a hat', 'No alibi at nine'] },
          { id: 'singh', label: 'Captain Singh', lines: ['Left-handed', 'Never wears hats', 'No alibi at nine'] },
          { id: 'kapoor', label: 'Miss Kapoor', lines: ['Left-handed', 'Wears a hat', 'No alibi at nine'] },
        ],
      },
      answer: 'kapoor',
      hints: [
        'The case file in the desk has three facts. Check each suspect against them.',
        'Left-handed, wore a hat, no alibi at nine. Only one suspect matches all three.',
        'Miss Kapoor.',
      ],
      solved: 'You pull Miss Kapoor’s photo off the board. Taped behind it: a pawn ticket.',
    },
    {
      id: 'safe',
      side: 'a',
      title: 'The wall safe',
      prompt: 'Four numbers on the dial.',
      lock: { kind: 'digits', length: 4 },
      answer: '2804',
      hints: ['The detective hid the safe code with the suspect.', 'Read the pawn ticket found behind Miss Kapoor’s photo.', 'The code is 2 · 8 · 0 · 4.'],
      solved: 'The safe swings open. Inside: a note about Miss Kapoor’s lucky word, and only half of it.',
    },
    {
      id: 'handbag',
      side: 'b',
      title: 'The beaded handbag',
      prompt: 'Four letter wheels. Her lucky word.',
      lock: { kind: 'letters', length: 4 },
      answer: 'LUCK',
      hints: [
        'You each have half of the word.',
        'The note in the safe gives letters 1 and 3. The cinema ticket in the evidence box gives 2 and 4.',
        'LUCK.',
      ],
      solved: 'The handbag clicks open. Inside: directions in Miss Kapoor’s handwriting.',
    },
    {
      id: 'map',
      side: 'a',
      title: 'Where is the emerald?',
      prompt: 'Follow the directions from the detective’s office and tap where you end up.',
      lock: { kind: 'map', cols: 5, cells: MAP_CELLS, start: 21 },
      answer: '13',
      hints: [
        'Your partner has directions from the handbag. Start at the detective’s office on the map.',
        'Office → 3 north → 2 east → 1 south.',
        'Pier 7.',
      ],
      solved: 'You circle Pier 7 and pick up the phone.',
    },
  ],
  ending: {
    title: 'Case closed',
    text: 'At dawn the harbour police open locker 12 at Pier 7: the Duchess’s emerald, wrapped in a cinema ticket. Miss Kapoor is arrested before breakfast. A week later a postcard arrives from Goa: “Knew you two would crack it. — the detective.”',
  },
  draw: (s, side, step, t) => (side === 'a' ? drawDesk(s, step, t) : drawEvidence(s, step, t)),
};

/* ---------- side A: the desk ---------- */

function wallpaper(s: Scene, a: string, b: string) {
  for (let y = 0; y < 92; y++) for (let x = 0; x < SW; x++) s.set(x, y, (x + (y >> 2)) % 10 < 5 ? a : b);
  s.rect(0, 84, SW, 8, '#2a2230');
  s.hline(0, 84, SW, '#3d3346');
}

function drawDesk(s: Scene, step: number, t: number) {
  wallpaper(s, '#3b3f55', '#373a4f');
  planks(s, 92, '#4a3526', '#43301f', '#2a1c14');

  // rainy window with a neon glow
  s.box(6, 8, 44, 44, '#2a2230');
  for (let y = 10; y < 50; y++)
    for (let x = 8; x < 48; x++) {
      const neon = x > 30 && y > 28 && y < 34;
      s.glow(x, y, neon ? (Math.sin(t * 7) > -0.6 ? '#c4453f' : '#5a2a2a') : y < 30 ? '#1b2238' : '#222a44');
    }
  for (let k = 0; k < 14; k++) {
    const x = 9 + ((k * 7) % 38);
    const y = 10 + ((k * 13 + Math.floor(t * 40)) % 38);
    s.glow(x, y, '#6f86b0');
    s.glow(x, y + 1, '#4f6690');
  }
  s.rect(27, 10, 1, 40, '#2a2230');
  s.rect(8, 29, 40, 1, '#2a2230');
  for (let y = 10; y < 50; y++) s.emit[y * SW + 27] = 0;
  for (let x = 8; x < 48; x++) s.emit[29 * SW + x] = 0;

  // filing cabinet
  s.box(10, 56, 30, 36, '#5c6a6e');
  for (let i = 0; i < 3; i++) {
    s.rect(12, 58 + i * 11, 26, 10, '#6c7a7e');
    s.hline(12, 58 + i * 11, 26, '#83929a');
    s.rect(22, 62 + i * 11, 6, 2, '#c49a4e');
  }
  if (step >= 1) {
    s.rect(12, 58, 26, 3, '#2a3033');
    s.rect(15, 55, 18, 4, '#e6d6b8');
  }

  // wall safe
  s.box(62, 16, 26, 26, '#4a4c4e');
  if (step >= 3) {
    s.rect(64, 18, 22, 22, '#1e1c1e');
    s.rect(66, 32, 10, 6, '#e6d6b8');
    s.box(84, 16, 6, 26, '#5a5c5e');
  } else {
    s.disc(75, 29, 7, '#6a6c6e');
    s.disc(75, 29, 2, '#2a2a2a');
    for (let a = 0; a < 8; a++) s.set(Math.round(75 + Math.cos(a * 0.785) * 5), Math.round(29 + Math.sin(a * 0.785) * 5), '#c49a4e');
  }

  // desk, typewriter, green lamp, mug
  s.box(58, 70, 96, 5, '#5a3a2c');
  s.box(60, 75, 20, 17, '#4d3224');
  s.box(132, 75, 20, 17, '#4d3224');
  s.box(68, 62, 30, 8, '#2f2f33');
  s.rect(72, 56, 22, 7, '#efe3cb');
  s.hline(74, 58, 16, '#8a8070');
  s.hline(74, 60, 12, '#8a8070');
  for (let i = 0; i < 6; i++) s.set(71 + i * 4, 66, '#9a9aa0');
  // banker's lamp
  s.vline(118, 60, 10, '#c49a4e');
  s.rect(112, 56, 14, 4, '#2f6a4a');
  s.glowRect(113, 60, 12, 1, '#fff1c2');
  s.rect(137, 64, 5, 6, '#e6d6b8');

  // city map on the wall
  s.box(150, 12, 44, 46, '#3a2a26');
  s.rect(152, 14, 40, 42, '#d9ccb0');
  for (let i = 0; i <= 5; i++) {
    s.vline(152 + i * 8, 14, 42, '#b8a888');
    s.hline(152, 14 + Math.round(i * 8.4), 40, '#b8a888');
  }
  s.rect(152, 14, 8, 42, '#8fb0c8'); // the sea on the left edge
  s.frame(159, 47, 9, 9, '#a84f4b');
  if (step >= 5) s.frame(175, 30, 9, 9, '#c4453f');

  lightScene(
    s,
    [
      { x: 119, y: 62, r: 95, c: [0.85, 1.0, 0.75], k: 1.0 },
      { x: 28, y: 30, r: 60, c: [0.6, 0.7, 1.05], k: 0.6 },
      { x: 42, y: 32, r: 40, c: [1.1, 0.5, 0.5], k: 0.5 },
    ],
    [0.22, 0.22, 0.3]
  );
}

/* ---------- side B: the evidence room ---------- */

function drawEvidence(s: Scene, step: number, t: number) {
  for (let y = 0; y < 92; y++) for (let x = 0; x < SW; x++) s.set(x, y, (x * 3 + y * 5) % 23 === 0 ? '#5d5a58' : '#686462');
  s.rect(0, 84, SW, 8, '#3a3634');
  planks(s, 92, '#4a4644', '#434040', '#2a2828');

  // lamp hanging from the ceiling
  s.vline(100, 0, 4, '#2a2828');
  s.rect(94, 4, 13, 3, '#2f3a3a');
  s.glowRect(96, 7, 9, 1, '#fff1c2');

  // coat rack
  s.vline(22, 14, 78, '#4d3224');
  s.hline(15, 91, 15, '#4d3224');
  s.hline(16, 16, 13, '#4d3224');
  for (let j = 0; j < 44; j++) {
    const half = 6 + Math.floor(j / 7);
    s.hline(22 - half, 22 + j, half * 2, j % 11 === 0 ? '#8a7454' : '#9a8460');
  }
  s.rect(15, 12, 14, 3, '#3a3634');
  s.rect(17, 8, 10, 5, '#3a3634');
  s.rect(24, 38, 3, 4, '#c4453f');

  // corkboard with suspects and red string
  s.box(46, 10, 74, 46, '#5a3a2c');
  s.rect(48, 12, 70, 42, '#b8895a');
  const spots = [
    [52, 16],
    [70, 18],
    [88, 16],
    [106, 18],
  ];
  spots.forEach(([x, y], i) => {
    if (i === 3 && step >= 2) {
      s.rect(x, y, 10, 13, '#efe3cb');
      s.hline(x + 2, y + 5, 6, '#8a8070');
      return;
    }
    s.rect(x, y, 10, 13, '#e6d6b8');
    s.rect(x + 2, y + 2, 6, 6, ['#6b5a4a', '#8a6a5a', '#5a4a3a', '#7a5a4a'][i]);
    s.rect(x + 1, y + 1, 8, 2, i === 2 ? '#e6d6b8' : '#2f2f33');
    s.set(x + 5, y, '#c4453f');
  });
  s.line(57, 17, 111, 19, '#c4453f');
  s.line(75, 19, 93, 40, '#c4453f');
  s.rect(58, 38, 16, 10, '#efe3cb');
  s.rect(80, 40, 22, 9, '#efe3cb');

  // evidence table
  s.box(124, 76, 72, 4, '#5a3a2c');
  s.vline(128, 80, 12, '#4d3224');
  s.vline(191, 80, 12, '#4d3224');
  // handbag
  s.rect(132, 66, 22, 10, '#6a2f4a');
  for (let x = 132; x < 154; x += 2) s.set(x, 67, '#c49a4e');
  s.line(135, 66, 143, 60, '#3a2a26');
  s.line(143, 60, 151, 66, '#3a2a26');
  if (step >= 4) s.rect(139, 64, 8, 3, '#efe3cb');
  else for (let i = 0; i < 4; i++) s.rect(135 + i * 4, 70, 3, 4, '#c49a4e');
  // evidence box
  s.box(164, 66, 26, 10, '#c8b089');
  s.rect(166, 64, 8, 3, '#e8c787');

  void t;
  lightScene(s, [{ x: 100, y: 8, r: 170, c: WARM, k: 1.0 }], [0.24, 0.24, 0.3]);
}
