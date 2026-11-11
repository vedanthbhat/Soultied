// Writes every question card (the same registry as src/letters/cards.ts) to a JSON file for the
// iPhone app, so both apps always ask the same questions with the same ids.
//   node --experimental-strip-types scripts/native-decks.mjs [out.json]
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || join(root, 'native/SoultiedCore/Sources/SoultiedCore/Resources/decks.json');
const deck = async (name) => import(join(root, 'src/letters', name + '.ts'));

const { THIS_OR_THAT } = await deck('deckThisOrThat');
const { KNOW_ME } = await deck('deckKnowMe');
const { CONNECT } = await deck('deckConnect');
const { AFTER_DARK } = await deck('deckAfterDark');
const { HOT } = await deck('deckHot');
const { DISTANCE } = await deck('deckDistance');
const { OPEN } = await deck('deckOpen');
const { LIKELY } = await deck('deckLikely');
const { FLIRT } = await deck('deckFlirt');
const { TAKES, TAKE_OPTIONS } = await deck('deckTakes');
const { JOURNEY, JOURNEY_DAYS } = await deck('deckJourney');

const cards = [];
const add = (c) => cards.push({ style: 'choice', ...c });
// [prompt] in your own words · [a, b] or [a, b, prompt] this or that · [prompt, a, b, c, d] four options
function fromTuple(x, id, kind, four) {
  if (x.length === 1) return add({ id, kind, style: 'open', prompt: x[0], options: [], guess: false, note: false });
  if (x.length === 5) return add({ id, kind, prompt: x[0], options: x.slice(1), ...four });
  return add({ id, kind, prompt: x[2] || 'This or that?', options: [x[0], x[1]], guess: false, note: false });
}
THIS_OR_THAT.forEach((x, i) => fromTuple(x, `tot-${i}`, 'tot', { guess: false, note: false }));
KNOW_ME.forEach((x, i) => fromTuple(x, `know-${i}`, 'know', { guess: true, note: false }));
CONNECT.forEach((x, i) => fromTuple(x, `con-${i}`, 'connect', { guess: false, note: true }));
AFTER_DARK.forEach((x, i) => fromTuple(x, `ad-${i}`, 'spicy', { guess: false, note: false }));
HOT.forEach((x, i) => fromTuple(x, `hot-${i}`, 'hot', { guess: false, note: false }));
DISTANCE.forEach((x, i) => fromTuple(x, `far-${i}`, 'distance', { guess: true, note: false }));
OPEN.forEach((x, i) => fromTuple(x, `open-${i}`, 'open', { guess: false, note: false }));
FLIRT.forEach((x, i) => add({ id: `fl-${i}`, kind: 'flirt', prompt: x.q || 'This or that?', options: [...x.o], guess: false, note: false, talk: x.talk }));
TAKES.forEach((take, i) => add({ id: `tk-${i}`, kind: 'take', prompt: take, options: [...TAKE_OPTIONS], guess: true, note: false }));
LIKELY.forEach((ending, i) =>
  add({ id: `lk-${i}`, kind: 'likely', style: 'likely', prompt: `Who’s more likely to ${ending}?`, options: ['Me', 'You'], guess: false, note: false })
);
JOURNEY.flatMap((ch) => ch.questions).forEach(([p, a, b, c, d], i) =>
  add({
    id: `jr-${i}`,
    kind: 'journey',
    prompt: p,
    options: [a, b, c, d],
    guess: true,
    note: true,
    ...(i === JOURNEY_DAYS - 1 ? { noteLabel: 'Write them a letter about this month', noteMax: 600 } : {}),
  })
);

const chapters = JOURNEY.map((ch) => ({ title: ch.title, blurb: ch.blurb, days: ch.questions.length }));
writeFileSync(out, JSON.stringify({ cards, chapters, journeyDays: JOURNEY_DAYS }));
console.log(`wrote ${cards.length} cards to ${out.replace(root + '/', '')}`);
