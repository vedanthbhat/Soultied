# Chrome Web Store listing

Everything the Chrome Web Store dashboard asks for, kept here so each update uses the same words.

Package: `npm run build:extension:store`, then upload `extension/soultied-extension-<version>.zip`. Bump `version` in `manifest.json` for every update.

## Store listing

**Name** (from the manifest, 75 characters max): Soultied: Watch Party for Netflix, Prime, Hotstar, Disney+, Crunchyroll

**Summary** (from the manifest, 132 characters max): Watch Netflix, Prime Video, JioHotstar, Disney+, Crunchyroll and more in sync with your person: send a link, chat on a pixel couch.

**Category:** Entertainment

**Language:** English

**Description:**

```
Movie night, wherever you both are. Soultied is a watch party for two: it keeps Netflix, Prime Video, JioHotstar, Disney+, Crunchyroll and more in sync for you and your person, with a chat and a little pixel couch in the corner of the show.

WORKS ON
Netflix and Prime Video, and (new, in beta) JioHotstar, Disney+, Crunchyroll and four more streaming services. The full list is in the screenshots and at soultied.app/watch

WATCH PARTY IN SECONDS, NO ACCOUNT NEEDED
• On Netflix or Prime Video, hover any show and press "Watch together". Anywhere else, start the show and press the Watch together tab on the right of the player. Your party starts and the link is copied.
• Send the link. When your person opens it, Soultied takes them to the same show, in sync.
• Free: synced playback, chat, reactions and the couch.

WATCH TOGETHER
• Play, pause and skipping stay in sync, within a fraction of a second. Join halfway and you catch up to where your person is.
• If either of you is buffering, sitting through an ad or steps away to another tab, the show pauses for both and carries on when they're back.
• Whatever one of you puts on, the other is taken there too.
• When one of you moves on to the next episode, the other follows: binge an anime season on Crunchyroll or a Disney+ series side by side.
• "Take the remote": only one of you can pause and skip.
• Countdown start: you both press "I'm ready", then 3, 2, 1, and it plays for both of you at the same moment.
• A chat sidebar over the video, with little notes like "Rohan paused at 42:10", and reactions that float up from your side of the couch.
• Leave whenever you like: your person is told, and keeps watching.

SOULTIED PLUS: SEE AND HEAR EACH OTHER
• Your cameras in the corner of the show. Unmute to talk, or hold T.
• Voice isolation: background noise (fans, traffic, the room) is taken out of your mic on your own computer, and it stays quiet between your words. On by default, with a switch.
• Volume sliders for your mic and their voice. The show eases down while someone's talking.
• The call carries on while you switch shows. Chrome asks for your camera and mic once, in a small Soultied window.
• One of you having Plus covers you both.

EVEN BETTER WITH A SOULTIED PLACE
Soultied (soultied.app) is a little home online for two people who live apart: a shared pixel room, a letter to open together every day, games, and movie nights. With a place:
• With Plus, pop your cameras out into a small window that stays on top of the show, and hold T to talk; the show turns itself down while either of you is talking.
• No watching ahead: Soultied remembers which episodes you've watched together and asks before you start the next one alone.
• "Where you left off together", and a night watching together counts as a day together on your couch.

You each need your own account on the service you watch. No video is shared between you, only play/pause and your chat. Shows and films only: live streams aren't supported yet.

No ads, no tracking. Works in Chrome, Edge and Brave on a computer.

Soultied isn't affiliated with, endorsed by or sponsored by any of the streaming services it works with. Their names are trademarks of their owners.
```

**Images** (kept outside the repo; the pixel art is drawn by scripts, and the screenshots are of the real extension on stand-in player pages with an original show):

