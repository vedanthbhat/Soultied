# Handoff

Shared between Claude and Codex. Update it at every checkpoint, and check which branch you're on before editing.

- `main` is what's live (soultied.app deploys from it). Claude pushes only to `main`, through Google AI Studio's
  GitHub sync. AI Studio can't push to other branches.
- On 23 Nov, Vedanth chose to put all of [PR #1](https://github.com/vedanthbhat/Soultied/pull/1)
  (`review/couples-widgets`) on `main` that way, with Claude's fixes on top. So `main` now has everything, and the
  branch is behind it. Work on `main`, or start a new `review/...` branch from it.

## Current goal

Verify the couples-app work (formerly PR #1) on real iPhones. Our song (Apple Music) matters most:

- Each partner connects their own Apple Music.
- Either partner can search for and pick the song.
- Play, pause, resume and seeking are shared.
- A partner who joins partway through hears the same spot.
- Switching to a shelf record stops Apple Music on both phones.

The record shelf now follows Claude's design ("Record player: shelf + Our song" on Vedanth's design canvas, which is
also what his `Record player shelf + Our song-html.zip` is):

- Six sleeves, each with its own picture, in a 3×2 grid.
- The playing record has a gold edge and its record peeking out.
- A "6 records · 20 songs, free to use" header.
- A dark Our song card with a PLUS badge and a gold Choose button.
- "NOW PLAYING · <record>" on the card.

## What changed

Claude's checkpoint, 23 Nov 2026, on top of `d17e18f`:

- **Crash fix.** Added `NSAppleMusicUsageDescription` to `native/project.yml`. Without it, iOS closes the app as soon
  as someone taps "Connect Apple Music".
- **Our song stays in step on slow connections** (`RoomMusic.swift`).
  - It waits 4 s between corrections.
  - It aims ahead by how long the last correction took to buffer.
  - Before this, a buffer of 2 s or more meant the song re-seeked every second and never played.
- **Our song keeps playing over Control Center and alerts.** Like the record, it stops only when the app goes to the
  background.
- **Our song follows the app's Plus rule.** It uses `plusOpen`, so it's open while Plus can't be bought yet, the same
  as games and escape rooms. When Plus is on sale, it needs Plus.
- **CI builds `review/**` branches** (`native-ios.yml`), with one concurrency group per branch.
- **Record shelf design**, on both iPhone and the website:
  - iPhone: `RecordSleeve` and `RecordSheet` in `RecordPlayer.swift`.
  - Website: `Sleeve` and `RecordPicker` in `NowPlaying.tsx`.
  - The turntable context now has `album`.
  - "Next" is now "Next song". On Home, "A song instead" is now "Records", since YouTube songs are gone from the
    record player.

Codex, 19–22 Nov:

- Doodle and Countdown widgets.
- Invite first in onboarding.
- Us tiles, Home and the monthly recap.
- The Plus offer after the questions.
- The notification-tap crash fix (`8b9d456`).
- The six-record shelf.
- Our song with MusicKit (`d17e18f`).

The 15 new shelf tracks are tones that `scripts/record-audio.mjs` makes during the build. They're about 31 MB of WAV,
which the app bundles and the website serves.

## What was actually tested

Claude, 23 Nov:

- Website: `tsc` and `npm run build` pass. `scripts/native-fixtures.ts` runs.
- Website record shelf, in the demo room at 390 × 844 with Playwright: it opens, puts Lo-fi evening on, and the card
  says "NOW PLAYING · LO-FI EVENING". Reopened, Lo-fi shows as playing. No page errors. The iPhone sleeves use the
  same drawing, but nobody has seen them yet; check CI's `record-sheet` screenshot.
- Swift: all 131 files parse (tree-sitter: syntax only, no type check).
  - There was no Swift toolchain this session, so the core tests weren't run.
  - `d17e18f` has never been compiled. The last iPhone CI run on this branch was `1181c08`: the build succeeded and
    99 core tests passed.
- Our song was checked by reading the code:
  - Native writes replace the whole turntable document (`merge: false`), and so do the website's.
  - So a shelf record or a YouTube song always removes `apple` on both phones.
  - A late joiner works out `offset + (now - at)` and seeks to it.
- Sync loop: simulated with a player that stands still while it buffers. The old loop never played with buffers of
  2 s or more; the new one lines up after two seeks.
- **Not checked:** whether MusicKit is enabled for `app.soultied.ios`. The developer portal needs Vedanth to sign in.
- **Not tested:** anything on a real iPhone or with two phones, StoreKit, and the shelf layout.

Vedanth: the notification-tap crash fix works on his phone.

## Next unfinished step

1. Vedanth: in the developer portal, open Identifiers › `app.soultied.ios` › App Services and tick MusicKit if
   it isn't already.
2. Check the iPhone CI run for this push. It has `[testflight]`, so it builds, runs the tests and sends a TestFlight
   build. Look on the `native-shots` branch for build errors and the `record-sheet` screenshot.
3. Run the two-iPhone checklist below on that build.
4. Close PR #1 once `main` is confirmed: everything in it is on `main`.

### Two-iPhone checklist for Our song

Both phones need the new build, the same couple, and their own Apple Music subscription. Pass if the two phones are
within about 1 s of each other by ear.

1. On each phone, go to Record player › Our song › Choose › Connect Apple Music › Allow. It shouldn't crash.
   - If search says "Search couldn't load", MusicKit isn't enabled on the App ID.
2. A picks a song of 3 minutes or more. B starts it within a few seconds.
3. B swipes the app away, waits a minute and reopens it. B joins at A's spot, not at 0:00.
4. B pauses: both stop. A resumes: both carry on from the same spot. B taps +15 sec: both jump.
5. A goes home for 20 s and comes back. A rejoins at the shared spot.
6. A opens Control Center and changes the volume. The song keeps playing.
7. A taps a shelf record. Apple Music stops on both phones and the record plays on both. Picking "Play …" under Our
   song brings the song back on both.
8. Start a shelf record on soultied.app while the song plays. It stops on both phones.
9. Optional: try a weak connection. The song may jump once or twice, then stays put rather than stuttering.

## Working in this repo

- Never commit `zz-test.config.ts`. New files use LF line endings.
- Keep the TypeScript and Swift versions in step. Shared logic gets fixtures in `scripts/native-fixtures.ts` and
  matching tests in `native/SoultiedCore/Tests`.
- Put `[testflight]` in a commit message to send an iPhone build. CI screenshots go to the `native-shots` branch.
- Style rules:
  - Pixelify Sans only.
  - Pixel characters only.
  - No service logos.
  - Aanya and Rohan are made up.
