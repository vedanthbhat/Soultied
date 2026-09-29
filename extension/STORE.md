# Chrome Web Store listing

Everything the Chrome Web Store dashboard asks for, kept here so each update uses the same words.

Package: `npm run build:extension:store`, then upload `extension/soultied-extension-<version>.zip`. Bump `version` in `manifest.json` for every update.

## Store listing

**Name** (from the manifest): Soultied: watch together

**Summary** (from the manifest, 132 characters max): Watch Netflix and Prime Video in sync with your person: chat, reactions, a little couch, and push-to-talk, from your Soultied place.

**Category:** Entertainment

**Language:** English

**Description:**

```
Movie night for long-distance couples. Soultied keeps Netflix or Prime Video in sync for the two of you and puts a little pixel couch in the corner of the show.

Soultied is a shared online place for two people who live apart. This extension connects your Soultied place to Netflix and Prime Video.

WATCH TOGETHER
• Play, pause and skipping stay in sync. Join halfway and you catch up to where your person is.
• If either of you is buffering or sitting through an ad, the show waits for them.
• When one of you moves on to the next episode, the other follows.
• "Take the remote": only one of you can pause and skip.
• Countdown start: you both press "I'm ready", then 3, 2, 1, and it plays for both of you at the same moment.

TALK WHILE YOU WATCH
• A chat sidebar over the video, with little notes like "Rohan paused at 42:10".
• Reactions that float up from your side of the couch.
• Pop your cameras out of Soultied into a small window that stays on top of the show.
• Hold T to talk. The show turns itself down while either of you is talking.

MADE FOR THE TWO OF YOU
• Couch corner: your two pixel characters sit on a couch in the corner of the show, as close as you've grown in Soultied.
• No watching ahead: Soultied remembers which episodes of your show you've watched together. If you start the next one alone, it pauses and asks first.
• "Where you left off together": pick up exactly where you stopped last time.
• A night watching together counts as a day together on your Soultied couch, and shows up in your place's activity.

HOW TO USE IT
1. Open your Soultied place and sign in.
2. Go to Watch together, then Netflix / Prime.
3. Open the same show. Keep your Soultied tab open while you watch.

You each need your own Netflix or Prime Video account. No video is shared between you, only play/pause and your chat.

Free. No ads, no tracking. Works in Chrome, Edge and Brave on a computer.

Soultied isn't affiliated with, endorsed by or sponsored by Netflix or Amazon. Netflix and Prime Video are trademarks of their owners.
```

**Images** (kept outside the repo; the pixel art is drawn by scripts, and the screenshots are of the real extension on stand-in player pages with an original show):

- Store icon 128×128: `icons/128.png` from the build (96×96 heart with 16px clear space)
- Screenshots 1280×800: `1-sync.png`, `2-countdown.png`, `3-guard.png`, `4-wait.png`, `5-app.png`
- Small promo tile 440×280: `promo-small.png`
- Marquee 1400×560 (optional): `promo-marquee.png`

**Official URL:** none. **Homepage URL:** https://soultied.app/ **Support URL:** https://github.com/vedanthbhat/Soultied/issues

## Privacy practices

**Single purpose:**

```
Lets two people who share a Soultied place watch Netflix or Prime Video in sync, with a shared chat, reactions and a small couch drawn over the video.
```

**Permission justifications:**

`storage`:

```
Remembers on this computer the user's last Soultied session (their names, pixel characters and the list of episodes they've watched together, used for the "no watching ahead" check), the address of their Soultied tab, and whether the chat panel is open.
```

Host permissions (content scripts on netflix.com, primevideo.com and amazon.* /gp/video, plus Soultied's own site):

```
Netflix and Prime Video pages: reads the video player's state (playing or paused, the time, ads and buffering) and the title on screen to keep two people's playback in sync, and draws the chat sidebar and couch over the player. On netflix.com a small script runs in the page only to seek with Netflix's own player controls, because setting the video's time directly makes Netflix show an error. Nothing else on these sites is read.

Soultied pages (the Soultied website and soultied-c1543.web.app / firebaseapp.com): connects the extension to the user's signed-in Soultied tab, which carries sync and chat messages to their partner. On these pages the script does nothing until the page identifies itself as Soultied.
```

**Remote code:** No, I am not using remote code. (All code is in the package.)

**Data usage.** Collected:

- Personally identifiable information: yes (the display names the two people chose in Soultied)
- Personal communications: yes (chat messages and reactions between the two people)
- Web history: yes (titles and episodes watched together, and where they stopped)
- Website content: yes (the show's title and episode name on screen)
- Everything else (health, financial, authentication, location, user activity): no

Certify all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/vedanthbhat/Soultied/blob/main/PRIVACY.md

## Distribution

Free. All regions. Visibility: Unlisted at first (anyone with the link from Soultied's Watch page can install it), then Public.

## Notes for the reviewer (Test instructions)

```
Soultied connects two people. To see the extension without a partner: install it, open any Netflix or Prime Video title and start playing. A small card appears offering to open Soultied, since the extension only syncs through a signed-in Soultied tab.

To see syncing: sign in at https://soultied.app/ with a Google account, build a place, and open the invite link in a second Chrome profile (also with the extension) signed in with another Google account. In both, go to Watch together > Netflix / Prime and open the same title. A Netflix or Prime Video subscription is needed on each side.
```
