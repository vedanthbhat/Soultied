/**
 * Little 7×7 symbols used on locks and clues (moon, anchor, bat…).
 * '#' is the symbol colour, '.' is transparent.
 */
export const GLYPHS = {
  moon: ['..###..', '.##....', '##.....', '##.....', '##.....', '.##....', '..###..'],
  star: ['...#...', '...#...', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'],
  heart: ['.......', '.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  anchor: ['...#...', '..#.#..', '...#...', '.#####.', '...#...', '#..#..#', '.#####.'],
  rose: ['.#.#.#.', '..###..', '.#####.', '..###..', '...#...', '.#.#...', '..###..'],
  bird: ['.......', '.......', '##...##', '..#.#..', '...#...', '.......', '.......'],
  bat: ['.......', '#.....#', '##.#.##', '#######', '.#.#.#.', '.......', '.......'],
  key: ['.......', '.##....', '#..####', '#..#.#.', '.##..#.', '.......', '.......'],
  feather: ['.....##', '....###', '...###.', '..###..', '.###...', '.#.....', '#......'],
  crown: ['.......', '#..#..#', '##.#.##', '#######', '#######', '.......', '.......'],
  sun: ['...#...', '.#...#.', '..###..', '#.###.#', '..###..', '.#...#.', '...#...'],
  comet: ['......#', '.....#.', '..###..', '.####..', '#####..', '.###...', '.......'],
  up: ['...#...', '..###..', '.#####.', '...#...', '...#...', '...#...', '...#...'],
  down: ['...#...', '...#...', '...#...', '...#...', '.#####.', '..###..', '...#...'],
} as const;

export type GlyphId = keyof typeof GLYPHS;

export const GLYPH_NAME: Record<GlyphId, string> = {
  moon: 'moon',
  star: 'star',
  heart: 'heart',
  anchor: 'anchor',
  rose: 'rose',
  bird: 'bird',
  bat: 'bat',
  key: 'key',
  feather: 'feather',
  crown: 'crown',
  sun: 'sun',
  comet: 'comet',
  up: 'up',
  down: 'down',
};

export type ColorId = 'red' | 'gold' | 'blue' | 'green' | 'white' | 'violet';

export const COLORS: Record<ColorId, { hex: string; dark: string; label: string }> = {
  red: { hex: '#c4453f', dark: '#8f2f2b', label: 'Red' },
  gold: { hex: '#e2b359', dark: '#a7772b', label: 'Gold' },
  blue: { hex: '#4f78b8', dark: '#344f7c', label: 'Blue' },
  green: { hex: '#5f9a5a', dark: '#3f6a3b', label: 'Green' },
  white: { hex: '#efe6d2', dark: '#b9ad95', label: 'White' },
  violet: { hex: '#8a5fb0', dark: '#5e3f7a', label: 'Violet' },
};
