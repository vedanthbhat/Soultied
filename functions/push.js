/**
 * Notifications on your person's phone: when you seal today's letter, send a hug, make your move, put something
 * on the TV, pin something up, leave a voice note or look after the pet, the app (or soultied.app) asks
 * `pushNote` to tell them. Everything about whether to, and what it says, is decided here:
 *
 *   - their phones: spaces/{sid}/meta/push devices[uid][key] = { token, tz, platform, at } (the iPhone app keeps it)
 *   - what they want to hear about: prefs[uid][group] = false turns a group off (letters, touches, games, watch,
 *     wall, pet)
 *   - not between 11pm and 8am where they are
 *   - not too often: each kind has a gap (per game, per show), remembered in sent[...]
 *
 * The words live here (not in the apps), so a phone on an old version still says the right thing.
 */

/** which switch in the app each kind of notification belongs to */
export const PUSH_GROUP = {
  letter: 'letters',
  ask: 'letters',
  answer: 'letters',
  touch: 'touches',
  turn: 'games',
  live: 'games',
  watch: 'watch',
  wall: 'wall',
  voice: 'wall',
  snap: 'wall',
  pet: 'pet',
};

/** the least time between two of the same (ms) */
export const PUSH_GAP = {
  letter: 20 * 60e3,
  ask: 60e3,
  answer: 60e3,
  touch: 20e3,
  turn: 3 * 60e3,
  live: 2 * 60e3,
  watch: 3 * 3600e3,
  wall: 5 * 60e3,
  voice: 0,
  snap: 6 * 3600e3,
  pet: 6 * 3600e3,
};

/** where a tap takes you in the app */
export const PUSH_OPEN = {
  letter: 'letters',
  ask: 'letters',
  answer: 'letters',
  touch: 'home',
  turn: 'play',
  live: 'play',
  watch: 'watch',
  wall: 'wall',
  voice: 'wall',
  snap: 'home',
  pet: 'pet',
};

const TOUCH_DID = {
  hug: 'hugged you',
  kiss: 'kissed you',
  forehead: 'kissed your forehead',
  highfive: 'high-fived you',
  hands: 'is holding your hand',
  boop: 'booped your nose',
};
const PET_DID = { feed: 'fed', play: 'played with', cuddle: 'cuddled' };
const WALL_WHAT = { text: 'a note', note: 'a note', doodle: 'a doodle', photo: 'a photo' };

