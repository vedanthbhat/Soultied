// The "Listed on" strip under the footer links, built from src/listed-on.json.
// Used in two places so the list lives in one file:
//   - scripts/watch-pages.mjs puts it into the plain HTML of every page at build time (directories check the HTML, not the app)
//   - src/components/Welcome.tsx shows the same strip on the home page once the app starts
import LIST from './listed-on.json' with { type: 'json' };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const LISTED_CSS = `.st-listed{box-sizing:border-box;display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 10px;max-width:640px;margin:10px auto 0;padding:0 8px;font:12px/1.2 'Pixelify Sans',system-ui,sans-serif;font-variant-ligatures:none;font-feature-settings:'liga' 0,'clig' 0;color:#7a5a48}
.st-listed a{color:#7a5a48;text-decoration:none;display:inline-block;line-height:0}
.st-listed img{display:block;height:20px;width:auto;max-width:none;border:0}
.st-listed--muted img{filter:grayscale(1);opacity:.55;transition:filter .2s,opacity .2s}
.st-listed--muted a:hover img,.st-listed--muted a:focus-visible img{filter:none;opacity:1}
.st-listed__label{flex-basis:100%;text-align:center;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.st-listed a.st-listed__txt{line-height:1.2;text-decoration:underline;text-underline-offset:2px}
.st-listed__pair{display:inline-flex;flex-direction:column;align-items:center;gap:2px}
.st-listed a.st-listed__sub{font-size:10px;line-height:1}
.st-listed__dot{line-height:1.2}`;

const rel = (s) => esc(s.rel || 'noopener');
const link = (s, inner, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(s.href)}" target="_blank" rel="${rel(s)}">${inner}</a>`;
const img = (s) => `<img src="${esc(s.img)}" alt="${esc(s.alt)}"${s.w ? ` width="${s.w}"` : ''}${s.h ? ` height="${s.h}"` : ''} loading="lazy" decoding="async">`;

/** variant: 'muted' (small grey badges, colour on hover), 'color' (small badges in colour) or 'text' (names only) */
export function listedOnHtml(variant = 'muted', sites = LIST.sites) {
  const live = sites.filter((s) => s.status === 'live');
  let items;
  if (variant === 'text') {
    items = live.map((s) => link(s, esc(s.name), 'st-listed__txt')).join('<span class="st-listed__dot" aria-hidden="true">·</span>');
  } else {
    items = live
      .map((s) => {
        if (!s.img) return link(s, esc(s.name), 'st-listed__txt');
        if (s.extra) return `<span class="st-listed__pair">${link(s, img(s))}${link(s.extra, esc(s.extra.text), 'st-listed__sub')}</span>`;
        return link(s, img(s));
      })
      .join('');
  }
  const cls = `st-listed${variant === 'muted' ? ' st-listed--muted' : ''}`;
  return `<div class="${cls}" role="group" aria-label="Soultied is listed on"><span class="st-listed__label">Listed on</span>${items}</div>`;
}

export const LISTED_SITES = LIST.sites;
