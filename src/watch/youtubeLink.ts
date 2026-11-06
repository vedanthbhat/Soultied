/* Reading a YouTube link: which video, and where to start. Used by Watch together and the record player
 * (through ./youtube), and by the iPhone app's tests (scripts/native-fixtures.ts). */

/** Accepts watch/share/shorts/embed/live URLs or a bare 11-character id. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\.|^m\.|^music\./, '');
    if (host === 'youtu.be') return valid(u.pathname.slice(1, 12));
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return valid(v);
      const m = u.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch {
    // not a URL
  }
  return null;
}

/** Start time from ?t=90, ?t=1m30s or ?start=90, in seconds (0 if none). */
export function parseYouTubeStart(input: string): number {
  try {
    const u = new URL(input.trim().startsWith('http') ? input.trim() : `https://${input.trim()}`);
    const t = u.searchParams.get('t') || u.searchParams.get('start');
    if (!t) return 0;
    if (/^\d+$/.test(t)) return +t;
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + +(m[3] || 0) : 0;
  } catch {
    return 0;
  }
}

function valid(id: string) {
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
