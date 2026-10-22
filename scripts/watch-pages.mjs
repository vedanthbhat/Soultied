// After `vite build`, for search engines and link previews: a page per streaming service
// (soultied.app/watch/netflix/ and so on, so someone searching "Crunchyroll watch party" finds Soultied),
// the sitemap, llms.txt (a plain summary for AI assistants), and the link preview images, which are kept
// as text in og-images.json (AI Studio edits text files only). The service pages borrow the look of
// /watch/ (its icons and styles). Keep SERVICES in step with src/stream/protocol.ts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SITE = 'https://soultied.app';
const STORE = 'https://chromewebstore.google.com/detail/soultied-watch-together/hcfmbadgbnfdkebllinmonemahalikcn';
const DIST = new URL('../dist/', import.meta.url);

// the link preview images (og/home.png, og/watch.png) and the logo
const IMAGES = JSON.parse(readFileSync(new URL('./og-images.json', import.meta.url), 'utf8'));
mkdirSync(new URL('og/', DIST), { recursive: true });
for (const [path, b64] of Object.entries(IMAGES)) writeFileSync(new URL(path, DIST), Buffer.from(b64, 'base64'));

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

/** structured data: the extension, and where this page sits */
const ld = (s, url, desc) => ({
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'SoftwareApplication',
      name: 'Soultied Watch Party',
      description: desc,
      url,
      applicationCategory: 'EntertainmentApplication',
      applicationSubCategory: 'Browser extension',
      operatingSystem: 'Chrome, Edge or Brave on a computer',
      installUrl: STORE,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@type': 'Organization', name: 'Soultied', url: `${SITE}/` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Soultied', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Watch party', item: `${SITE}/watch/` },
        { '@type': 'ListItem', position: 3, name: `${s.name} watch party`, item: url },
      ],
    },
  ],
});

function page(s) {
  const url = `${SITE}/watch/${s.id}/`;
  const desc = `Start a ${s.name} watch party: send one link and watch together in sync, with a chat, reactions and a pixel couch. Free for Chrome, Edge and Brave.`;
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
<meta property="og:image" content="${SITE}/og/watch.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Soultied watch party: Netflix, Prime Video and seven more streaming services, with a little pixel couch.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og/watch.png">
<script type="application/ld+json">${JSON.stringify(ld(s, url, desc))}</script>
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
// llms.txt: what Soultied is, in plain words, for AI assistants and search
writeFileSync(new URL('llms.txt', DIST), `# Soultied

> A cozy pixel home online for two people who live apart, and a free browser extension for watch parties on Netflix, Prime Video and seven more streaming services.

Soultied has two parts. You can use either one on its own.

- [Our place](${SITE}/): a little home for two on the web. A shared pixel room with a couch and a fireplace, a letter to open together every day, 30 days of questions about each other, games for two, a record player, and movie nights. Building a place is free; you sign in with Google and send your person a link.
- [Watch party extension](${SITE}/watch/): for Chrome, Edge and Brave on a computer. It keeps a show playing in sync for two people in different places, with a chat, reactions and a little pixel couch over the video. Start a party, send the link, and your person is taken to the same show. No account needed. Each person needs their own account on the streaming service; no video passes between them.
- [Soultied Plus](${SITE}/plus/): adds cameras and voice (in the watch party and in your place). One of you having Plus covers you both.

## Watch party by service

${SERVICES.map((s) => `- [${s.name} watch party](${SITE}/watch/${s.id}/)${s.beta ? ' (beta)' : ''}`).join('\n')}

Shows and films only: live streams such as live sport aren't supported yet. Soultied isn't affiliated with any of these services.

## More

- [Install from the Chrome Web Store](${STORE})
- [Privacy](${SITE}/privacy/): what Soultied handles and how to delete it
- [Terms](${SITE}/terms/)
- [Refunds](${SITE}/refunds/): full refund within 7 days
- [Contact](${SITE}/contact/): hello@soultied.app
`);
console.log(`watch pages: ${SERVICES.length} services, sitemap with ${paths.length} addresses, llms.txt, ${Object.keys(IMAGES).length} images`);
