import type { Platform } from '../../src/stream/protocol';

/**
 * Which streaming site an address belongs to (for the background and the toolbar window).
 * The pages themselves are matched in manifest.json; keep the two lists the same.
 */
const HOSTS: [RegExp, Platform][] = [
  [/(^|\.)netflix\.com$/, 'netflix'],
  [/(^|\.)primevideo\.com$/, 'prime'],
  [/(^|\.)hotstar\.com$/, 'hotstar'],
  [/(^|\.)sonyliv\.com$/, 'sonyliv'],
  [/(^|\.)zee5\.com$/, 'zee5'],
  [/(^|\.)disneyplus\.com$/, 'disney'],
  [/(^|\.)hulu\.com$/, 'hulu'],
  [/(^|\.)(hbomax|max)\.com$/, 'hbomax'],
  [/(^|\.)crunchyroll\.com$/, 'crunchyroll'],
];

export function platformOf(url: string | undefined): Platform | null {
  try {
    const u = new URL(url || '');
    // Prime Video inside Amazon's own site (amazon.com/gp/video, amazon.in/gp/video…)
    if (/(^|\.)amazon\./.test(u.hostname)) return u.pathname.startsWith('/gp/video') ? 'prime' : null;
    for (const [re, p] of HOSTS) if (re.test(u.hostname)) return p;
  } catch {
    // not a page
  }
  return null;
}

/** a page on one of the streaming sites Soultied works on */
export const isShowPage = (url: string) => platformOf(url) !== null;
