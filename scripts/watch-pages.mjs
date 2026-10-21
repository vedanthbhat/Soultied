// After `vite build`: a page per streaming service (soultied.app/watch/netflix/ and so on), so someone
// searching "Crunchyroll watch party" finds Soultied, plus the sitemap. The pages borrow the look of
// /watch/ (its icons and styles). Keep SERVICES in step with src/stream/protocol.ts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SITE = 'https://soultied.app';
const STORE = 'https://chromewebstore.google.com/detail/soultied-watch-together/hcfmbadgbnfdkebllinmonemahalikcn';
const DIST = new URL('../dist/', import.meta.url);

const HOVER = (name) => [
  'Add Soultied to Chrome, Edge or Brave (it’s free).',
  `On ${name}, hover any show or film and press <strong>Watch together</strong>. Your watch party starts and its link is copied.`,
  'Send the link to your person. When they open it, they’re on the same show with you, in sync.',
];
const TAB = (name, site) => [
  'Add Soultied to Chrome, Edge or Brave (it’s free).',
  `Open ${site}, start the episode or film, and press the <strong>Watch together</strong> tab on the right of the player. Type your name and start: the link is copied.`,
  'Send the link to your person. When they open it, they’re taken to the same episode with you, in sync.',
];
const LIVE = 'Live streams (live sport, live channels) aren’t supported yet: Soultied syncs shows and films.';
const ADS = 'If one of you gets an ad break, the show waits for the other and carries on for both of you when it’s over.';
const NEXT = 'When one of you moves on to the next episode, the other follows.';

