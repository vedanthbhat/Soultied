// Builds the Soultied browser extension into extension/dist (load that folder
// in chrome://extensions with "Load unpacked"). Run: npm run build:extension
import { build } from 'esbuild';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const out = path.join(here, 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'icons'), { recursive: true });
await mkdir(path.join(out, 'fonts'), { recursive: true });

await build({
  entryPoints: {
    background: path.join(here, 'src/background.ts'),
    bridge: path.join(here, 'src/bridge.ts'),
    player: path.join(here, 'src/player/main.ts'),
    'netflix-main': path.join(here, 'src/netflix-main.ts'),
  },
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  outdir: out,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info',
});

await copyFile(path.join(here, 'manifest.json'), path.join(out, 'manifest.json'));
await copyFile(path.join(root, 'public/fonts/PixelifySans-Variable.ttf'), path.join(out, 'fonts/PixelifySans-Variable.ttf'));
await copyFile(path.join(root, 'public/fonts/OFL.txt'), path.join(out, 'fonts/OFL.txt'));

/* ---------- the icon: a pixel heart, drawn here so no image files live in the repo ---------- */

const HEART = [
  '................',
  '..####....####..',
  '.#rrrr#..#rrrr#.',
  '#rrhhrr##rrrrrr#',
  '#rhhrrrrrrrrrrr#',
  '#rhrrrrrrrrrrrr#',
  '#rrrrrrrrrrrrrr#',
  '.#rrrrrrrrrrrr#.',
  '..#rrrrrrrrrr#..',
  '...#rrrrrrrr#...',
  '....#rrrrrr#....',
  '.....#rrrr#.....',
  '......#rr#......',
  '.......##.......',
  '................',
  '................',
];
const COLORS = { '#': [43, 30, 28, 255], r: [184, 103, 79, 255], h: [243, 161, 156, 255] };

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size) {
  const scale = size / 16;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const c = COLORS[HEART[Math.floor(y / scale)][Math.floor(x / scale)]] || [0, 0, 0, 0];
      raw.set(c, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
for (const size of [16, 32, 48, 128]) await writeFile(path.join(out, `icons/${size}.png`), png(size));

console.log(`\nSoultied extension built in ${path.relative(root, out)}/`);
