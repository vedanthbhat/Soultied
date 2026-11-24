# Handoff

Shared between Claude and Codex. Update it at every checkpoint.

- `main` is what's live: soultied.app deploys from it, and `[testflight]` commits build the iPhone app.
- Claude pushes only to `main`, through Google AI Studio's GitHub sync, which can't push to other branches.
- PR #1 (`review/couples-widgets`) is on `main` since 23 Nov. The branch is behind `main`, so work on `main`.

## Current goal

Get Soultied ready for the App Store:

1. Try this build on two iPhones.
2. Do a final review: checks, security, privacy.
3. Submit to the App Store.

## What changed

Claude, 24 Nov (step 1 of the plan below):

- **Every menu is frosted.** On iPhone, the menus that open as sheets (how you're feeling, your person, the invite,
  decorating, the record player, the pet, settings, your look, Plus, the bucket list, ranks, snaps, visits, photos)
  now look like the Us cards: the screen blurred behind, the menu as a paper card at the bottom with a bar and Done,
  and a tap on the blur closes it (`frostedSheet()` in `FloatingCard.swift`). Whole pages (letters, the wall, games,
  Us, watch) still open as plain paper sheets. On the website, the panels and pop-ups use one shared backdrop
  (`.st-frost` in `index.css`).
- **Real songs on the record shelf.** The made-up loops are gone. The five records are now real songs, credited
  while they play and under each sleeve:
  - Lo-fi evening and Retro arcade: HoliznaCC0 (Free Music Archive), CC0.
  - Soft piano, Acoustic morning and Rainy day: Kevin MacLeod (incompetech.com), CC BY 4.0.
  - The list, with where each song comes from, is `src/music/shelf.json`; the credits are in
    `public/audio/CREDITS.txt`.
  - `scripts/shelf-audio.mjs` (run before each build) downloads them, evens their volume out to match the jazz
    record, and makes each one a 96 kbps MP3 exactly as long as `shelf.json` says. The site workflow installs
    ffmpeg and keeps the made songs in the Actions cache, so they're only made again when `shelf.json` changes.
  - The iPhone app no longer carries the songs: it downloads each one from soultied.app the first time it plays.
    The song list is in `Turntable.swift` too; `TurntableTests.testTheShelf` checks it against the website's.
- **Coasters (air hockey):** the table's corners are rounded, so the puck can't wedge in one, and a puck resting
  still against a rail gets a gentle push back into play. Same on web and iPhone.

Claude, 23 Nov, second checkpoint:

- **Onboarding is shorter.** New people see 4 steps, then the room:
  1. Your names: yours and your person's.
  2. Today's character studio, unchanged.
  3. How far apart are you: big tiles that fill the screen, with the next time you'll see each other right under
     your answer.
  4. Plus: the picture now moves (twinkling lights, floating hearts), and the button bar stays pinned at the bottom.
- **The rest of onboarding moved elsewhere:**
  - **Invite first.** In the room, the first card is "Save <name>'s seat".
  - **Tour.** Instead of the 11-step tour, the letter, the record player and the pet glow until they've been opened
    (`RoomHints`). Us › Show me around still has the tour.
  - **The other 3 questions.** They come one a day: on Home on iPhone (`QuickAskCard`), on the Us page on the web
    (`QuickAsk`).
  - **Place name and the day you got together.** These moved to Us › Edit our place.
  - **Joining.** Someone joining their person skips the question, because their person already answered it.
- **Plus picture fix (iPhone).** The picture was loaded with SwiftUI's `Image("plus-popcorn")`. That only looks in the
  asset catalogue, but the picture is a plain bundled file, so it showed nothing. It now loads with `UIImage(named:)`
  (`PopcornPicture` in `Plus.swift`).
- **Plus sheet.** The plans, the button and the links are pinned at the bottom, so nothing gets cut off. The billed
  price is the biggest price on the screen.
- **Us tiles open as floating cards** with the screen blurred behind them.
  - iPhone: `FloatingCard.swift`. The card rises from the bottom, and you close it by dragging, tapping outside it or
    tapping Done.
  - Website: a centred `<dialog>` with a blurred backdrop that closes on a click outside it.
- **Two new home-screen widgets** (`KeepsakeFaces.swift`, `SoultiedWidget.swift`):
  - **Their voice:** your person's newest voice note. A tap opens Soultied and plays it.
  - **Memories:** one memory from your wall each day, with memories from this date in past years first.
- **Clearer words:**
  - "Hot cards" is now "Bolder After dark questions".
  - Stitches are explained the first time they're mentioned.
  - Our song is listed as a Plus feature.
  - The Nudges tile now says "What buzzes your phone".

Claude, 23 Nov, first checkpoint (`95ee153`): PR #1 went onto `main` with these changes:

- The Apple Music crash fix (`NSAppleMusicUsageDescription`).
- Our song stays in step on slow connections.
- The record shelf as designed.

## What was actually tested

- **`95ee153`, iPhone CI:** the build succeeded and 100 core tests passed. The `record-sheet` screenshot matches the
  design. The website went live and its shelf was checked on soultied.app.
- **This checkpoint, website:**
  - `tsc` and the production build pass.
  - Playwright at 390 × 844 in a local-mode build, with no page errors:
    - Names only, then the studio, then "How far apart". The answers fill the screen, and the date appears under the
      chosen answer. The answer is saved.
    - The Plus step with the moving picture. This was checked in a throwaway build with the offer forced on.
    - The invite screen.
    - Us: the quick question shows the next day and saves the answer. A tile opens as a centred card over a blurred
      page, and a click outside closes it.
