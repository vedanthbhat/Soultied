import React, { useEffect, useRef } from 'react';

/** Tiny ASCII sprites drawn crisp onto a canvas. '.' is transparent. */

interface Sprite {
  rows: string[];
  pal: Record<string, string>;
}

const INK = '#3a2a26';

export const SPRITES = {
  envelope: {
    rows: [
      '###############',
      '##ooooooooooo##',
      '#o#ooooooooo#o#',
      '#oo#ooooooo#oo#',
      '#ooo##ooo##ooo#',
      '#ooooo#r#ooooo#',
      '#ooooorrrooooo#',
      '#ooooooroooooo#',
      '#ooooooooooooo#',
      '#sssssssssssss#',
      '###############',
    ],
    pal: { '#': INK, o: '#f4e8d0', s: '#d6c29c', r: '#a84f4b' },
  },
  seal: {
    rows: ['..rrrrr..', '.rrrrrrr.', 'rrllrllrr', 'rrlllllrr', 'rrrlllrrr', 'rrrrlrrrr', 'rrrrrrrrr', '.rrrrrrr.', '..ddddd..'],
    pal: { r: '#a84f4b', l: '#e8a39a', d: '#7f3835' },
  },
  flame: {
    rows: ['...r...', '..rr...', '..rrr..', '.rryrr.', '.ryyyr.', 'rryyyrr', 'ryywyyr', 'ryywwyr', '.rrrrr.'],
    pal: { r: '#c4453f', y: '#e2b359', w: '#fff1c2' },
  },
  flameOut: {
    rows: ['...g...', '..gg...', '..ggg..', '.gg.gg.', '.g...g.', 'gg...gg', 'g.....g', 'g.....g', '.ggggg.'],
    pal: { g: '#b9a98f' },
  },
  moon: {
    rows: ['..mmmm..', '.mmm....', 'mmm...s.', 'mmm.....', 'mmm..s..', 'mmm.....', '.mmm....', '..mmmm..'],
    pal: { m: '#e9d7b7', s: '#f6e7a8' },
  },
  heart: {
    rows: ['.##.##.', '#######', '#h#####', '.#####.', '..###..', '...#...'],
    pal: { '#': '#d9534f', h: '#f3a19c' },
  },
  heartEmpty: {
    rows: ['.##.##.', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'],
    pal: { '#': '#b9a98f' },
  },
  check: {
    rows: ['......g', '.....gg', 'g...gg.', 'gg.gg..', '.ggg...', '..g....'],
    pal: { g: '#5f7a45' },
  },
  cross: {
    rows: ['x....x', '.x..x.', '..xx..', '..xx..', '.x..x.', 'x....x'],
    pal: { x: '#a84f4b' },
  },
  lock: {
    rows: ['..kkk..', '.k...k.', '.k...k.', 'kkkkkkk', 'kkk.kkk', 'kkk.kkk', 'kkkkkkk'],
    pal: { k: '#7a5a48' },
  },
  couch: {
    rows: ['..ccccccc..', '.cCCCCCCCc.', 'aacccccccaa', 'aaCCCCCCCaa', 'aakkkkkkkaa', '.d.......d.'],
    pal: { c: '#b8674f', C: '#cc7c62', a: '#95513e', k: '#763f31', d: '#5a3a2c' },
  },
  stitch: {
    rows: ['y.y.y.y', '.y.y.y.', 'y.y.y.y'],
    pal: { y: '#b48c4a' },
  },
  spool: {
    rows: ['wwwwwww', '.ttttt.', '.tTtTt.', '.ttttt.', '.tTtTt.', '.ttttt.', 'wwwwwww'],
    pal: { w: '#9a6a43', t: '#a84f4b', T: '#d07a70' },
  },
  book: {
    rows: ['#########.', '#ccccccc#p', '#cyyyyyc#p', '#ccccccc#p', '#cyyyyyc#p', '#ccccccc#p', '#cccchcc#p', '#########p', '.pppppppp.'],
    pal: { '#': INK, c: '#b8674f', y: '#efdcb8', h: '#f3a19c', p: '#f4e8d0' },
  },
} satisfies Record<string, Sprite>;

export type SpriteName = keyof typeof SPRITES;

export const PixelIcon: React.FC<{
  name: SpriteName;
  scale?: number;
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ name, scale = 3, label, className = '', style }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const sprite: Sprite = SPRITES[name];
  const w = Math.max(...sprite.rows.map((r) => r.length));
  const h = sprite.rows.length;

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, w, h);
    sprite.rows.forEach((row, y) =>
      [...row].forEach((k, x) => {
        const col = sprite.pal[k];
        if (!col) return;
        ctx.fillStyle = col;
        ctx.fillRect(x, y, 1, 1);
      }),
    );
  }, [sprite, w, h]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      className={`pixelated inline-block shrink-0 ${className}`}
      style={{ width: w * scale, height: h * scale, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
};
