# Soultied privacy policy

_Last updated: 29 September 2026_

Soultied is a small shared place online for two people in a long-distance relationship, plus a browser extension for watching Netflix and Prime Video together. This page explains what each part handles, where it goes, and how to delete it. It is written by the person who builds Soultied, Vedanth Bhat. Questions or requests: hello@soultied.app.

The short version: what you put in Soultied is shared with your person and nobody else. There are no ads, no analytics or tracking, and nothing is sold.

## The Soultied website (soultied.app)

**Signing in.** You sign in with Google through Firebase Authentication (a Google service). Soultied receives your Google account's name, email address and a user ID. The email is only used to keep you signed in and to show you which account you're using.

**Your place.** When you build a place, or join one with your person's invite code, Soultied stores these in a Firebase Cloud Firestore database (Google Cloud, Mumbai region):

- the name you give yourselves and your place, and your pixel character
- your answers to the daily questions and letters
- your room, game progress and activity feed (for example "watched Episode 3 together")
- the list of shows and episodes you've watched together through the extension, and where you left off

Only the two members of a place can read it. The database rules enforce this. Invite codes expire and can only be used to join.

**Live messages.** Chat, reactions, play/pause/skip and video-call setup messages travel between you as small records in the same database. They're kept there, readable only by the two of you, until your place is deleted.

**Video and voice calls.** Cameras and microphones are only switched on when you press the button, and your browser asks for permission first. Calls go directly between your two browsers (WebRTC). They are not recorded or stored. Google's public STUN servers are used only to help your two browsers find each other.

**On this device.** The site keeps a copy of your place in your browser's local storage, so it opens quickly.

## The Soultied browser extension

The extension only runs on:

- Netflix and Prime Video pages, to keep your video in sync, and
- Soultied's own pages (soultied.app and soultied-c1543.web.app / .firebaseapp.com), to connect to your signed-in Soultied tab.

**What it reads on Netflix or Prime Video:** the video player's state (playing or paused, the time, whether an ad or buffering is happening) and the title and episode name on screen. It does not read your account, profile, payment details, viewing history or anything else on those sites. No video or audio from the show is ever copied or sent anywhere. You each watch on your own account.

**What it sends:** play, pause and skip events with the time and title, your chat messages and reactions. These go to your open Soultied tab, which passes them to your person as live messages (above). When you've watched an episode together, the title and where you stopped are added to your place's "watched together" list.

**What it keeps on your computer** (Chrome's extension storage, never uploaded by the extension itself): your last Soultied session (your name, your person's name, both pixel characters, your place's name and the watched-together list, used for the "no watching ahead" check), the address of your Soultied tab, and whether the chat panel is open.

**Permissions:** `storage` (the items above), plus access to the Netflix, Prime Video and Soultied pages listed. The extension doesn't use remote code, and it doesn't see other tabs or your browsing history.

## Who else sees your data

- **Your person**, who shares your place.
- **Google**, as the provider of Firebase Authentication and Cloud Firestore, processes the data to run the service, under [Google's Firebase terms and privacy commitments](https://firebase.google.com/support/privacy).
- **GitHub** hosts the website (GitHub Pages), and **Google Fonts** serves its font. Like any web host, they receive your IP address and browser details when the page loads.
- **No one else.** Soultied does not sell, rent or share your data, does not use it for advertising, and does not use it to decide on credit or lending.

## Deleting your data

- **Extension:** removing it from Chrome deletes everything it stored on your computer.
- **Website on this device:** sign out, or clear this site's data in your browser.
- **Your place online:** email hello@soultied.app from the Google account you use with Soultied. Your place and everything in it, including live messages, will be deleted within 30 days.

## Children

Soultied is made for couples and isn't directed at children. Please don't use it if you're under 13, or under the minimum age for online services where you live.

## Changes

If this policy changes, the new version will be posted here with a new date. The full history is in this repository.
