// Draws the iPhone app's pictures from the pixel heart (public/favicon.svg), so the repo only holds text:
//   ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png   the home-screen icon (1024 x 1024)
//   ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732*.png    what shows while the app opens
// and copies the pixel font next to the offline page (ios-web/fonts).
// Needs sharp, which only the iPhone build installs: npm i --no-save sharp && npm run ios:assets
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { default: sharp } = await import('sharp');

const heart = readFileSync(join(root, 'public/favicon.svg'));
const PAPER = '#f4e8d0';
const ROOM = '#1d1512';

/** the 16 x 16 heart, blown up with hard pixel edges */
const pixelHeart = (size) => sharp(heart, { density: 72 }).resize(16, 16).resize(size, size, { kernel: 'nearest' }).png().toBuffer();

async function square(size, background, heartSize, out) {
  mkdirSync(dirname(out), { recursive: true });
  const h = await pixelHeart(heartSize);
  const at = Math.round((size - heartSize) / 2);
  await sharp({ create: { width: size, height: size, channels: 3, background } })
    .composite([{ input: h, left: at, top: at + Math.round(heartSize / 32) }])
    .flatten({ background })
    .removeAlpha()
    .png()
    .toFile(out);
  console.log('drew', out.replace(root + '/', ''));
}

const assets = join(root, 'ios/App/App/Assets.xcassets');
// the icon: the heart on the cards' paper colour (no transparency: the App Store refuses it)
await square(1024, PAPER, 640, join(assets, 'AppIcon.appiconset/AppIcon-512@2x.png'));
// the opening screen: a small heart on the room's dark brown
for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'])
  await square(2732, ROOM, 320, join(assets, 'Splash.imageset', name));

mkdirSync(join(root, 'ios-web/fonts'), { recursive: true });
copyFileSync(join(root, 'public/fonts/PixelifySans-Variable.ttf'), join(root, 'ios-web/fonts/PixelifySans-Variable.ttf'));
console.log('copied the pixel font for the offline page');
