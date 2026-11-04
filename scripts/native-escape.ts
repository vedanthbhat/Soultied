// Writes the escape rooms' words, things to look at and puzzles (src/escape/rooms) to a JSON file for the iPhone
// app, so both apps have the same rooms, word for word. The pictures aren't in it: the app paints each room with
// its own copy of the room's painter (native/SoultiedCore/Sources/SoultiedCore/Escape/EscapeRooms.swift), which
// the app's tests check against these painters pixel for pixel.
//   npx esbuild scripts/native-escape.ts --bundle --platform=node --log-level=warning --outfile=/tmp/escape.cjs && node /tmp/escape.cjs [out.json]
import { writeFileSync } from 'node:fs';
import { ROOMS } from '../src/escape/rooms';

const out = process.argv[2] || 'native/SoultiedCore/Sources/SoultiedCore/Resources/escape.json';
const rooms = ROOMS.map((r) => {
  const { draw, ...words } = r;
  void draw;
  return words;
});
writeFileSync(out, JSON.stringify({ rooms }));
console.log(`wrote ${rooms.length} escape rooms to ${out}`);
