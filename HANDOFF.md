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
- **Not tested:** anything on a real iPhone, two-phone Our song, StoreKit, and the widgets on a real home screen.

## Next unfinished step

1. Check that this re-send reaches TestFlight. If it fails on signing again, check that the App Store Connect key
   secrets still belong to the team that owns `app.soultied.ios`.
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
