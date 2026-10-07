import React, { useEffect, useRef, useState } from 'react';
import type { AvatarConfig } from '../types';
import type { WatchEvent } from '../watch/sync';
import { CallView, WatchCall } from '../watch/call';
import { AvatarThumb } from './PixelAvatarRenderer';

/** Owns one WatchCall for the lifetime of the watch room. */
export function useWatchCall(me: string, partnerId: string | null, send: (e: WatchEvent) => void) {
  const sendRef = useRef(send);
  sendRef.current = send;
  const [call, setCall] = useState<WatchCall | null>(null);
  const [view, setView] = useState<CallView | null>(null);

  useEffect(() => {
    const c = new WatchCall(me, (e) => sendRef.current(e));
    setCall(c);
    setView(c.view);
    const off = c.subscribe(() => setView(c.view));
    return () => {
      off();
      c.destroy();
      setCall(null);
    };
  }, [me]);

  useEffect(() => {
    call?.setPartner(partnerId);
  }, [call, partnerId]);

  return { call, view };
}

/** Hold the space bar to talk while your mic is muted (unless you're typing somewhere). */
export function usePushToTalkKey(call: WatchCall | null) {
  useEffect(() => {
    if (!call) return;
    const typing = (el: Element | null) =>
      !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || typing(document.activeElement)) return;
      e.preventDefault();
      void call.talk(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (!typing(document.activeElement)) e.preventDefault();
      void call.talk(false);
    };
    const release = () => void call.talk(false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
    };
  }, [call]);
}

/** The other person's voice. Kept apart from the picture so you hear them even with their camera off. */
export const PartnerAudio: React.FC<{ stream: MediaStream | null; onBlocked: (blocked: boolean) => void }> = ({ stream, onBlocked }) => {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    if (a.srcObject !== stream) a.srcObject = stream;
    if (!stream) return;
    a.play()
      .then(() => onBlocked(false))
      .catch(() => onBlocked(true));
  }, [stream, onBlocked]);
  return <audio ref={ref} autoPlay />;
};

const SoundWaves: React.FC = () => (
  <span className="inline-flex items-end gap-[2px]" aria-hidden="true" style={{ height: 10 }}>
    {[5, 9, 6, 10].map((h, i) => (
      <span key={i} className="call-wave-bar inline-block w-[3px] bg-current" style={{ height: h, animationDelay: `${i * 90}ms` }} />
    ))}
  </span>
);

/** A little pixel microphone (crossed out when it's muted). */
const MIC_PIXELS = [
  [2, 0, 3, 3], // the head
  [0, 3, 1, 2],
  [6, 3, 1, 2],
  [2, 3, 3, 1],
  [1, 5, 1, 1],
  [5, 5, 1, 1],
  [2, 6, 3, 1], // the stand
  [3, 7, 1, 1],
  [1, 8, 5, 1],
];
const MicIcon: React.FC<{ off?: boolean }> = ({ off }) => (
  <svg width="14" height="18" viewBox="0 0 7 9" aria-hidden="true" shapeRendering="crispEdges" style={{ flex: 'none' }}>
    <g opacity={off ? 0.55 : 1}>
      {MIC_PIXELS.map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" />
      ))}
    </g>
    {off && [0, 1, 2, 3, 4, 5, 6].map((i) => <rect key={`x${i}`} x={i} y={Math.round((i * 8) / 6)} width={1} height={1} fill="currentColor" />)}
  </svg>
);

/**
 * A little wooden picture frame on the wall with a live camera in it, or the
 * person's pixel face when their camera is off.
 */
