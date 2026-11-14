/**
 * How far apart you are, and what time it is for your person. Kept in the place's `meta/where` document, by
 * person: your time zone (always, so they can see your time), and roughly where you are (only once you choose
 * to share it, and only to a tenth of a degree, about 11 km, so it's the town and never the street).
 */

export interface WhereEntry {
  /** roughly where (a tenth of a degree), or null while you're not sharing it */
  lat: number | null;
  lon: number | null;
  /** your time zone ("Asia/Kolkata"), or '' */
  tz: string;
  /** when it was last set (ms) */
  at: number;
}

export interface WhereDoc {
  by: Record<string, WhereEntry>;
}

/** to a tenth of a degree (about 11 km) */
export const roundCoord = (x: number) => Math.round(x * 10) / 10;

const coord = (v: unknown, lim: number) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim ? roundCoord(v) : null);
const isZone = (v: unknown): v is string => typeof v === 'string' && v.length <= 64 && /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+)*$/.test(v);

export function normalizeWhere(raw: unknown): WhereDoc {
  const r = raw && typeof raw === 'object' ? (raw as { by?: unknown }) : {};
  const by: WhereDoc['by'] = {};
  if (r.by && typeof r.by === 'object')
    for (const [uid, v] of Object.entries(r.by as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const e = v as Record<string, unknown>;
      let lat = coord(e.lat, 90);
      let lon = coord(e.lon, 180);
      if (lat === null || lon === null) lat = lon = null;
      by[uid] = { lat, lon, tz: isZone(e.tz) ? e.tz : '', at: typeof e.at === 'number' && Number.isFinite(e.at) ? e.at : 0 };
    }
  return { by };
}

/** how far apart two places are, in km, over the earth's surface */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** how far apart the two of you are (null until you've both shared roughly where you are) */
export function apartKm(doc: WhereDoc, me: string, them: string | null | undefined): number | null {
  const a = doc.by[me];
  const b = them ? doc.by[them] : undefined;
  if (!a || !b || a.lat === null || a.lon === null || b.lat === null || b.lon === null) return null;
  return distanceKm({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
}

const grouped = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "8,050 km apart", "about 35 miles apart", or "Close by" (in miles where people count in miles) */
export function apartLabel(km: number, miles = false): string {
  if (km < 20) return 'Close by';
  const v = miles ? km * 0.621371 : km;
  const r = v < 100 ? Math.round(v / 5) * 5 : v < 1000 ? Math.round(v / 10) * 10 : Math.round(v / 50) * 50;
  return `${grouped(r)} ${miles ? 'miles' : 'km'} apart`;
}

/** where your person's clock is next to yours: "5½ hours behind you", "Same time as you" (from the minutes between) */
export function aheadLine(diffMinutes: number): string {
  const d = Math.round(diffMinutes);
  if (Math.abs(d) < 8) return 'Same time as you';
  const a = Math.abs(d);
  let h = Math.floor(a / 60);
  let q = Math.round((a % 60) / 15);
  if (q === 4) {
    h += 1;
    q = 0;
  }
  const way = d > 0 ? 'ahead of you' : 'behind you';
  if (h === 0) return `${q === 2 ? 'Half an hour' : `${q * 15} minutes`} ${way}`;
  return `${h}${['', '¼', '½', '¾'][q]} ${h === 1 && q === 0 ? 'hour' : 'hours'} ${way}`;
}

/** in the small hours for them (so: probably asleep) */
export const asleepHour = (hour: number) => hour >= 0 && hour < 6;

/** a time zone's offset from UTC at a moment, in minutes (null if this browser doesn't know the zone) */
export function zoneOffset(tz: string, at: Date): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return Math.round((local - (at.getTime() - at.getSeconds() * 1000 - at.getMilliseconds())) / 60000);
  } catch {
    return null;
  }
}

/** the time in a zone: "9:41 pm", and its hour (0–23) */
export function zoneTime(tz: string, at: Date): { text: string; hour: number } | null {
  try {
    const text = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(at).replace(/ |\s/g, ' ').replace('AM', 'am').replace('PM', 'pm');
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23' }).format(at));
    return { text, hour: hour % 24 };
  } catch {
    return null;
  }
}

/** this browser's time zone */
export const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

/** places where distances are in miles */
export const countsInMiles = (lang: string) => /-(US|GB|LR|MM)\b/i.test(lang);

/** the demo room: Aanya in Bengaluru, Rohan in London */
export const demoWhere = (): WhereDoc => ({
  by: {
    'user-aanya': { lat: 13, lon: 77.6, tz: 'Asia/Kolkata', at: Date.now() - 3600e3 },
    'user-rohan': { lat: 51.5, lon: -0.1, tz: 'Europe/London', at: Date.now() - 3 * 3600e3 },
  },
});
