import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import * as store from '../cloud/store';
import { useStreamHub } from '../stream/StreamHub';
import { TRACKS, Track, TurntableState, startFor, trackUrl, whereAt } from './records';

/** A record left on switches itself off after a while, so nobody walks back in to music hours later. */
const AUTO_OFF_MS = 2 * 60 * 60 * 1000;
const FADE_IN_MS = 1400;
const FADE_OUT_MS = 500;

interface TurntableValue {
  /** a record is on (for both of you) */
  on: boolean;
  track: Track | null;
  /** who put it on */
  by: string | null;
  /** sound is actually coming out of this device */
  hearing: boolean;
  /** the browser wants a tap before it'll play sound */
  blocked: boolean;
  /** you've muted it just for yourself */
  mutedForMe: boolean;
  /** paused here while you watch something */
  hushed: boolean;
  volume: number;
  toggle: () => void;
  skip: () => void;
  listen: () => void;
  setVolume: (v: number) => void;
  setMutedForMe: (m: boolean) => void;
}

const Ctx = createContext<TurntableValue | null>(null);

const localKey = (sid: string) => `soultied_turntable_${sid}`;
const PREFS_KEY = 'soultied_turntable_prefs';

function readPrefs(): { volume: number; muted: boolean } {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    return { volume: typeof p.volume === 'number' ? Math.max(0, Math.min(1, p.volume)) : 0.6, muted: !!p.muted };
  } catch {
    return { volume: 0.6, muted: false };
  }
}

function loadLocal(sid: string): TurntableState | null {
  try {
    const raw = localStorage.getItem(localKey(sid));
    return raw ? (JSON.parse(raw) as TurntableState) : null;
  } catch {
    return null;
  }
}

const isOn = (t: TurntableState | null, now = Date.now()) => !!t && t.on && now - t.at < AUTO_OFF_MS;

/**
 * The record player in the living room. When one of you puts a record on, it
 * plays for both of you (each from your own copy of the same track, at the same
 * spot); either of you can skip or lift the needle, and each of you can turn it
 * down or mute it just for yourself.
 */