/** a short bit of text from an app: no control characters, trimmed, at most `max` characters */
export function clean(v, max = 60) {
  if (typeof v !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** 0:06, 1:20 */
const clock = (secs) => {
  const s = Math.max(0, Math.round(Number(secs) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** What the notification says: { title, body }, or null for something that shouldn't be sent. */
export function pushText(kind, args, name) {
  const n = clean(name, 30) || 'Your person';
  const a = args && typeof args === 'object' ? args : {};
  switch (kind) {
    case 'letter':
      return a.stage === 'open'
        ? { title: 'Your letters are open ✉', body: `See what ${n} wrote.` }
        : { title: 'Today’s letter ✉', body: `${n} sealed theirs. Your turn.` };
    case 'ask': {
      const p = clean(a.prompt, 90);
      return { title: `${n} asked you something`, body: p ? `“${p}”` : 'Answer to see what they said.' };
    }
    case 'answer': {
      const p = clean(a.prompt, 80);
      return { title: `${n} answered`, body: p ? `“${p}”: see what you both said.` : 'See what you both said.' };
    }
    case 'touch': {
      const did = TOUCH_DID[a.touch];
      if (!did) return null;
      return { title: `${n} ${did}${a.reply === true && a.touch !== 'hands' ? ' back' : ''}`, body: '' };
    }
    case 'turn': {
      const g = clean(a.game, 30);
      return { title: g ? `Your move in ${g}` : 'Your move', body: `${n} just played.` };
    }
    case 'live': {
      const g = clean(a.game, 30);
      return { title: `${n} wants to play${g ? ` ${g}` : ''}`, body: 'Right now, together.' };
    }
    case 'watch': {
      const t = clean(a.title, 60);
      return { title: `${n} put something on`, body: t ? `“${t}”: come watch together.` : 'Come watch together.' };
    }
    case 'wall':
      return { title: `${n} pinned ${WALL_WHAT[a.what] || 'something'} up`, body: 'On your wall.' };
    case 'voice':
      return { title: `${n} left you a voice note`, body: Number(a.secs) > 0 ? clock(a.secs) : '' };
    case 'snap':
      return { title: `${n} took today’s photo`, body: 'Take yours to see it.' };
    case 'pet': {
      const did = PET_DID[a.act];
      if (!did) return null;
      const pet = clean(a.pet, 24) || 'your pet';
      return { title: `${n} ${did} ${pet}`, body: 'Your turn to look after them.' };
    }
    default:
      return null;
  }
}

/** the hour (0 to 23) in a time zone, or null for one this server doesn't know */
export function hourIn(tz, now = Date.now()) {
  if (typeof tz !== 'string' || !tz) return null;
  try {
    const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: tz }).format(new Date(now));
    const v = Number.parseInt(h, 10);
    return Number.isFinite(v) ? v % 24 : null;
  } catch {
    return null;
  }
}

/** asleep, probably: 11pm to 8am where they are (anywhere we don't know the time, never) */
export function quietHours(tz, now = Date.now()) {
  const h = hourIn(tz, now);
  return h !== null && (h >= 23 || h < 8);
}

/** a key for "the same thing again": the kind, plus the game or the show where it matters */
export function gapKey(from, kind, args) {
  const a = args && typeof args === 'object' ? args : {};
  const what = kind === 'turn' || kind === 'live' ? clean(a.game, 30) : kind === 'watch' ? clean(a.title, 60) : kind === 'touch' ? clean(a.touch, 12) : '';
  // (map keys in Firestore: letters, digits and _ only)
  const raw = `${from}_${kind}_${what}`;
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) h = Math.imul(h ^ raw.charCodeAt(i), 16777619) >>> 0;
  return `${kind}_${h.toString(36)}`;
}

/**
 * Whether to send, and to which phones: { send: true, tokens, keys } or { send: false, why }. `doc` is
 * meta/push as stored, `to` your person, `now` the time.
 */
export function pushPlan(doc, { from, to, kind, args, now = Date.now() }) {
  const group = PUSH_GROUP[kind];
  if (!group) return { send: false, why: 'kind' };
  const d = doc && typeof doc === 'object' ? doc : {};
  const prefs = (d.prefs && d.prefs[to]) || {};
  if (prefs[group] === false) return { send: false, why: 'off' };
  const devices = Object.entries((d.devices && d.devices[to]) || {}).filter(([, v]) => v && typeof v.token === 'string' && v.token);
  if (!devices.length) return { send: false, why: 'no phone' };
  // their most recently seen phone says where they are
  const tz = devices.map(([, v]) => v).sort((a, b) => (Number(b.at) || 0) - (Number(a.at) || 0))[0].tz;
  if (quietHours(tz, now)) return { send: false, why: 'asleep' };
  const key = gapKey(from, kind, args);
  const last = Number(d.sent && d.sent[key]) || 0;
  if (now - last < PUSH_GAP[kind]) return { send: false, why: 'too soon' };
  return { send: true, key, tokens: devices.map(([, v]) => v.token), keys: devices.map(([k]) => k) };
}

/** The message for Firebase Cloud Messaging (to send to each of `tokens`). */
export function pushMessage(kind, text, sid) {
  const m = {
    notification: text.body ? { title: text.title, body: text.body } : { title: text.title },
    data: { open: PUSH_OPEN[kind] || 'home', kind, sid },
    apns: { payload: { aps: { sound: 'default', 'thread-id': PUSH_GROUP[kind] || 'soultied' } } },
  };
  return m;
}
