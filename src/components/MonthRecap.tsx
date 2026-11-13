import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTogether } from '../together/TogetherContext';
import { useSharedList } from '../together/useSharedList';
import { type Note, type Photo, normalizeNote, normalizePhoto, demoNotes } from '../together/wall';
import { type Recap, monthRecap, recapMonth } from '../together/recap';
import { scoreDay } from '../letters/cards';
import { todayKey } from '../letters/engine';
import { renderRoom, ROOM_W, type RoomState, type Seat } from '../pixel/room';
import { COUCH_STEPS } from '../couch';
import type { UserProfile } from '../types';

/**
 * Your month together: this month so far (or, in a month's first few days, the one just gone), in numbers, and
 * a picture of it to share: the two of you on the couch by the fire, and the month underneath.
 */

const noDemo = () => ({});

const statsOf = (r: Recap) => [
  { n: String(r.days), label: r.days === 1 ? 'day you both showed up' : 'days you both showed up' },
  { n: String(r.bestStreak), label: r.bestStreak === 1 ? 'day in a row, at best' : 'days in a row, at best' },
  { n: String(r.letters), label: r.letters === 1 ? 'letter opened together' : 'letters opened together' },
  { n: r.sync === null ? '–' : `${r.sync}%`, label: 'in sync' },
  { n: String(r.photos), label: r.photos === 1 ? 'photo pinned up' : 'photos pinned up' },
  { n: String(r.doodles + r.notes), label: 'doodles and notes' },
];

/** shorter, for the picture */
const shortOf = (r: Recap) => [
  { n: String(r.days), label: 'days both here' },
  { n: String(r.bestStreak), label: 'in a row, at best' },
  { n: String(r.letters), label: 'letters together' },
  { n: r.sync === null ? '–' : `${r.sync}%`, label: 'in sync' },
  { n: String(r.photos), label: r.photos === 1 ? 'photo' : 'photos' },
  { n: String(r.doodles + r.notes), label: 'doodles & notes' },
];

const titleOf = (r: Recap, done: boolean) => {
  const name = r.label.split(' ')[0];
  return done ? `Your ${name}` : `${name} so far`;
};

const seatOf = (u: UserProfile | null | undefined): Seat => (u ? { avatar: u.avatar, name: u.name, status: 'online' } : { avatar: null, name: '', status: 'empty' });

/** the picture, 1080 × 1350, as a PNG data: URL */
async function drawPicture(r: Recap, done: boolean, names: string, room: RoomState) {
  await Promise.all([document.fonts.load('700 72px "Pixelify Sans"'), document.fonts.load('400 30px "Pixelify Sans"')]).catch(() => undefined);
  const c = document.createElement('canvas');
  c.width = 1080;
  c.height = 1350;
  const g = c.getContext('2d')!;
  const font = (px: number, w = 400) => `${w} ${px}px "Pixelify Sans", sans-serif`;
  g.fillStyle = '#fbf3e2';
  g.fillRect(0, 0, c.width, c.height);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#3a2a26';
  g.font = font(84, 700);
  g.fillText(titleOf(r, done), 540, 130);
  g.fillStyle = '#7d6a5c';
  g.font = font(38);
  g.fillText(names, 540, 190);
  // the room, close around the fire and the couch, 6 times over
  const buf = renderRoom(room, 2.0);
  const [x0, y0, w, h] = [170, 34, 132, 112];
  const k = 6;
  const img = g.createImageData(w * k, h * k);
  for (let j = 0; j < h * k; j++)
    for (let i = 0; i < w * k; i++) {
      const from = ((y0 + Math.floor(j / k)) * ROOM_W + x0 + Math.floor(i / k)) * 4;
      const to = (j * w * k + i) * 4;
      img.data[to] = buf.data[from];
      img.data[to + 1] = buf.data[from + 1];
      img.data[to + 2] = buf.data[from + 2];
      img.data[to + 3] = 255;
    }
  const px = Math.round((1080 - w * k) / 2);
  g.fillStyle = '#3a2a26';
  g.fillRect(px - 9, 225 - 9, w * k + 18, h * k + 18);
  g.putImageData(img, px, 225);
  // the month, in numbers
  const top = 225 + h * k + 75;
  shortOf(r).forEach((s, i) => {
    const cx = 200 + (i % 3) * 340;
    const cy = top + Math.floor(i / 3) * 150;
    g.fillStyle = '#3a2a26';
    g.font = font(70, 700);
    g.fillText(s.n, cx, cy + 40);
    g.fillStyle = '#7d6a5c';
    g.font = font(30);
    g.fillText(s.label, cx, cy + 82);
  });
  g.fillStyle = '#a68a6d';
  g.font = font(30, 600);
  g.fillText('soultied.app', 540, 1318);
  return c.toDataURL('image/png');
}