export const TurntableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, space, cloudMode, cloudTarget, panel } = useApp();
  const hub = useStreamHub();
  const sid = space?.id || 'solo';
  const me = currentUser.id;

  const [rec, setRec] = useState<TurntableState | null>(() => (cloudMode ? null : loadLocal(sid)));
  const recRef = useRef(rec);
  recRef.current = rec;
  const [prefs, setPrefs] = useState(readPrefs);
  const [blocked, setBlocked] = useState(false);
  const [hearing, setHearing] = useState(false);
  const [, setTick] = useState(0);

  /* ---------- the shared state ---------- */
  useEffect(() => {
    if (!cloudMode) return;
    const o = cloudTarget();
    if (!o) return;
    setRec(null);
    return store.subscribeTurntable(o.db, o.sid, setRec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMode, sid, me]);

  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (cloudMode) return;
    setRec(loadLocal(sid));
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`soultied-turntable-${sid}`) : null;
    bcRef.current = bc;
    // the message carries the new state (another tab's localStorage write can arrive after its message)
    if (bc) bc.onmessage = (e: MessageEvent) => setRec(e.data && typeof e.data === 'object' ? (e.data as TurntableState) : loadLocal(sid));
    const onStorage = (e: StorageEvent) => {
      if (e.key === localKey(sid)) setRec(loadLocal(sid));
    };
    window.addEventListener('storage', onStorage);
    return () => {
      bc?.close();
      bcRef.current = null;
      window.removeEventListener('storage', onStorage);
    };
  }, [cloudMode, sid]);

  const write = useCallback(
    (t: TurntableState) => {
      recRef.current = t;
      setRec(t);
      const o = cloudMode ? cloudTarget() : null;
      if (o) store.writeTurntable(o.db, o.sid, t).catch((e) => console.warn('[soultied] turntable', e));
      else {
        try {
          localStorage.setItem(localKey(sid), JSON.stringify(t));
        } catch {
          // ignore
        }
        bcRef.current?.postMessage(t);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cloudMode, sid]
  );

  /* ---------- the sound ---------- */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  const audio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'none';
      a.volume = 0;
      audioRef.current = a;
    }
    return audioRef.current;
  };

  const fadeTo = (target: number, ms: number, then?: () => void) => {
    const a = audioRef.current;
    if (!a) return then?.();
    if (fadeRef.current) window.clearInterval(fadeRef.current);
    const from = a.volume;
    const t0 = performance.now();
    fadeRef.current = window.setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k >= 1) {
        if (fadeRef.current) window.clearInterval(fadeRef.current);
        fadeRef.current = null;
        then?.();
      }
    }, 40);
  };

  const on = isOn(rec);
  const hushed = panel === 'watch' || !!hub?.active;
  const wantSound = on && !prefs.muted && !hushed;

  /** Line the player up with the record: the right track, at the right spot, playing or not. */
  const sync = useCallback(
    (fromGesture = false) => {
      const r = recRef.current;
      const a = audioRef.current;
      const want = isOn(r) && !prefsRef.current.muted && !(panel === 'watch' || !!hub?.active);
      if (!want || !r) {
        if (a && !a.paused)
          fadeTo(0, FADE_OUT_MS, () => {
            a.pause();
          });
        setHearing(false);
        return;
      }
      const now = Date.now();
      let { index, offset } = whereAt(r.startedAt, now);
      // right at the end of a track: go on to the next one rather than replaying the last moment
      if (offset > TRACKS[index].secs - 0.4) {
        index = (index + 1) % TRACKS.length;
        offset = 0;
      }
      const t = TRACKS[index];
      const el = audio();
      if (el.dataset.slug !== t.slug) {
        el.src = trackUrl(t);
        el.dataset.slug = t.slug;
        el.preload = 'auto';
        try {
          el.currentTime = offset;
        } catch {
          // set again once it knows its length
        }
        el.onloadedmetadata = () => {
          const r2 = recRef.current;
          if (!r2) return;
          const w = whereAt(r2.startedAt, Date.now());
          if (TRACKS[w.index].slug === el.dataset.slug && Math.abs(el.currentTime - w.offset) > 1.5) el.currentTime = w.offset;
        };
      } else if (el.readyState >= 1 && Math.abs(el.currentTime - offset) > 4) {
        el.currentTime = offset;
      }
      el.onended = () => sync();
      if (el.paused || fromGesture) {
        el.volume = 0;
        const p = el.play();
        const ok = () => {
          setBlocked(false);
          setHearing(true);
          fadeTo(prefsRef.current.volume, FADE_IN_MS);
        };
        if (p && typeof p.then === 'function')
          p.then(ok).catch((e: unknown) => {
            if ((e as { name?: string })?.name === 'NotAllowedError') setBlocked(true);
            setHearing(false);
          });
        else ok();
      } else if (!fadeRef.current) el.volume = prefsRef.current.volume;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel, hub?.active]
  );

  // follow the record as it changes, and keep an eye on it while it plays
  useEffect(() => {
    sync();
    if (!on) return;
    const t = window.setInterval(() => {
      sync();
      setTick((n) => n + 1);
    }, 5000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec, wantSound, on, sync]);

  // the record switching itself off: notice it even when nothing else changes
  useEffect(() => {
    if (!rec?.on) return;
    const left = rec.at + AUTO_OFF_MS - Date.now();
    if (left <= 0) return;
    const t = window.setTimeout(() => setTick((n) => n + 1), left + 100);
    return () => window.clearTimeout(t);
  }, [rec]);

  useEffect(
    () => () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current);
      audioRef.current?.pause();
    },
    []
  );

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ volume: prefs.volume, muted: prefs.muted }));
    } catch {
      // ignore
    }
    const a = audioRef.current;
    if (a && !a.paused && !fadeRef.current) a.volume = prefs.volume;
  }, [prefs]);

  /* ---------- the controls ---------- */
  const toggle = useCallback(() => {
    const now = Date.now();
    const r = recRef.current;
    if (isOn(r, now)) {
      const { index } = whereAt(r!.startedAt, now);
      write({ on: false, startedAt: r!.startedAt, by: me, at: now, next: (index + 1) % TRACKS.length });
      sync();
      return;
    }
    const next = r ? r.next % TRACKS.length : 0;
    write({ on: true, startedAt: startFor(next, now), by: me, at: now, next });
    if (prefsRef.current.muted) setPrefs((p) => ({ ...p, muted: false }));
    prefsRef.current = { ...prefsRef.current, muted: false };
    // start the sound inside the click, so the browser lets it play
    sync(true);
  }, [me, write, sync]);

  const skip = useCallback(() => {
    const now = Date.now();
    const r = recRef.current;
    if (!isOn(r, now)) return;
    const { index } = whereAt(r!.startedAt, now);
    write({ ...r!, startedAt: startFor(index + 1, now), by: me, at: now });
    sync(true);
  }, [me, write, sync]);

  const listen = useCallback(() => {
    if (prefsRef.current.muted) {
      prefsRef.current = { ...prefsRef.current, muted: false };
      setPrefs((p) => ({ ...p, muted: false }));
    }
    sync(true);
  }, [sync]);

  const setVolume = useCallback((v: number) => setPrefs((p) => ({ ...p, volume: Math.max(0, Math.min(1, v)) })), []);
  const setMutedForMe = useCallback(
    (m: boolean) => {
      prefsRef.current = { ...prefsRef.current, muted: m };
      setPrefs((p) => ({ ...p, muted: m }));
      if (m) sync();
      else sync(true);
    },
    [sync]
  );

  const now = Date.now();
  const track = on && rec ? TRACKS[whereAt(rec.startedAt, now).index] : null;
  const value = useMemo<TurntableValue>(
    () => ({
      on,
      track,
      by: on ? rec?.by || null : null,
      hearing,
      blocked: on && blocked && !prefs.muted && !hushed,
      mutedForMe: prefs.muted,
      hushed: on && hushed,
      volume: prefs.volume,
      toggle,
      skip,
      listen,
      setVolume,
      setMutedForMe,
    }),
    [on, track, rec?.by, hearing, blocked, prefs, hushed, toggle, skip, listen, setVolume, setMutedForMe]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useTurntable() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTurntable outside TurntableProvider');
  return v;
}
