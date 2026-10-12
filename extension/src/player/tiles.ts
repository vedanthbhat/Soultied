import type { TitleInfo } from '../../../src/stream/protocol';
import { iconURL } from './couch';

/**
 * "Watch together" on Netflix and Prime Video's own show cards: hover a show, and next to its Play
 * button there's ours, which starts a watch party for that show and puts it on.
 *
 * - Netflix: the preview that opens when you hover a show (and the big one when you click it) has a
 *   Play link to /watch/<id>; ours goes right after it.
 * - Prime Video: a hovered show card has a Play link to /detail/<id>?autoplay=1;
 *   ours goes on its own row under it.
 *
 * Each button lives in its own shadow root, so the site's styles can't touch it and ours can't leak.
 */

export type TileStart = (title: TitleInfo, go: string) => void;

const TAG = 'soultied-start';

const CSS = `
:host { all: initial; display: inline-flex; align-items: center; vertical-align: middle; }
:host([data-row]) { display: flex; width: 100%; margin-top: 8px; }
button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  height: var(--h, 33px); padding: 0 10px; white-space: nowrap; font: 600 13px/1 'Soultied Pixel', ui-sans-serif, system-ui, sans-serif;
  background: #f4e8d0; color: #2b1e1c; font-variant-ligatures: none; box-shadow: 0 -2px 0 0 #2b1e1c, 0 2px 0 0 #2b1e1c, -2px 0 0 0 #2b1e1c, 2px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #d6c29c; }
:host([data-row]) button { width: 100%; height: 40px; font-size: 15px; }
button:hover { background: #fff8ea; }
button:active { transform: translateY(1px); }
button:focus-visible { outline: 2px solid #b8674f; outline-offset: 3px; }
img { width: 14px; height: 12px; image-rendering: pixelated; }
`;

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export class TileButtons {
  private observer: MutationObserver | null = null;
  private queued = false;
  /** the show card the pointer was last over (Netflix's previews don't always say the show's name) */
  private lastCard = '';
  private label = 'Watch together';

  constructor(
    private platform: 'netflix' | 'prime',
    private onStart: TileStart,
  ) {}

  start() {
    this.observer = new MutationObserver(() => this.queue());
    this.observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener(
      'pointerover',
      (ev) => {
        const t = ev.target instanceof Element ? ev.target : null;
        const card = t?.closest('a[data-uia$="-card"], .title-card a[aria-label], article[data-card-title]');
        if (!card) return;
        this.lastCard = (card.getAttribute('aria-label') || card.getAttribute('data-card-title') || '').trim();
      },
      true,
    );
    this.queue();
  }

  /** what the button says (in a party already: it just takes you both there) */
  setLabel(label: string) {
    if (label === this.label) return;
    this.label = label;
    document.querySelectorAll(TAG).forEach((h) => {
      const span = h.shadowRoot?.querySelector('span');
      if (span) span.textContent = label;
    });
  }

  private queue() {
    if (this.queued) return;
    this.queued = true;
    // (a timer rather than the next frame: frames don't come while the tab's in the background)
    window.setTimeout(() => {
      this.queued = false;
      try {
        if (this.platform === 'netflix') this.netflix();
        else this.prime();
      } catch {
        // the site changed shape: no buttons, nothing else affected
      }
    }, 40);
  }

  private netflix() {
    for (const play of document.querySelectorAll<HTMLAnchorElement>('a[data-uia="play-button"][href*="/watch/"]')) {
      if (play.closest('[data-uia="billboard"]')) continue;
      const id = play.getAttribute('href')?.match(/\/watch\/(\d+)/)?.[1];
      if (!id) continue;
      // (one per preview, even when another extension puts its own button next to Play too)
      const mine = play.parentElement?.querySelector<HTMLElement>(`:scope > ${TAG}`);
      if (mine) {
        mine.dataset.id = id;
        continue;
      }
      const box = play.closest('[role="dialog"], [data-uia*="previewModal"], [data-uia*="modal"]');
      const h = Math.round(play.getBoundingClientRect().height) || 33;
      const btn = this.button(() => {
        const name = this.netflixName(box) || 'Netflix';
        const title: TitleInfo = {
          platform: 'netflix',
          key: `netflix:${id}`,
          showKey: `netflix-show:${slug(name)}`,
          show: name,
          episode: '',
          url: `https://www.netflix.com/watch/${id}`,
        };
        this.onStart(title, title.url);
      }, h);
      btn.dataset.id = id;
      play.after(btn);
    }
  }

  /** the show's name in a Netflix preview: its title art, or the card you were over */
  private netflixName(box: Element | null) {
    if (this.lastCard) return this.lastCard;
    return box?.querySelector<HTMLImageElement>('img.previewModal--boxart[alt], img[class*="title-treatment"][alt]')?.alt?.trim() || '';
  }

  private prime() {
    for (const play of document.querySelectorAll<HTMLAnchorElement>('article a[data-testid="play"][href*="/detail/"]')) {
      if (play.closest('[data-testid="top-hero-card"]')) continue;
      const href = play.getAttribute('href') || '';
      const id = href.match(/\/detail\/([^/?#]+)/)?.[1];
      if (!id) continue;
      const row = play.parentElement;
      if (!row) continue;
      if (row.parentElement?.querySelector(`:scope > ${TAG}`)) continue;
      const btn = this.button(() => {
        const card = play.closest('article');
        const name = (
          card?.getAttribute('data-card-title') ||
          card?.querySelector('[data-testid="title-art"]')?.textContent ||
          card?.querySelector('[data-testid="title-art"] img')?.getAttribute('alt') ||
          this.lastCard ||
          'Prime Video'
        )
          .replace(/\s+-\s+Season\s+\d+$/i, '')
          .trim();
        const url = `https://www.primevideo.com/detail/${id}`;
        const title: TitleInfo = { platform: 'prime', key: `prime:${id}`, showKey: `prime-show:${slug(name) || id}`, show: name, episode: '', url };
        this.onStart(title, new URL(href, location.origin).href);
      }, 40);
      btn.setAttribute('data-row', '');
      row.after(btn);
    }
  }

  private button(onClick: () => void, height: number) {
    const host = document.createElement(TAG);
    const root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    const b = document.createElement('button');
    b.type = 'button';
    b.title = 'Start a Soultied watch party for this, and put it on';
    b.style.setProperty('--h', `${Math.max(28, Math.min(56, height))}px`);
    const img = document.createElement('img');
    img.src = iconURL('heart', 2);
    img.alt = '';
    const text = document.createElement('span');
    text.textContent = this.label;
    b.append(img, text);
    root.append(style, b);
    // the card under it opens the show when clicked (and the site has its own keys): this is ours alone
    for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'keydown', 'keyup'] as const)
      host.addEventListener(type, (ev) => {
        ev.stopPropagation();
        if (type !== 'click') return;
        ev.preventDefault();
        onClick();
      });
    return host;
  }
}