- **This checkpoint, iPhone (`1730e48`, CI run #85):**
  - The build succeeded first time and 100 core tests passed. One new warning: `allowBluetooth` is deprecated in
    `VoiceViews.swift` (now `allowBluetoothHFP`, the same option under its new name).
  - The `about`, `about-plus`, `us-list`, `us-apart`, `us-notifications` and `widgets-keepsakes` screenshots look
    right. The Plus picture now shows, and the Us tiles open as floating cards.
  - The App Store build was made, but sending it to TestFlight failed. Xcode reported "The Internet connection
    appears to be offline", then "No profiles for 'app.soultied.ios' were found" (and the same for the widget). The
    run before it (`95ee153`) signed and sent fine, so this looks like a network blip.
  - The first re-send (`16ad648`) never ran: the iPhone workflow only starts when files under `native/` (and a few
    others) change, and that push only touched HANDOFF.md. The Bluetooth rename above touches `native/`, so its push
    builds and sends the app again.
- **The re-send (`b3ef993`, CI run #86)** built, signed and reached TestFlight (build 1086).
- **24 Nov checkpoint (before pushing):**
  - Website: `tsc` and the production build pass. Playwright at 390 × 844 in the demo room, with no page errors:
    the record player opens over a blurred room; each sleeve shows its artist; Lo-fi evening, Soft piano and Retro
    arcade each load `audio/shelf/<song>.mp3` and the card credits the right artist with working links. (This used
    stand-in tones, because this sandbox can't reach incompetech or the Free Music Archive.)
  - `shelf-audio.mjs` was tried against local copies of the jazz MP3s: a song is padded or trimmed to its exact
    length at about -22 LUFS, 96 kbps, 32 kHz; a wrong-length file and a missing one are both refused; songs already
    made are skipped; without ffmpeg it only warns off GitHub. **The real downloads first happen in the site
    workflow on this push.** If a song can't be made there, the build stops and the run page shows a
    "Record shelf" error naming it.
  - Coasters: simulated a puck wedged in each corner (it now comes out) and one resting on a rail (it's pushed back
    into play). The new fixtures cover the shelf on both sides.
  - Not built on a Mac yet: the Swift changes (frosted sheets, the shelf, Coasters) get their first build in CI.
- **Not tested:** anything on a real iPhone, two-phone Our song, StoreKit, and the widgets on a real home screen.

## The plan from Vedanth's 24 Nov video

1. Frosted menus, real music, the air hockey corners. **Done (this checkpoint).**
2. Games fill the screen (no tab bar, sideways for action games, a backdrop, sounds, a countdown, a win screen,
   your person's reactions along the edge) and house rules: a fun rule card at the start of each live game, with one
   reroll. Then the final review and the App Store submission.
3. **Trust Fall:** a co-op platformer full of unfair traps, in the spirit of Unfair Mario but our own name,
   characters and levels. 10 levels; the first 3 are free, the rest are Plus.
4. **Trap Swap** (you build traps on each other's level, then race through) and **Tied** (two characters tied by a
   thread, climbing a tower). Both Plus. All three share one platformer engine, on web and iPhone.

The new games ship as an update after the App Store submission.

## Next unfinished step

1. Check this push: the site workflow made all 15 shelf songs (its summary says "Record shelf songs: 15 made"), the
   iPhone build and tests pass, and the frosted menus look right in the CI screenshots. Then start step 2 of the
   plan.
2. Vedanth: tick MusicKit under Identifiers › `app.soultied.ios` › App Services.
3. Vedanth: try the TestFlight build. Run the two-phone Our song checklist below, go through onboarding as a new
   person, and add both new widgets.
4. Final review before the App Store (Claude): checks, security and privacy (Firestore rules, keys, what's
   collected), App Store metadata and screenshots, then submit.

### Two-iPhone checklist for Our song

Both phones need the new build, the same couple, and their own Apple Music subscription. Pass if the two phones are
within about 1 s of each other by ear.

1. On each phone, go to Record player › Our song › Choose › Connect Apple Music › Allow. It shouldn't crash.
   - If search says "Search couldn't load", MusicKit isn't enabled on the App ID.
2. Phone A picks a song of 3 minutes or more. Phone B starts it within a few seconds.
3. B swipes the app away, waits a minute and reopens it. B joins at A's spot, not at 0:00.
4. B pauses: both stop. A resumes: both carry on from the same spot. B taps +15 sec: both jump.
5. A goes to the home screen for 20 s and comes back. A rejoins at the shared spot.
6. A opens Control Center and changes the volume. The song keeps playing.
7. A taps a shelf record. Apple Music stops on both phones and the record plays on both. Picking "Play …" under Our
   song brings the song back on both.
8. Start a shelf record on soultied.app while the song plays. It stops on both phones.

## Working in this repo

- Never commit `zz-test.config.ts`. New files use LF line endings.
- Keep the TypeScript and Swift versions in step. Shared logic gets fixtures in `scripts/native-fixtures.ts` and
  matching tests in `native/SoultiedCore/Tests`.
- Put `[testflight]` in a commit message to send an iPhone build. The push must change something the iPhone workflow
  watches (`native/**` and the other paths in `native-ios.yml`), or nothing runs. CI screenshots go to the
  `native-shots` branch.
- Words: cosy, but clear about what a feature does. Explain anything Soultied-only (stitches, After dark) the first
  time it comes up.
- Style rules:
  - Pixelify Sans only.
  - Pixel characters only.
  - No service logos.
  - Aanya and Rohan are made up.
