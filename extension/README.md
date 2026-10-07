# Soultied: watch together (browser extension)

Watch Netflix or Prime Video in sync with your person. Two ways in:

- **A watch party** (no Soultied account needed): start one from the toolbar button or the card on the show, and send the link. Whoever opens it lands on the same show, in sync. Free: sync, chat, reactions and the couch.
- **Your Soultied place**: everything above, plus cameras and push-to-talk, the "no watching ahead" check and your history together.

- Play, pause and skip stay in sync. If one of you is buffering or sitting through an ad, the other waits.
- A chat sidebar with notes like "Rohan paused at 42:10", plus reactions.
- Your two pixel characters sit on a little couch in the corner of the show, as close as you've earned in Soultied.
- "Take the remote": only one of you can pause and skip.
- Countdown start: you both press "I'm ready", 3, 2, 1, and it plays.
- Next episode: when one of you moves on, the other follows.
- No watching ahead: it remembers what you've watched together and stops you starting an episode your person hasn't seen with you.
- Cameras and push-to-talk (in a Soultied place): pop the cameras out of your Soultied tab into a small window that stays on top of the show. Hold T to talk; the show turns down while either of you is talking. In a watch party these are kept for Soultied Plus (coming later); the party shows a note instead.

You each need your own Netflix or Prime Video account. No video passes between you.

## Install

Works in Chrome, Edge and Brave on a computer. Until the Chrome Web Store listing is live, the site publishes the store build at `https://soultied.app/soultied-extension.zip` (built by `.github/workflows/pages.yml`), and the watch-party join page and the Watch panel link to it. Unzip it, then **Load unpacked** in `chrome://extensions` with Developer mode on. When the listing is live, put its address in `STORE_URL` in `public/join/index.html` (and the Watch panel).

To try a build of your own instead:

1. `npm install`, then `npm run build:extension`. The extension is written to `extension/dist/`.
2. Open `chrome://extensions` (Edge: `edge://extensions`) and switch on **Developer mode**.
3. Click **Load unpacked** and pick `extension/dist`.

## Two builds

- `npm run build:extension` → `extension/dist/`, for development. Also works inside Google AI Studio previews (`*.run.app`) and on `localhost`.
- `npm run build:extension:store` → `extension/dist-store/` and `extension/soultied-extension-<version>.zip`, the package for the Chrome Web Store. It only talks to Soultied's real addresses. Bump `version` in `manifest.json` before each upload. The listing text and privacy answers are in [STORE.md](STORE.md).

## How it fits together

- `src/player/`: runs on Netflix and Prime Video pages. `adapters.ts` knows each site's player, `engine.ts` keeps you in sync, `overlay.ts` and `couch.ts` draw the sidebar and the couch.
- `src/netflix-main.ts`: runs inside the Netflix page to use Netflix's own player controls (setting the video's time directly makes Netflix show an error).
- `src/prime-main.ts`: the same for Prime Video: it finds Amazon's own player (setting the video's time directly makes Prime show "Video Unavailable"), says which title is open, and reports where you are in the story without the ads Prime stitches into the video, so two people who saw different ads still line up.
- `src/bridge.ts`: runs on the Soultied page and passes messages between it and the extension.
- `src/background.ts`: the switchboard. Netflix / Prime tabs talk to whichever is in charge: your Soultied tab, or (while you're in one) a watch party.
- `src/offscreen.ts`: the watch party's line to your person. A small hidden page Chrome keeps open while you're in a party (and closes after five minutes with no show open). It signs in to Soultied's Firebase project anonymously, keeps `parties/{id}` (two seats, names, pixel characters, what's on) current, and carries play / pause / chat over `parties/{id}/events`, the job the Soultied tab does for a place. Firebase settings come from `firebase-applet-config.json` at build time; Firebase Auth is the `firebase/auth/web-extension` build, which loads no remote code.
- `src/popup.ts`: the window under the toolbar button. Start a watch party (or paste a link to join one), copy the link, leave; or, with a place, whether your Soultied tab is open and your person is watching. Buttons for Netflix, Prime Video and soultied.app.
- `public/join/index.html` (in the web app): where party links open (`https://soultied.app/join/#<party id>`). It asks the extension (through the bridge) who started the party and what's on, takes your name and sends you to the show; without the extension, it explains how to get it and what Soultied is.
- Prime Video's player doesn't show its title in a way the extension can read, so `adapters.ts` recognises what's playing by the title id in the player's own requests to Amazon (`amzn1.dv.gti.…`, the same for both of you), seen through the page's resource timing. That id also makes the "Go there" link.
- The Soultied tab (`src/stream/StreamHub.tsx` in the web app) is already signed in, so it carries everything to and from your person over the online live channel, keeps the "watched together" list in Firestore, and runs the cameras. Keep it open while you watch.
- Messages are defined once, in `src/stream/protocol.ts`, and shared by both.

## Where Soultied lives

The extension talks to Soultied pages on the addresses in the last `content_scripts` entry of `manifest.json`: Soultied's own domain, `soultied-c1543.web.app` and `soultied-c1543.firebaseapp.com` (plus `*.run.app` and `localhost` in the development build). On any of those it stays silent until the page says it's Soultied. The first address is where "Open Soultied" (in the toolbar window, and on the show) takes you if no Soultied tab is open.

## Permissions and privacy

`storage` (to remember your chat panel setting, what you've watched together, your watch-party name and the party you're in, on this computer), `offscreen` (the hidden page that keeps a watch party connected), and `scripting` with access to the same sites as its content scripts (only so that, right after you install or update it, it can start in Netflix, Prime and Soultied tabs that were already open, without a refresh). It reads nothing on Netflix or Prime beyond the video player and which title is playing. See the [privacy policy](https://soultied.app/privacy/).

Watch parties need two switches in the Firebase project: **Anonymous** sign-in turned on (Authentication → Sign-in method), and the `parties` rules in `firestore.rules` published.
