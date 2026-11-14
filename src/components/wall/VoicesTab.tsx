import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { UserProfile } from '../../types';
import { useSharedList } from '../../together/useSharedList';
import { newKey } from '../../together/useSharedDoc';
import { type Voice, VOICE_MAX_CHARS, VOICE_MAX_SECS, normalizeVoice, peaksFrom, recordableMime, voiceLength } from '../../together/voice';
import { DEMO_VOICE_AUDIO, DEMO_VOICE_LEVELS } from '../../together/voiceDemo';
import { PixelIcon } from '../letters/PixelIcon';

/**
 * Voices: up to a minute of you, left on the wall. Record, listen back, send; your person sees there's a voice
 * note for them, and plays it here (or on their iPhone).
 */

const PLAY = { rows: ['k.....', 'kkk...', 'kkkkk.', 'kkkkkk', 'kkkkk.', 'kkk...', 'k.....'], pal: { k: '#3a2a26' } };
const PAUSE = { rows: ['kk.kk', 'kk.kk', 'kk.kk', 'kk.kk', 'kk.kk', 'kk.kk', 'kk.kk'], pal: { k: '#3a2a26' } };
const MIC = { rows: ['.rrr.', 'rrrrr', 'rrrrr', 'rrrrr', 'rrrrr', '.rrr.', 'k...k', '.kkk.', '..k..', '.kkk.'], pal: { r: '#c4453f', k: '#3a2a26' } };

const demoVoices = () => ({
  'voice-demo-1': { by: 'user-rohan', at: Date.now() - 5 * 3600e3, secs: 6.1, mime: 'audio/mp4', audio: DEMO_VOICE_AUDIO, peaks: peaksFrom(DEMO_VOICE_LEVELS), heard: {}, gone: false },
});

const ago = (at: number) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  return `${d} ${d === 1 ? 'day' : 'days'} ago`;
};

const toBase64 = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

/** the loudness bars, filled up to how far it's played */
const Bars: React.FC<{ peaks: number[]; played: number }> = ({ peaks, played }) => (
  <div className="flex items-center gap-[2px] h-[30px] flex-1 min-w-0" aria-hidden>
    {(peaks.length ? peaks : Array.from({ length: 24 }, () => 2)).map((p, i, all) => (
      <span key={i} className="block flex-1 max-w-[6px]" style={{ height: `${4 + p * 2.8}px`, background: i / all.length < played ? 'var(--terracotta, #b8674f)' : '#c9b89a' }} />
    ))}
  </div>
);

