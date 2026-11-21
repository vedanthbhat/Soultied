# Handoff

Shared between Claude and Codex. Update this at every checkpoint. Claude uses Google AI Studio’s GitHub sync on `main`. The couples-app changes are on
`review/couples-widgets` in [draft PR #1](https://github.com/vedanthbhat/Soultied/pull/1). Check the current branch before editing.

## Couples-app review checkpoint · 19 November 2026

1. **Widgets.** Small and medium Doodle and Countdown use the bundled Pixelify Sans. Countdown opens the shared plan editor.
2. **Invite.** Sharing the invite is the primary action. The optional drawing uses the existing wall and picture frame. On iPhone the empty seat and Home invite buttons open the invite directly.
3. **Us.** Six tiles open details. The onboarding answer selects date or distance. People in the same city or home get date questions.
4. **Recap and Home.** The monthly tile features a saved memory, then an opened letter if available. Matching picks are still in the recap. Home gives unread partner activity priority and uses gentler copy after missed days.

Web checks passed for TypeScript and the production bundle. At a 390 × 844 viewport the demo opened and closed all six tiles and Settings, showed the recap metric and toggled a notification preference. In a local-mode build a fresh host drew and pinned a doodle from the invite, returned to the invite and reached the date question after selecting “We live together.” Live two-account delivery and the iPhone simulator still need verification on this branch. The original Plus and record-player work below is still open.

## Current goal

Build the approved designs, on the iPhone app (`native/`) and the website (`src/`) together:

1. **Us page, option A:** one screen with no scrolling. A compact couple card, then six tiles that fill the space down to
   the tab bar: How far, Our list, This month, Lately, You, Nudges. Each tile opens today's full card as a sheet.
   Account, the app's look, sounds and "Show me around" move behind a settings button in the top corner. A Plus
   strip sits at the bottom.
2. **Plus in onboarding:** a full screen after the 5 "about you" questions and before inviting your person.
   - It names one of their answers, then lists five benefits and "One of you pays, you both get it."
   - Year or month plan. The billed price is the most prominent price ("$29.99 a year", "works out at $2.50 a
     month" smaller), because Apple rejects screens that lead with the per-month figure.
   - "Start 7 days free" with a wiggle and shine about every 3 s, off when Reduce Motion is on.
   - "Continue with the free version", with "No hard feelings. Spoiler alert: Plus is so much more fun ;)" under it.
   - New picture: the couple under a blanket sharing popcorn, drawn by a script that isn't in the repo yet.
3. **Plus sheet (from Us):** keep the animated "Movie night, every night" header. Pin a bottom bar with the plan
   choice, the CTA, a price line, Not now, and Restore · Terms · Privacy. The benefit tiles stretch so there's no gap.
4. **Record player:**
   - Six records with 20 free-to-use songs, credited the way the jazz record is: Jazz café (5), then 3 each of Lo-fi
     evening, Soft piano, Acoustic morning, Rainy day and Retro arcade.
   - "Our song" from Apple Music as a Plus extra, for couples who both have Apple Music.
   - Remove YouTube song links from the record player.

The designs are on Vedanth's design canvas, "Soultied: Us page, Plus at onboarding, record shelf". It's private, so
ask him for a screenshot or to share it.

## What changed lately

- `8aab601`: song sync, Doodle Guess, touch animations, call band, and a TestFlight fix (build 1079).
  - YouTube songs stutter less: a song can be up to 5 s out of sync before it's corrected, there's a pause after a
    stall, and the audio session is only changed when needed (`src/music/songSync.ts`, `RecordPlayer.swift`).
  - Doodle Guess page is 80×60. Old 40×30 pages and ink are scaled up. Ink now carries `g: 80`.
  - Each touch has its own animation (`touchPose` and the effects in `room.ts` / `RoomLive.swift`).
  - Call band on every tab, in games and in escape rooms (`CallWatch.swift`).
  - `testflight.py` treats "another build is in review" as a notice, not a failure.
- `a3d6c40`: Netflix and Prime full screen (build 1080).
  - The player's full-screen button now only turns the app sideways or back upright.
  - The page is left untouched; restyling the player turned Netflix's protected picture black.
  - Files: `extension/src/ios/page.ts`, `StreamView.swift`.
- Builds 1079 and 1080 reached TestFlight but are waiting behind another build in Apple's beta review.

## What was actually tested

- Swift core tests: 99 pass, both on Linux and in CI run #79. The touch animations are checked pixel for pixel
  against the website in 66 new room scenes.
- App target: parse check on Linux. CI simulator builds succeeded (runs #79 and #80), and the CI call-band
  screenshots were checked (`facetime`, `facetime-play`, `facetime-letters`).
- Web: `tsc` and `vite build` succeed. Playwright e2e runs in a scratch folder that isn't in the repo: Doodle draw
  and guess, touches, small screens, tapes and the pet menu.
- Song sync: the iPhone page's JavaScript was checked against `songSync.ts` over 20,000 simulated checks.
- Full-screen shim: tested only in desktop Chromium with a stand-in page.
- **Not tested on a real iPhone:** the Netflix full-screen fix, the YouTube song fix, and how the call band lines up
  with the real FaceTime window.

## Next unfinished step

- Start goal 1 (Us option A) on both platforms, then goal 2, then 3, then 4.
- Vedanth: try build 1080 on a phone (Netflix full-screen button, YouTube songs) once Apple's review clears.

## Working in this repo

- Never commit `zz-test.config.ts`. New files use LF line endings.
- Keep the TypeScript and Swift versions in step. Shared logic gets fixtures in `scripts/native-fixtures.ts`, and
  matching tests in `native/SoultiedCore/Tests`.
- Include `[testflight]` in a commit message to send an iPhone build. CI screenshots go to the `native-shots` branch.
- Style rules:
  - Pixelify Sans only.
  - Pixel characters only.
  - No service logos.
  - Aanya and Rohan are made up.


### Review branch update, 21 November 2026

The Us screen previews the first two unfinished list items. You opens the appearance editor directly. The native place and decor buttons share a height. The record shelf supports six synchronized records. The five additional records are generated by the npm build and ios:assets hooks. Our song saves an Apple Music link for the couple and opens it externally. New users can continue free from the Plus offer after their questions. Verify layout, audio and StoreKit on the next native review build.
