// The scripts the iPhone app puts into its own Netflix / Prime Video browser (native/Soultied/StreamView.swift):
// the extension's player and its two in-page helpers, as they are, plus the app's stand-in for the extension
// API (extension/src/ios). Made before each build, like the questions and the escape rooms:
//   node scripts/native-stream.mjs [out dir]     (default native/Stream; nothing made is kept in git)
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'native/Stream'));
await mkdir(out, { recursive: true });

await build({
  entryPoints: {
    // in the app's own script world, like a content script
    'stream-player': path.join(root, 'extension/src/ios/player.ts'),
    // in the page's world, before the site's code
    'stream-page': path.join(root, 'extension/src/ios/page.ts'),
    'stream-netflix': path.join(root, 'extension/src/netflix-main.ts'),
    'stream-prime': path.join(root, 'extension/src/prime-main.ts'),
  },
  bundle: true,
  format: 'iife',
  target: 'safari17',
  outdir: out,
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'warning',
  loader: { '.ttf': 'dataurl' },
  define: {
    __FIREBASE__: 'null',
    __EMULATOR__: '""',
    'import.meta.env': JSON.stringify({ VITE_TURN_CREDENTIALS_URL: '', VITE_ICE_SERVERS: '' }),
  },
});
console.log(`stream scripts -> ${path.relative(root, out)}`);