/** id: the page's address (soultied.app/watch/<id>/) */
const SERVICES = [
  {
    id: 'netflix', name: 'Netflix', site: 'netflix.com', steps: HOVER('Netflix'),
    title: 'Netflix Watch Party: Watch Netflix Together in Sync',
    intro: 'Watch Netflix with your person, wherever they are. Soultied keeps play, pause and skipping in sync on both screens, with a chat, reactions and a little pixel couch in the corner of the show.',
    notes: [
      'Start from a show’s card on the Netflix home page: no need to open it first.',
      NEXT,
      'Works on netflix.com in a computer browser, not in the Netflix app on a phone or TV.',
    ],
  },
  {
    id: 'prime-video', name: 'Prime Video', site: 'primevideo.com', steps: HOVER('Prime Video'),
    title: 'Prime Video Watch Party: Watch Together in Sync',
    intro: 'Movie night on Prime Video, even long distance. One link brings your person to the same film or episode, and Soultied keeps it playing in sync for both of you, with a chat and a little pixel couch over the show.',
    notes: [
      'Works on primevideo.com and on Prime Video inside Amazon’s own sites (amazon.com, amazon.in, amazon.co.uk and more).',
      ADS,
      NEXT,
    ],
  },
  {
    id: 'jiohotstar', name: 'JioHotstar', site: 'hotstar.com', beta: true, steps: TAB('JioHotstar', 'hotstar.com'),
    title: 'JioHotstar Watch Party: Watch Hotstar Together in Sync',
    intro: 'Watch JioHotstar together from two different homes. Your serials, series and films stay in sync on both screens, with a chat, reactions and a little pixel couch over the show.',
    notes: [LIVE, ADS, NEXT],
  },
  {
    id: 'sonyliv', name: 'Sony LIV', site: 'sonyliv.com', beta: true, steps: TAB('Sony LIV', 'sonyliv.com'),
    title: 'Sony LIV Watch Party: Watch Sony LIV Together in Sync',
    intro: 'Catch up on your Sony LIV shows together, from two cities. Soultied keeps the episode in sync for both of you, so you laugh, gasp and chat at the same moment.',
    notes: [ADS, LIVE, NEXT],
  },
  {
    id: 'zee5', name: 'ZEE5', site: 'zee5.com', beta: true, steps: TAB('ZEE5', 'zee5.com'),
    title: 'ZEE5 Watch Party: Watch ZEE5 Together in Sync',
    intro: 'Watch your ZEE5 serials and films together, wherever you both are. Pause for chai on one side and it pauses on the other, with a chat and a little pixel couch over the show.',
    notes: [NEXT, ADS, LIVE],
  },
  {
    id: 'disney-plus', name: 'Disney+', site: 'disneyplus.com', beta: true, steps: TAB('Disney+', 'disneyplus.com'),
    title: 'Disney+ Watch Party: Watch Disney Plus Together in Sync',
    intro: 'A Disney+ movie night for two, miles apart. Send one link and you’re watching the same film, in sync, with a chat and a little pixel couch in the corner.',
    notes: [
      'In India, Disney+ titles stream on JioHotstar: see <a href="/watch/jiohotstar/">JioHotstar watch party</a>.',
      NEXT,
    ],
  },
  {
    id: 'hulu', name: 'Hulu', site: 'hulu.com', beta: true, steps: TAB('Hulu', 'hulu.com'),
    title: 'Hulu Watch Party: Watch Hulu Together in Sync',
    intro: 'Watch Hulu together from two places. Soultied keeps your show in sync on both screens, with a chat, reactions and a little pixel couch over the show.',
    notes: [ADS, 'Hulu’s shows and films on demand. Hulu + Live TV channels aren’t supported yet.', NEXT],
  },
  {
    id: 'hbo-max', name: 'HBO Max', site: 'play.hbomax.com', beta: true, steps: TAB('HBO Max', 'play.hbomax.com'),
    title: 'HBO Max Watch Party: Watch HBO Max Together in Sync',
    intro: 'Watch HBO Max together, long distance. One link takes your person to the same episode, and Soultied keeps it in sync for both of you, with a chat and a little pixel couch.',
    notes: ['Works on play.hbomax.com, and on older play.max.com links.', NEXT, LIVE],
  },
  {
    id: 'crunchyroll', name: 'Crunchyroll', site: 'crunchyroll.com', beta: true, steps: TAB('Crunchyroll', 'crunchyroll.com'),
    title: 'Crunchyroll Watch Party: Watch Anime Together in Sync',
    intro: 'Anime night with your person, wherever they are. Soultied keeps every Crunchyroll episode in sync on both screens, with a chat, reactions and a little pixel couch over the show.',
    notes: [NEXT, 'Works on crunchyroll.com in a computer browser, not in the Crunchyroll app on a phone or TV.'],
  },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// the look of /watch/: its icons and styles
const watch = readFileSync(new URL('watch/index.html', DIST), 'utf8');
const icons = (watch.match(/<link rel="(?:icon|apple-touch-icon)"[^>]*>/g) || []).join('\n');
const style = watch.match(/<style>[\s\S]*?<\/style>/)?.[0] || '';

const others = (here) =>
  `<ul class="svc">${SERVICES.map((s) =>
    `<li><a href="/watch/${s.id}/"${s.id === here ? ' aria-current="page"' : ''}>${esc(s.name)}${s.beta ? '<span class="beta">beta</span>' : ''}</a></li>`).join('')}</ul>`;

function page(s) {
  const url = `${SITE}/watch/${s.id}/`;
  const desc = `Start a ${s.name} watch party: send one link and watch ${s.name} together in sync, with a chat, reactions and a little pixel couch. Free for Chrome, Edge and Brave.`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(s.title)} · Soultied</title>
${icons}
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Soultied">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
${style}
</head>
<body>
<main>
<a class="home" href="/watch/">← Soultied watch party</a>

<section class="card">
  <p class="kicker">Soultied · Watch party</p>
  <h1>${esc(s.name)} watch party</h1>
  <p>${s.intro}</p>
  <div class="row">
    <a class="btn" href="${STORE}" target="_blank" rel="noopener">Add to Chrome</a>
    <span class="small">Free. Chrome, Edge or Brave on a computer.</span>
  </div>
  ${s.beta ? `<p class="small">${esc(s.name)} support is new (beta). If something doesn’t stay in sync, tell us at <a href="mailto:hello@soultied.app">hello@soultied.app</a> and we’ll fix it.</p>` : ''}
  <img class="shot" id="shot-sync" width="800" height="500" alt="A Soultied watch party: the show playing, the chat beside it, and two pixel characters on a little couch in the corner." hidden>
</section>

<section class="about">
  <h2>How to start a ${esc(s.name)} watch party</h2>
  <ol>${s.steps.map((t) => `<li>${t}</li>`).join('')}</ol>
  <p class="small">You each need your own ${esc(s.name)} account: no video passes between you, only play, pause and your chat. In Edge, allow extensions from other stores when it asks.</p>
</section>

<section class="about">
  <h2>Good to know on ${esc(s.name)}</h2>
  <ul class="perks">${s.notes.map((t) => `<li><span>${t}</span></li>`).join('')}</ul>
</section>

<section class="about">
  <h2>Free, with more in Plus</h2>
  <ul class="perks">
    <li>Play, pause and skipping in sync. Join halfway and you catch up.</li>
    <li>If either of you is buffering or steps away, the show waits for you both.</li>
    <li>A chat over the show, reactions, and a countdown start: 3, 2, 1, play.</li>
    <li>With Soultied Plus: your cameras in the corner of the show, and talking out loud while the show turns itself down. One of you having Plus covers you both.</li>
  </ul>
  <div class="row"><a class="btn sage" href="/plus/">See Plus prices</a></div>
</section>

<section class="about">
  <h2>Questions</h2>
  <p><strong>Does my person need Soultied too?</strong> Yes: you both add the free extension. The link you send tells them how.</p>
  <p><strong>Does it work on a phone or TV?</strong> Not yet. It works in Chrome, Edge or Brave on a computer.</p>
  <p><strong>Can we chat while we watch?</strong> Yes, in a chat panel over the show. With Plus you can see and hear each other too.</p>
</section>

<section class="about">
  <h2>Soultied works on</h2>
  ${others(s.id)}
</section>

<p class="small">Soultied isn’t affiliated with, endorsed or sponsored by ${esc(s.name)}. ${esc(s.name)} is a trademark of its owner.</p>

<footer>
  <a href="/watch/">Watch party</a>
  <a href="/plus/">Soultied Plus</a>
  <a href="/terms/">Terms</a>
  <a href="/privacy/">Privacy</a>
  <a href="/contact/">Contact</a>
</footer>
</main>
<script src="/watch/shots.js"></script>
<script>
(() => {
  const img = document.getElementById('shot-sync');
  const src = (window.SOULTIED_SHOTS || {}).sync;
  if (src) { img.src = src; img.hidden = false; }
})();
</script>
</body>
</html>
`;
}

for (const s of SERVICES) {
  const dir = new URL(`watch/${s.id}/`, DIST);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('index.html', dir), page(s));
}

// /watch/ lists them too (the list between its markers is filled in here)
writeFileSync(new URL('watch/index.html', DIST), watch.replace(/<!--services-->[\s\S]*?<!--\/services-->/, `<!--services-->${others('')}<!--/services-->`));

const paths = ['/', '/watch/', ...SERVICES.map((s) => `/watch/${s.id}/`), '/plus/', '/privacy/', '/terms/', '/refunds/', '/contact/'];
writeFileSync(new URL('sitemap.xml', DIST), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((p) => `  <url><loc>${SITE}${p}</loc></url>`).join('\n')}
</urlset>
`);
console.log(`watch pages: ${SERVICES.length} services, sitemap with ${paths.length} addresses`);
