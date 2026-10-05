# Chrome Web Store listing

Everything the Chrome Web Store dashboard asks for, kept here so each update uses the same words.

Package: `npm run build:extension:store`, then upload `extension/soultied-extension-<version>.zip`. Bump `version` in `manifest.json` for every update.

## Store listing

**Name** (from the manifest): Soultied: watch together

**Summary** (from the manifest, 132 characters max): Watch Netflix and Prime Video in sync with your person: send a link, then chat and react on a little pixel couch. No account needed.

**Category:** Entertainment

**Language:** English

**Description:**

```
Movie night, wherever you both are. Soultied keeps Netflix or Prime Video in sync for you and your person, with a chat and a little pixel couch in the corner of the show.

WATCH PARTY: NO ACCOUNT NEEDED
• Open a show, click the Soultied button, type your name and start a watch party.
• Send the link. When your person opens it, Soultied takes them to the same show, in sync.
• Free: synced playback, chat, reactions and the couch.

WATCH TOGETHER
• Play, pause and skipping stay in sync. Join halfway and you catch up to where your person is.
• If either of you is buffering or sitting through an ad, the show waits for them.
• When one of you moves on to the next episode, the other follows.
• "Take the remote": only one of you can pause and skip.
• Countdown start: you both press "I'm ready", then 3, 2, 1, and it plays for both of you at the same moment.
• A chat sidebar over the video, with little notes like "Rohan paused at 42:10", and reactions that float up from your side of the couch.

EVEN BETTER WITH A SOULTIED PLACE
Soultied (soultied.app) is a little home online for two people who live apart: a shared pixel room, a letter to open together every day, games, and movie nights. With a place:
• Pop your cameras out into a small window that stays on top of the show. Hold T to talk; the show turns itself down while either of you is talking.
• No watching ahead: Soultied remembers which episodes you've watched together and asks before you start the next one alone.
• "Where you left off together", and a night watching together counts as a day together on your couch.

You each need your own Netflix or Prime Video account. No video is shared between you, only play/pause and your chat.

No ads, no tracking. Works in Chrome, Edge and Brave on a computer.

Soultied isn't affiliated with, endorsed by or sponsored by Netflix or Amazon. Netflix and Prime Video are trademarks of their owners.
```

**Images** (kept outside the repo; the pixel art is drawn by scripts, and the screenshots are of the real extension on stand-in player pages with an original show):

- Store icon 128×128: `icons/128.png` from the build (96×96 heart with 16px clear space)
- Screenshots 1280×800: `1-sync.png`, `2-countdown.png`, `3-guard.png`, `4-wait.png`, `5-app.png`
- Small promo tile 440×280: `promo-small.png`
- Marquee 1400×560 (optional): `promo-marquee.png`

**Official URL:** none. **Homepage URL:** https://soultied.app/ **Support URL:** leave empty (the contact email, hello@soultied.app, is on the developer account)

## Privacy practices

**Single purpose:**

```
Lets two people watch Netflix or Prime Video in sync (from a watch-party link, or from a shared Soultied place), with a shared chat, reactions and a small couch drawn over the video.
```

**Permission justifications:**

`storage`:

```
Remembers on this computer the user's last Soultied session (their names, pixel characters and the list of episodes they've watched together, used for the "no watching ahead" check), the address of their Soultied tab, whether the chat panel is open, and for watch parties the name they typed, their pixel character and which party they're in.
```

`offscreen`:

```
While the user is in a watch party, a hidden extension page keeps the party connected: it holds the anonymous sign-in and the live connection to Soultied's database (Firebase) that carries play, pause and chat between the two people. It closes itself five minutes after the last Netflix / Prime tab closes. It runs only the extension's own packaged code.
```

`scripting`:

```
When the extension is installed or updated, Chrome doesn't run its scripts in tabs that are already open. The extension uses scripting only at that moment, to put its own packaged scripts into already-open Netflix, Prime Video and Soultied tabs, so they work without a refresh. It never runs code from anywhere else.
```

Host permissions (the same sites as the content scripts: netflix.com, primevideo.com and amazon.* /gp/video, plus Soultied's own site):

```
Netflix and Prime Video pages: reads the video player's state (playing or paused, the time, ads and buffering) and which title is playing (on Prime Video, from the title id in the player's own requests to Amazon, whose name it then asks Amazon for the same way the player does) to keep two people's playback in sync, and draws the chat sidebar and couch over the player. On netflix.com a small script runs in the page only to seek with Netflix's own player controls, because setting the video's time directly makes Netflix show an error. Nothing else on these sites is read.

Soultied pages (the Soultied website and soultied-c1543.web.app / firebaseapp.com): connects the extension to the user's signed-in Soultied tab, which carries sync and chat messages to their partner, and lets Soultied's watch-party link page (soultied.app/join/) hand a party link to the extension. On these pages the script does nothing until the page identifies itself as Soultied.
```

**Remote code:** No, I am not using remote code. (All code is in the package.)

**Data usage.** Collected:

- Personally identifiable information: yes (the display names the two people chose in Soultied, or typed for a watch party)
- Personal communications: yes (chat messages and reactions between the two people)
- Web history: yes (titles and episodes watched together, and where they stopped)
- Website content: yes (the show's title and episode name on screen)
- Authentication information: no (watch parties use an anonymous Firebase sign-in: a random ID, no password, email or Google account)
- Everything else (health, financial, location, user activity): no

Certify all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://soultied.app/privacy/ (source: `public/privacy/index.html`)

## Distribution

Free. All regions. Visibility: Unlisted at first (anyone with the link from Soultied's Watch page can install it), then Public.

## Notes for the reviewer (Test instructions)

```
Soultied connects two people. No account is needed for a watch party:

1. Install the extension in two Chrome profiles. In the first, open any Netflix or Prime Video title and press play. A small card offers "Start a watch party": type a name and press it (or use the toolbar button). The link is copied.
2. Open the link in the second profile. The page shows who started the party; type a name and press "Join the party". It opens the same title, and play, pause, skipping and chat stay in sync.

A Netflix or Prime Video subscription is needed on each side. With a Soultied place (sign in at https://soultied.app/ with Google, build a place, open the invite link in the second profile), the extension also connects through the signed-in Soultied tab.
```