- Store icon 128×128: `icons/128.png` from the build (96×96 heart with 16px clear space)
- Screenshots 1280×800 (five at most), in this order: `1-sync.png`, `6-services.png` (every service by name, in Soultied's own type: no service logos), `2-countdown.png`, `4-wait.png`, `5-app.png`. `3-guard.png` is kept in reserve.
- Brand names: the store's spam policy asks for at most five supported sites or brands listed in the description, and suggests a screenshot or a link for longer lists. So the description names five and points to the screenshot and soultied.app/watch, which link a page per service.
- Small promo tile 440×280: `promo-small.png`
- Marquee 1400×560 (optional): `promo-marquee.png`

**Official URL:** none. **Homepage URL:** https://soultied.app/ **Support URL:** leave empty (the contact email, hello@soultied.app, is on the developer account)

## Privacy practices

**Single purpose:**

```
Lets two people watch Netflix, Prime Video and other streaming sites (JioHotstar, Sony LIV, ZEE5, Disney+, Hulu, HBO Max, Crunchyroll) in sync (from a watch-party link, or from a shared Soultied place), with a shared chat, reactions and a small couch drawn over the video.
```

**Permission justifications:**

`storage`:

```
Remembers on this computer the user's last Soultied session (their names, pixel characters and the list of episodes they've watched together, used for the "no watching ahead" check), the address of their Soultied tab, whether the chat panel is open, and for watch parties the name they typed, their pixel character and which party they're in.
```

`offscreen`:

```
While the user is in a watch party, a hidden extension page keeps the party connected: it holds the anonymous sign-in and the live connection to Soultied's database (Firebase) that carries play, pause and chat between the two people. With Soultied Plus it also runs the party's video and voice call (reasons USER_MEDIA and WEB_RTC), so the call isn't dropped when the user moves from one show page to another; the camera and microphone are used only after the user presses the camera, unmute or talk button, and are switched off when no show tab has been open for a short while or the user leaves. It closes itself five minutes after the last streaming site's tab closes. It runs only the extension's own packaged code.
```

`scripting`:

```
When the extension is installed or updated, Chrome doesn't run its scripts in tabs that are already open. The extension uses scripting only at that moment, to put its own packaged scripts into already-open streaming-site and Soultied tabs, so they work without a refresh. On Crunchyroll, where the video player runs in a frame of its own, the extension's script in that frame also uses scripting to read the title and episode from the page around it (its address and the structured data the page publishes for search engines). It never runs code from anywhere else.
```

Host permissions (the same sites as the content scripts: netflix.com, primevideo.com and amazon.* /gp/video, hotstar.com, sonyliv.com, zee5.com, disneyplus.com, hulu.com, play.hbomax.com and play.max.com, crunchyroll.com and its player frame on static.crunchyroll.com, plus Soultied's own site):

```
Netflix and Prime Video pages: reads the video player's state (playing or paused, the time, ads and buffering) and which title is playing (on Prime Video, from the title id in the player's own requests to Amazon, whose name it then asks Amazon for the same way the player does) to keep two people's playback in sync, and draws the chat sidebar and couch over the player. On netflix.com a small script runs in the page only to seek with Netflix's own player controls, because setting the video's time directly makes Netflix show an error. Nothing else on these sites is read.

JioHotstar, Sony LIV, ZEE5, Disney+, Hulu, HBO Max and Crunchyroll pages: the same, through the page's video element: reads whether it's playing, the time, ads and buffering, and the title and episode from the page (its address, the player's own title labels, or the structured data the page publishes for search engines), plays, pauses and seeks the video to keep two people in sync, and draws the chat sidebar and couch over the player. Nothing else on these sites is read.

Soultied pages (the Soultied website and soultied-c1543.web.app / firebaseapp.com): connects the extension to the user's signed-in Soultied tab, which carries sync and chat messages to their partner, and lets Soultied's watch-party link page (soultied.app/join/) hand a party link to the extension. On these pages the script does nothing until the page identifies itself as Soultied.
```

**Remote code:** No, I am not using remote code. (All code is in the package. The one WebAssembly file, `rnnoise.wasm`, is RNNoise for voice isolation, packaged as published by `@jitsi/rnnoise-wasm`; the extension-page policy allows `'wasm-unsafe-eval'` only so that this packaged file can run.)

**Data usage.** Collected:

- Personally identifiable information: yes (the display names the two people chose in Soultied, or typed for a watch party)
- Personal communications: yes (chat messages and reactions between the two people, and with Soultied Plus their video and voice call, which goes directly between the two browsers, or through an encrypted relay when a network blocks that, and is never recorded or stored)
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

1. Install the extension in two Chrome profiles. In the first, open Netflix or Prime Video (or Sony LIV, whose free episodes play without an account), hover any title and press "Watch together" next to its Play button (or open a title and use the card on the right, or the toolbar button). Type a name; the party starts, the title opens and the link is copied.
2. Open the link in the second profile. The page shows who started the party; type a name and press "Join the party". It opens the same title, and play, pause, skipping and chat stay in sync. "Leave" on the chat panel (pressed twice) ends the party for that person.
3. Cameras and voice need Soultied Plus. To try them, open "I have a code" on the chat panel in a party and enter the code below; then "Camera on" (Chrome asks once, in a small Soultied window), "Unmute", and the "My mic" / "Their voice" sliders. Test code: [add a reviewer code here]

A Netflix or Prime Video subscription is needed on each side (Sony LIV and ZEE5 have free, ad-supported episodes that need no account). With a Soultied place (sign in at https://soultied.app/ with Google, build a place, open the invite link in the second profile), the extension also connects through the signed-in Soultied tab.
```
