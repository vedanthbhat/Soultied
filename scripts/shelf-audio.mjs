// Gets the record shelf's songs (src/music/shelf.json) ready for the site, before a build: each one is downloaded
// from where its artist put it, its volume evened out to match the jazz record, and saved as a 96 kbps MP3 in
// public/audio/shelf/ that's exactly as long as shelf.json says (the two of you hear the same spot because both
// players count with those lengths). The website plays them from there, and the iPhone app downloads them from
// soultied.app the first time a record goes on.
//
// Needs ffmpeg. On GitHub (CI is set) a song that can't be made stops the build, so the site never goes out with a
// silent record; on your own computer it only warns. Songs that are already made are skipped.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const albums = JSON.parse(fs.readFileSync(new URL('../src/music/shelf.json', import.meta.url)));
const folder = new URL('../public/audio/shelf/', import.meta.url).pathname;
const strict = !!process.env.CI;
// bump this when the way a song is made changes, so every song is made again
const RECIPE = 1;

fs.mkdirSync(folder, { recursive: true });
const tracks = albums.flatMap((album) => album.tracks);

// what's in the folder but no longer on the shelf (the old made-up loops among them) goes
const keep = new Set(tracks.flatMap((t) => [t.slug + '.mp3', t.slug + '.json']));
for (const name of fs.readdirSync(folder)) if (!keep.has(name)) fs.rmSync(path.join(folder, name), { force: true });

// a song's made when its MP3 is there with a note of what it was made from (and how)
const stampOf = (t) => JSON.stringify({ from: t.from, secs: t.secs, recipe: RECIPE });
const isMade = (t) => {
  try {
    return (
      fs.existsSync(path.join(folder, t.slug + '.mp3')) &&
      fs.readFileSync(path.join(folder, t.slug + '.json'), 'utf8') === stampOf(t)
    );
  } catch {
    return false;
  }
};
const todo = tracks.filter((t) => !isMade(t));
if (!todo.length) {
  console.log(`shelf-audio: all ${tracks.length} songs are ready`);
  process.exit(0);
}

const has = (cmd) => spawnSync(cmd, ['-version'], { stdio: 'ignore' }).status === 0;
if (!has('ffmpeg') || !has('ffprobe')) {
  const msg = 'shelf-audio: ffmpeg isn’t installed, so the record shelf’s songs can’t be made';
  if (strict) throw new Error(msg);
  console.warn(msg + ' (the shelf records won’t play in this build)');
  process.exit(0);
}

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${cmd} failed: ${stderr.slice(-600)}`)),
    );
  });
const lengthOf = async (file) =>
  Number(
    (await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file])).stdout.trim(),
  );

// (on your own computer it gives up quickly, so starting the dev server offline isn't held up)
let offline = false;
async function download(url, file) {
  if (offline) throw new Error('skipped: an earlier song couldn’t be downloaded');
  let last;
  for (let attempt = 1; attempt <= (strict ? 3 : 1); attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'Soultied site build (https://soultied.app)' },
        signal: AbortSignal.timeout(strict ? 60_000 : 15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      return;
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
  if (!strict) offline = true;
  throw new Error(`couldn’t download ${url}: ${last?.message ?? last}`);
}

// downloads go in a folder of their own, away from the code
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'soultied-shelf-'));
let made = 0;
let failed = 0;
async function make(t) {
  const out = path.join(folder, t.slug + '.mp3');
  const stampFile = path.join(folder, t.slug + '.json');
  try {
    const src = path.join(scratch, t.slug + '.src.mp3');
    await download(t.from, src);
    // a song much longer or shorter than shelf.json says is the wrong file
    const real = await lengthOf(src);
    if (!(Math.abs(real - t.secs) <= 2)) throw new Error(`it’s ${real.toFixed(2)} s long, not about ${t.secs} s`);
    // the first pass measures how loud it is; the second evens it out to the jazz record's level (about -22 LUFS),
    // pads or trims it to exactly its length with a short fade at the very end, and makes the MP3
    const probe = await run('ffmpeg', [
      '-hide_banner',
      '-nostats',
      '-i',
      src,
      '-af',
      'loudnorm=I=-22:TP=-2:LRA=11:print_format=json',
      '-f',
      'null',
      '-',
    ]);
    const m = JSON.parse(probe.stderr.slice(probe.stderr.lastIndexOf('{')));
    const fadeAt = Math.max(0, t.secs - 1.5);
    const filters = [
      `loudnorm=I=-22:TP=-2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`,
      `apad=whole_dur=${t.secs}`,
      `atrim=0:${t.secs}`,
      `afade=t=out:st=${fadeAt}:d=1.5`,
    ].join(',');
    const tmp = out + '.part';
    await run('ffmpeg', [
      '-hide_banner',
      '-nostats',
      '-y',
      '-i',
      src,
      '-vn',
      '-map_metadata',
      '-1',
      '-af',
      filters,
      '-ar',
      '32000',
      '-ac',
      '2',
      '-c:a',
      'libmp3lame',
      '-b:a',
      '96k',
      '-f',
      'mp3',
      tmp,
    ]);
    const got = await lengthOf(tmp);
    if (!(Math.abs(got - t.secs) <= 0.1)) throw new Error(`the made MP3 is ${got.toFixed(3)} s, not ${t.secs} s`);
    fs.renameSync(tmp, out);
    fs.writeFileSync(stampFile, stampOf(t));
    made++;
    console.log(`shelf-audio: ${t.slug}.mp3 (${t.secs} s, ${(fs.statSync(out).size / 1e6).toFixed(1)} MB)`);
  } catch (e) {
    failed++;
    // (on GitHub, as an error on the run's page, which shows without signing in)
    console.error(
      `${process.env.GITHUB_ACTIONS ? '::error title=Record shelf::' : 'shelf-audio: '}${t.title}: ${e.message}`,
    );
    if (strict) process.exitCode = 1;
  }
}

// a few at a time (each ffmpeg mostly uses one core)
try {
  const queue = [...todo];
  await Promise.all(
    Array.from({ length: Math.min(4, os.cpus().length || 1) }, async () => {
      while (queue.length) await make(queue.shift());
    }),
  );
} finally {
  fs.rmSync(scratch, { recursive: true, force: true });
}
const summary = `${made} made, ${tracks.length - todo.length} already there, ${failed} failed`;
console.log(`shelf-audio: ${summary}`);
if (process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Record shelf songs: ${summary}\n`);