export const MonthRecap: React.FC = () => {
  const { today, togetherDays, letters, currentUser, partnerUser, space, fire, couchLevel } = useApp();
  const { board } = useTogether();
  const photos = useSharedList<Photo>('photo-', normalizePhoto, noDemo);
  const notes = useSharedList<Note>('note-', normalizeNote, demoNotes);
  const [picture, setPicture] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { month, done } = recapMonth(today);
  const recap = useMemo(() => {
    const dayOf = (at: number) => todayKey(new Date(at));
    return monthRecap(
      {
        together: togetherDays,
        letters: Object.values(letters.daily).map((d) => {
          const s = d.revealedAt && partnerUser ? scoreDay(d, currentUser.id, partnerUser.id) : { same: 0, total: 0 };
          return { day: d.dateKey, opened: !!d.revealedAt, same: s.same, total: s.total };
        }),
        photos: photos.items.filter((p) => !p.gone).map((p) => dayOf(p.at)),
        notes: notes.items.filter((n) => !n.gone).map((n) => ({ day: dayOf(n.at), doodle: n.kind === 'doodle' })),
      },
      month
    );
  }, [togetherDays, letters.daily, photos.items, notes.items, currentUser.id, partnerUser, month]);

  if (!partnerUser || !space) return null;

  const creatorIsMe = space.creatorId === currentUser.id;
  const names = creatorIsMe ? `${currentUser.name} & ${partnerUser.name}` : `${partnerUser.name} & ${currentUser.name}`;
  const make = async () => {
    setBusy(true);
    try {
      const room: RoomState = {
        left: seatOf(creatorIsMe ? currentUser : partnerUser),
        right: seatOf(creatorIsMe ? partnerUser : currentUser),
        letterUnread: false,
        fire: 0.6,
        flame: fire.level,
        closeness: couchLevel / COUCH_STEPS,
        hover: null,
        heartAt: -1,
        wallArt: board.art,
      };
      setPicture(await drawPicture(recap, done, names, room));
    } finally {
      setBusy(false);
    }
  };
  const share = async () => {
    if (!picture) return;
    try {
      const blob = await (await fetch(picture)).blob();
      const file = new File([blob], `soultied-${month}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: titleOf(recap, done) });
    } catch {
      // (cancelled, or sharing isn't there: the save link still works)
    }
  };

  return (
    <section className="px-inset p-4 flex flex-col gap-3" aria-label="Your month together">
      <div className="leading-tight">
        <div className="text-xl font-bold">{titleOf(recap, done)}</div>
        <div className="text-sm text-[var(--muted)]">You and {partnerUser.name}, in numbers</div>
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
        {statsOf(recap).map((s) => (
          <div key={s.label} className="bg-[var(--paper-2,#efe3cb)] px-3 py-2 leading-tight">
            <div className="text-2xl font-bold">{s.n}</div>
            <div className="text-sm text-[var(--muted)]">{s.label}</div>
          </div>
        ))}
      </div>
      {picture ? (
        <div className="flex flex-col gap-3 px-fade">
          <img src={picture} alt={`${titleOf(recap, done)}: the two of you on the couch, and the month in numbers`} className="block w-[min(100%,360px)] shadow-[0_0_0_3px_#3a2a26,5px_5px_0_3px_rgba(0,0,0,0.2)]" />
          <div className="flex gap-3 flex-wrap">
            <a className="px-btn" href={picture} download={`soultied-${month}.png`}>
              Save the picture
            </a>
            {typeof navigator.share === 'function' && (
              <button className="px-btn px-btn--sage" onClick={share}>
                Share it
              </button>
            )}
          </div>
        </div>
      ) : (
        <button className="px-btn px-btn--sage self-start" disabled={busy} onClick={make}>
          {busy ? 'Drawing it…' : 'Make a picture to share'}
        </button>
      )}
    </section>
  );
};
