# Soultied: watch together (browser extension)

Watch Netflix or Prime Video in sync with your person, from your Soultied place.

- Play, pause and skip stay in sync. If one of you is buffering or sitting through an ad, the other waits.
- A chat sidebar with notes like "Rohan paused at 42:10", plus reactions.
- Your two pixel characters sit on a little couch in the corner of the show, as close as you've earned in Soultied.
- "Take the remote": only one of you can pause and skip.
- Countdown start: you both press "I'm ready", 3, 2, 1, and it plays.
- Next episode: when one of you moves on, the other follows.
- No watching ahead: it remembers what you've watched together and stops you starting an episode your person hasn't seen with you.
- Cameras and push-to-talk: pop the cameras out of your Soultied tab into a small window that stays on top of the show. Hold T to talk; the show turns down while either of you is talking.

You each need your own Netflix or Prime Video account. No video passes between you.

## Install

Works in Chrome, Edge and Brave on a computer. Install it from the Chrome Web Store, then open (or refresh) your Soultied tab, go to Watch together, then **Netflix / Prime**.

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
- `src/bridge.ts`: runs on the Soultied page and passes messages between it and the extension.
- `src/background.ts`: the switchboard between Soultied tabs and Netflix / Prime tabs.
- `src/popup.ts`: the window under the toolbar button. It shows whether your Soultied tab is open, what you're watching and whether your person is watching with you, with buttons to open Soultied, Netflix or Prime Video.
- Prime Video's player doesn't show its title in a way the extension can read, so `adapters.ts` recognises what's playing by the title id in the player's own requests to Amazon (`amzn1.dv.gti.…`, the same for both of you), seen through the page's resource timing. That id also makes the "Go there" link.
- The Soultied tab (`src/stream/StreamHub.tsx` in the web app) is already signed in, so it carries everything to and from your person over the online live channel, keeps the "watched together" list in Firestore, and runs the cameras. Keep it open while you watch.
- Messages are defined once, in `src/stream/protocol.ts`, and shared by both.

## Where Soultied lives

The extension talks to Soultied pages on the addresses in the last `content_scripts` entry of `manifest.json`: Soultied's own domain, `soultied-c1543.web.app` and `soultied-c1543.firebaseapp.com` (plus `*.run.app` and `localhost` in the development build). On any of those it stays silent until the page says it's Soultied. The first address is where "Open Soultied" (in the toolbar window, and on the show) takes you if no Soultied tab is open.

## Permissions and privacy

Only `storage` (to remember your chat panel setting and what you've watched together, on this computer). It reads nothing on Netflix or Prime beyond the video player and which title is playing. See the [privacy policy](https://soultied.app/privacy/).