const VoiceRow: React.FC<{ v: Voice; mine: boolean; from: string; isNew: boolean; onHeard: () => void; onRemove: () => void }> = ({ v, mine, from, isNew, onHeard, onRemove }) => {
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [bad, setBad] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  useEffect(
    () => () => {
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    []
  );

  const toggle = () => {
    if (!audio.current) {
      const bytes = Uint8Array.from(atob(v.audio), (c) => c.charCodeAt(0));
      url.current = URL.createObjectURL(new Blob([bytes], { type: v.mime }));
      const a = new Audio(url.current);
      a.ontimeupdate = () => setT(a.currentTime);
      a.onended = () => {
        setPlaying(false);
        setT(0);
      };
      audio.current = a;
    }
    const a = audio.current;
    if (playing) {
      a.pause();
      setPlaying(false);
      return;
    }
    a.play()
      .then(() => {
        setPlaying(true);
        if (isNew) onHeard();
      })
      .catch(() => setBad(true));
  };

  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${mine ? 'bg-[#efe3cb]' : 'bg-[#fffaf0]'} border-2 border-[#3a2a26]`}>
      <button className="shrink-0 w-[40px] h-[40px] border-2 border-[#3a2a26] bg-[#f4e8d0] flex items-center justify-center" aria-label={playing ? 'Pause' : `Play the voice note from ${from}`} onClick={toggle}>
        <PixelIcon sprite={playing ? PAUSE : PLAY} scale={3} />
      </button>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <Bars peaks={v.peaks} played={v.secs ? t / v.secs : 0} />
        <div className="text-xs text-[var(--muted)] flex gap-2 flex-wrap">
          <span>{playing || t ? `${voiceLength(t)} / ${voiceLength(v.secs)}` : voiceLength(v.secs)}</span>
          <span>
            {mine ? 'from you' : `from ${from}`} · {ago(v.at)}
          </span>
          {isNew && <span className="text-[var(--terracotta-d,#8f4b3a)] font-bold">new</span>}
          {mine && Object.keys(v.heard).some((uid) => uid !== v.by) && <span>heard</span>}
        </div>
        {bad && <div className="text-xs text-[#7f3835]">This browser couldn’t play it. Try Chrome, Edge or Safari.</div>}
      </div>
      {mine && (
        <button className="shrink-0 p-1" aria-label="Take it down" title="Take it down" onClick={onRemove}>
          <PixelIcon name="cross" scale={2} />
        </button>
      )}
    </li>
  );
};

export const VoicesTab: React.FC<{ me: UserProfile; partnerName: string; onPinned: () => void }> = ({ me, partnerName, onPinned }) => {
  const voices = useSharedList<Voice>('voice-', normalizeVoice, demoVoices);
  const shown = useMemo(() => voices.items.filter((v) => !v.gone).sort((a, b) => b.at - a.at), [voices.items]);
  const mime = useMemo(recordableMime, []);

  const [stage, setStage] = useState<'idle' | 'asking' | 'recording' | 'ready' | 'sending'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const [draft, setDraft] = useState<{ blob: Blob; url: string; secs: number; peaks: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<{ recorder: MediaRecorder; stream: MediaStream; ctx: AudioContext; timer: number; started: number; levels: number[] } | null>(null);

  const cleanup = () => {
    const r = rec.current;
    if (!r) return;
    window.clearInterval(r.timer);
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close().catch(() => undefined);
    rec.current = null;
  };
  useEffect(() => () => cleanup(), []);
  useEffect(
    () => () => {
      if (draft?.url) URL.revokeObjectURL(draft.url);
    },
    [draft]
  );

  const start = async () => {
    if (!mime) return;
    setError(null);
    setDraft(null);
    setStage('asking');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32000 });
      const chunks: Blob[] = [];
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const levels: number[] = [];
      const started = Date.now();
      const timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const x of buf) sum += x * x;
        levels.push(Math.sqrt(sum / buf.length));
        const secs = (Date.now() - started) / 1000;
        setElapsed(secs);
        setLive(levels.slice(-24));
        if (secs >= VOICE_MAX_SECS) recorder.stop();
      }, 100);
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        const secs = Math.min(VOICE_MAX_SECS, (Date.now() - started) / 1000);
        cleanup();
        if (secs < 0.6) {
          setStage('idle');
          return;
        }
        const blob = new Blob(chunks, { type: 'audio/mp4' });
        setDraft({ blob, url: URL.createObjectURL(blob), secs, peaks: peaksFrom(levels) });
        setStage('ready');
      };
      rec.current = { recorder, stream, ctx, timer, started, levels };
      recorder.start(250);
      setElapsed(0);
      setLive([]);
      setStage('recording');
    } catch (e) {
      cleanup();
      setStage('idle');
      setError((e as Error)?.name === 'NotAllowedError' ? 'Your browser said no to the microphone. You can allow it for soultied.app in its settings.' : 'Couldn’t start the microphone just now.');
    }
  };

  const stop = () => rec.current?.recorder.state === 'recording' && rec.current.recorder.stop();

  const send = async () => {
    if (!draft) return;
    setStage('sending');
    try {
      const audio = await toBase64(draft.blob);
      if (audio.length > VOICE_MAX_CHARS) {
        setError('That one’s a little too big to send. Try a shorter one.');
        setStage('ready');
        return;
      }
      voices.put(newKey('voice-'), { by: me.id, at: Date.now(), secs: Math.round(draft.secs * 10) / 10, mime: 'audio/mp4', audio, peaks: draft.peaks, heard: {}, gone: false });
      onPinned();
      setDraft(null);
      setStage('idle');
    } catch {
      setError('That didn’t send. Try again.');
      setStage('ready');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="px-inset p-4 flex flex-col gap-3" aria-label="Record a voice note">
        <div className="leading-tight">
          <div className="text-lg font-bold">A voice note for {partnerName}</div>
          <div className="text-sm text-[var(--muted)]">Up to a minute. You can listen back before you send it.</div>
        </div>
        {!mime ? (
          <p className="m-0 text-sm text-[var(--muted)]">This browser can’t record ones your person’s iPhone can play. Record in Chrome, Edge or Safari (you can listen here either way).</p>
        ) : stage === 'recording' ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-3 h-3 bg-[#c4453f] animate-pulse" aria-hidden />
            <span className="font-bold tabular-nums">
              {voiceLength(elapsed)} / {voiceLength(VOICE_MAX_SECS)}
            </span>
            <Bars peaks={live.map((l) => Math.min(9, Math.round(l * 60)))} played={1} />
            <button className="px-btn px-btn--small" onClick={stop}>
              Stop
            </button>
          </div>
        ) : stage === 'ready' || stage === 'sending' ? (
          <div className="flex flex-col gap-2">
            {draft && <audio src={draft.url} controls className="w-full" />}
            <div className="flex gap-2 flex-wrap">
              <button className="px-btn px-btn--sage px-btn--small" disabled={stage === 'sending'} onClick={send}>
                {stage === 'sending' ? 'Sending…' : `Send it to ${partnerName}`}
              </button>
              <button className="px-btn px-btn--paper px-btn--small" disabled={stage === 'sending'} onClick={start}>
                Record again
              </button>
              <button className="px-btn px-btn--paper px-btn--small" disabled={stage === 'sending'} onClick={() => (setDraft(null), setStage('idle'))}>
                Bin it
              </button>
            </div>
          </div>
        ) : (
          <button className="px-btn self-start flex items-center gap-2" disabled={stage === 'asking'} onClick={start}>
            <PixelIcon sprite={MIC} scale={2} />
            {stage === 'asking' ? 'Asking for the microphone…' : 'Record'}
          </button>
        )}
        {error && (
          <p className="m-0 text-sm text-[#7f3835]" role="status">
            {error}
          </p>
        )}
      </section>

      {shown.length === 0 ? (
        <p className="m-0 text-sm text-[var(--muted)]">No voice notes yet. Leave the first one.</p>
      ) : (
        <ul className="m-0 p-0 list-none flex flex-col gap-2.5">
          {shown.map((v) => (
            <VoiceRow
              key={v.id}
              v={v}
              mine={v.by === me.id}
              from={partnerName}
              isNew={v.by !== me.id && !v.heard[me.id]}
              onHeard={() => voices.patch(v.id, { heard: { [me.id]: Date.now() } })}
              onRemove={() => voices.patch(v.id, { gone: true, audio: '' })}
            />
          ))}
        </ul>
      )}
    </div>
  );
};
