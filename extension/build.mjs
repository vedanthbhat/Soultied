// Builds the Soultied browser extension.
//   npm run build:extension        -> extension/dist (load it with "Load unpacked")
//   npm run build:extension:store  -> extension/dist-store + extension/soultied-extension-<version>.zip,
//                                     the package for the Chrome Web Store: it only talks to Soultied's
//                                     real addresses (no AI Studio previews, no localhost).
import { build } from 'esbuild';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, deflateSync } from 'node:zlib';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const STORE = process.argv.includes('--store');
const out = path.join(here, STORE ? 'dist-store' : 'dist');

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'icons'), { recursive: true });
await mkdir(path.join(out, 'fonts'), { recursive: true });

await build({
  entryPoints: {
    background: path.join(here, 'src/background.ts'),
    bridge: path.join(here, 'src/bridge.ts'),
    player: path.join(here, 'src/player/main.ts'),
    'netflix-main': path.join(here, 'src/netflix-main.ts'),
    popup: path.join(here, 'src/popup.ts'),
  },
  bundle: true,
  format: 'iife',
  target: 'chrome116',
  outdir: out,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'info',
});

const manifest = JSON.parse(await readFile(path.join(here, 'manifest.json'), 'utf8'));
if (STORE) {
  for (const cs of manifest.content_scripts) {
    if (!cs.js.includes('bridge.js')) continue;
    cs.matches = cs.matches.filter((m) => !/run\.app|localhost|127\.0\.0\.1/.test(m));
    delete cs.all_frames; // only needed inside the AI Studio preview frame
  }
}
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await copyFile(path.join(root, 'public/fonts/PixelifySans-Variable.ttf'), path.join(out, 'fonts/PixelifySans-Variable.ttf'));
// the toolbar window (popup.js draws everything in it)
await writeFile(
  path.join(out, 'popup.html'),
  '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Soultied</title></head><body><script src="popup.js"></script></body></html>\n',
);
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
/** `pad` pixels of clear space on each side (the store wants 96x96 art inside the 128 icon). */
function png(size, pad = 0) {
  const scale = (size - pad * 2) / 16;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - pad) / scale);
      const gy = Math.floor((y - pad) / scale);
      const c = (gx >= 0 && gx < 16 && gy >= 0 && gy < 16 && COLORS[HEART[gy][gx]]) || [0, 0, 0, 0];
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
for (const size of [16, 32, 48]) await writeFile(path.join(out, `icons/${size}.png`), png(size));
await writeFile(path.join(out, 'icons/128.png'), png(128, 16));

console.log(`\nSoultied extension built in ${path.relative(root, out)}/`);

/* ---------- the store package: a plain zip with manifest.json at the top ---------- */

async function files(dir, base = '') {
  const list = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) list.push(...(await files(path.join(dir, e.name), rel)));
    else list.push(rel);
  }
  return list.sort();
}

async function zip(dir) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const name of await files(dir)) {
    const data = await readFile(path.join(dir, name));
    const packed = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4); // version needed
    head.writeUInt16LE(0x0800, 6); // utf-8 names
    head.writeUInt16LE(8, 8); // deflate
    head.writeUInt16LE(0, 10); // time
    head.writeUInt16LE(33, 12); // date: 1980-01-01, so the same code gives the same zip
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(packed.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(nameBuf.length, 26);
    head.writeUInt16LE(0, 28);
    locals.push(head, nameBuf, packed);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt16LE(0, 12);
    cen.writeUInt16LE(33, 14);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(packed.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(nameBuf.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, nameBuf);
    offset += head.length + nameBuf.length + packed.length;
  }
  const cenSize = central.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(cenSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

if (STORE) {
  const name = `soultied-extension-${manifest.version}.zip`;
  await writeFile(path.join(here, name), await zip(out));
  console.log(`Store package: extension/${name}`);
}
