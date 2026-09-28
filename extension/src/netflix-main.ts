/**
 * Runs inside the Netflix page itself, where Netflix's own player object lives.
 * Seeking by poking the <video> element directly makes Netflix throw an error
 * (M7375), so play / pause / seek / volume go through Netflix's player instead.
 * The extension asks over window.postMessage and this answers.
 */

interface NfPlayer {
  seek(ms: number): void;
  play(): void;
  pause(): void;
  setVolume?(v: number): void;
  getMovieId?(): number;
}

type AnyObj = Record<string, any>;

function api(): AnyObj | null {
  try {
    return (window as unknown as AnyObj).netflix?.appContext?.state?.playerApp?.getAPI?.()?.videoPlayer ?? null;
  } catch {
    return null;
  }
}

function player(): NfPlayer | null {
  const vp = api();
  if (!vp) return null;
  try {
    const ids: string[] = vp.getAllPlayerSessionIds?.() || [];
    const id = ids.find((s) => s.startsWith('watch')) || ids[ids.length - 1];
    return id ? (vp.getVideoPlayerBySessionId(id) as NfPlayer) : null;
  } catch {
    return null;
  }
}

/** Show name and "S2:E4 · Title" for the episode that's playing. */
function meta(): { show: string; episode: string; showId: string } | null {
  try {
    const p = player();
    const movieId = p?.getMovieId?.();
    const state = (window as unknown as AnyObj).netflix.appContext.state.playerApp.getState();
    const md = state.videoPlayer.videoMetadata[movieId as number];
    const v: AnyObj = md?.getMetadata?.()?._metadata?.video ?? md?._metadata?.video;
    if (!v) return null;
    if (v.type === 'show' && Array.isArray(v.seasons)) {
      for (const s of v.seasons as AnyObj[])
        for (const e of (s.episodes || []) as AnyObj[]) {
          const id = e.id ?? e.episodeId;
          if (id === v.currentEpisode || id === movieId)
            return { show: String(v.title), episode: `S${s.seq}:E${e.seq}${e.title ? ` · ${e.title}` : ''}`, showId: String(v.id) };
        }
    }
    return { show: String(v.title), episode: '', showId: String(v.id ?? movieId) };
  } catch {
    return null;
  }
}

window.addEventListener('message', (ev) => {
  if (ev.source !== window) return;
  const d = ev.data as { source?: string; id?: number; cmd?: string; arg?: number } | undefined;
  if (!d || d.source !== 'soultied-nf') return;
  const p = player();
  let ok = false;
  let out: unknown = null;
  try {
    if (d.cmd === 'seek' && p && typeof d.arg === 'number') {
      p.seek(Math.round(d.arg * 1000));
      ok = true;
    } else if (d.cmd === 'play' && p) {
      p.play();
      ok = true;
    } else if (d.cmd === 'pause' && p) {
      p.pause();
      ok = true;
    } else if (d.cmd === 'volume' && p?.setVolume && typeof d.arg === 'number') {
      p.setVolume(d.arg);
      ok = true;
    } else if (d.cmd === 'meta') {
      out = meta();
      ok = !!out;
    }
  } catch {
    ok = false;
  }
  window.postMessage({ source: 'soultied-nf-reply', id: d.id, ok, out }, location.origin);
});