export const CamFrame: React.FC<{
  stream: MediaStream | null;
  on: boolean;
  mine?: boolean;
  name: string;
  avatar: AvatarConfig | null;
  talking: boolean;
  /** their mic is unmuted (false shows a small muted mark; leave it out to show nothing) */
  micOpen?: boolean;
  width: number;
  /** their picture isn't getting through */
  stuck?: boolean;
}> = ({ stream, on, mine, name, avatar, talking, micOpen, width, stuck }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [frames, setFrames] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (v.srcObject !== stream) v.srcObject = stream;
    setFrames(false);
    if (!stream || !on) return;
    v.play().catch(() => undefined);
    // a camera switched back on sends the same size of picture, so no resize event says it's back: wait for a real frame
    let live = true;
    const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
    if (rvfc) rvfc.call(v, () => live && setFrames(v.videoWidth > 0));
    else if (v.videoWidth > 0) setFrames(true);
    return () => {
      live = false;
    };
  }, [stream, on]);
  const live = on && !!stream;
  return (
    <figure className="m-0 flex flex-col items-center" style={{ width }}>
      <div
        className="relative w-full"
        style={{
          aspectRatio: '4 / 3',
          background: '#1a1214',
          border: '6px solid #6b4633',
          boxShadow: talking
            ? '0 0 0 2px #2b1e1c, 0 0 0 6px #e2b359, 6px 6px 0 6px rgba(0,0,0,.35)'
            : '0 0 0 2px #2b1e1c, inset 0 0 0 2px #2b1e1c, 6px 6px 0 2px rgba(0,0,0,.35)',
          transition: 'box-shadow 120ms steps(2)',
        }}
      >
        <video
          ref={ref}
          autoPlay
          playsInline
          muted
          onLoadedData={(e) => setFrames(e.currentTarget.videoWidth > 0)}
          onResize={(e) => setFrames(e.currentTarget.videoWidth > 0)}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover', transform: mine ? 'scaleX(-1)' : undefined, visibility: live && frames ? 'visible' : 'hidden' }}
          aria-label={live ? `${name}'s camera` : undefined}
        />
        {!(live && frames) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5" style={{ color: '#cdb9a0' }}>
            {avatar && <AvatarThumb config={avatar} region="head" size={Math.round(width * 0.34)} />}
            <span className="text-xs text-center px-1">{!on ? 'Camera off' : stuck ? 'Can’t connect' : 'Connecting…'}</span>
          </div>
        )}
        {talking ? (
          <span className="absolute left-1.5 bottom-1.5 px-tag flex items-center gap-1.5" style={{ fontSize: 12 }}>
            <SoundWaves /> talking
          </span>
        ) : (
          micOpen === false && (
            <span className="absolute right-1.5 bottom-1.5 px-tag flex items-center" style={{ fontSize: 12, padding: '2px 4px' }} title={mine ? 'Your mic is muted' : `${name}'s mic is muted`}>
              <MicIcon off />
            </span>
          )
        )}
      </div>
      <figcaption className="px-box text-xs font-semibold px-2 py-0.5 -mt-1 relative whitespace-nowrap">
        {mine ? `${name} (you)` : name}
      </figcaption>
    </figure>
  );
};

/** Camera toggle, the mic's mute / unmute, and (while muted) hold to talk. */
export const CallButtons: React.FC<{ call: WatchCall | null; view: CallView | null; partnerName: string }> = ({
  call,
  view,
  partnerName,
}) => {
  if (!call || !view) return null;
  const release = () => void call.talk(false);
  return (
    <>
      <button
        className={`px-btn px-btn--small ${view.camOn ? 'px-btn--paper' : 'px-btn--sage'}`}
        onClick={() => void call.setCamera(!view.camOn)}
        disabled={view.busy === 'cam'}
        aria-pressed={view.camOn}
      >
        {view.busy === 'cam' ? 'Starting camera…' : view.camOn ? 'Camera off' : 'Camera on'}
      </button>
      <button
        className={`px-btn px-btn--small inline-flex items-center gap-1.5 ${view.micOpen ? 'px-btn--sage' : 'px-btn--paper'}`}
        onClick={() => void call.setMic(!view.micOpen)}
        disabled={view.busy === 'mic'}
        aria-pressed={view.micOpen}
        title={view.micOpen ? `${partnerName} can hear you. Click to mute.` : `Unmute to talk to ${partnerName} without holding anything`}
      >
        <MicIcon off={!view.micOpen} />
        {view.busy === 'mic' ? 'Allow the mic…' : view.micOpen ? 'Mute' : 'Unmute'}
      </button>
      {!view.micOpen && (
        <button
          className={`px-btn px-btn--small select-none touch-none ${view.talking ? '' : 'px-btn--paper'}`}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            void call.talk(true);
          }}
          onPointerUp={release}
          onPointerCancel={release}
          onContextMenu={(e) => e.preventDefault()}
          aria-pressed={view.talking}
          title={`Hold to talk to ${partnerName} (or hold the space bar)`}
        >
          {view.talking ? 'Talking…' : 'Hold to talk'}
        </button>
      )}
    </>
  );
};
