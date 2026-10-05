import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { COUCH_STEPS } from '../couch';
import * as store from '../cloud/store';
import type { LiveChannel } from '../cloud/live';
import type { WatchEvent } from '../watch/sync';
import { stuckMessage, type CallView, type WatchCall } from '../watch/call';
import { CallButtons, CamFrame, PartnerAudio, useWatchCall } from '../components/WatchCall';
import {
  EXT_SOURCE,
  HUB_SOURCE,
  emptyLog,
  titleLabel,
  type BridgeToPage,
  type ExtMsg,
  type HubMsg,
  type PageBody,
  type Session,
  type StreamEvent,
  type TitleInfo,
  type TogetherLog,
} from './protocol';

/**
 * Your Soultied tab, while you watch Netflix or Prime Video in another tab.
 *
 * The Soultied extension on the Netflix / Prime page can't sign in by itself,
 * so this tab (already signed in) does the talking: it hands the extension who
 * you both are, carries play / pause / chat between the two of you over the
 * live channel, remembers what you've watched together, and runs the cameras
 * and push-to-talk (in a little window that floats over the show).
 */

export type ExtensionState = 'checking' | 'missing' | 'present';

interface StreamHubValue {
  extension: ExtensionState;
  /** a Netflix / Prime tab with the extension is open */
  active: boolean;
  partnerWatching: boolean;
  call: WatchCall | null;
  view: CallView | null;
  camsOpen: boolean;
  openCams: () => void;
  log: TogetherLog;
}

const StreamHubContext = createContext<StreamHubValue | null>(null);
export const useStreamHub = () => useContext(StreamHubContext);

const LOCAL_LOG = 'soultied_stream_log';
const post = (body: PageBody) => window.postMessage({ source: HUB_SOURCE, ...body }, location.origin);
const toExt = (msg: HubMsg) => post({ kind: 'msg', msg });

export const StreamHubProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, partnerUser, space, setupComplete, demo, couchLevel, openLive, cloudTarget, cloudMode, addActivity } = useApp();
  const me = currentUser.id;
  const [extension, setExtension] = useState<ExtensionState>('checking');
  const [active, setActive] = useState(false);
  const [partnerSeen, setPartnerSeen] = useState(0);
  const [log, setLog] = useState<TogetherLog>(() => {
    try {
      return { ...emptyLog(), ...JSON.parse(localStorage.getItem(LOCAL_LOG) || '{}') };
    } catch {
      return emptyLog();
    }
  });
  const [, tick] = useState(0);
  const chanRef = useRef<LiveChannel<StreamEvent> | null>(null);
  const queue = useRef<StreamEvent[]>([]);
  const byeTimer = useRef(0);
  const logged = useRef(new Set<string>());

  /* ---------- who you both are ---------- */

  const session: Session | null = useMemo(() => {
    if (!setupComplete || !space || demo) return null;
    return {
      me: { id: me, name: currentUser.name, avatar: currentUser.avatar },
      partner: partnerUser ? { id: partnerUser.id, name: partnerUser.name, avatar: partnerUser.avatar } : null,
      leftId: space.creatorId,
      place: space.name,
      closeness: Math.min(1, couchLevel / COUCH_STEPS),
      log,
      hubUrl: location.origin + location.pathname,
    };
  }, [setupComplete, space, demo, me, currentUser.name, currentUser.avatar, partnerUser, couchLevel, log]);
  const sessionJson = JSON.stringify(session);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (extension === 'present') toExt({ kind: 'session', session: sessionRef.current });
  }, [sessionJson, extension]);

  /* ---------- what you've watched together ---------- */

  useEffect(() => {
    const t = cloudTarget();
    if (!t || !active) return;
    return store.subscribeStreamLog(t.db, t.sid, setLog);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMode, active, space?.id]);

  const recordWatched = (title: TitleInfo, pos: number) => {
    const t = cloudTarget();
    if (t) store.writeWatched(t.db, t.sid, title, pos).catch(() => undefined);
    else
      setLog((l) => {
        const next: TogetherLog = {
          seen: { ...l.seen, [title.key]: { show: title.show, episode: title.episode, at: Date.now() } },
          shows: { ...l.shows, [title.showKey]: { show: title.show, episode: title.episode, key: title.key, url: title.url, pos, at: Date.now() } },
        };
        try {
          localStorage.setItem(LOCAL_LOG, JSON.stringify(next));
        } catch {
          // storage full: fine, it's a nicety
        }
        return next;
      });
    // one line in your shared history per episode (only one of you writes it)
    const day = new Date().toDateString();
    const k = `${title.key}|${day}`;
    if (!logged.current.has(k) && partnerUser && me < partnerUser.id) {
      logged.current.add(k);
      addActivity({ type: 'watched_together', title: 'Watched together', description: `${titleLabel(title)} on ${title.platform === 'netflix' ? 'Netflix' : 'Prime Video'}.` });
    }
  };

  /* ---------- the live line to your person ---------- */

  const send = useCallback((e: StreamEvent) => {
    const ch = chanRef.current;
    if (ch) ch.send(e);
    else queue.current = [...queue.current.slice(-20), e];
  }, []);

  const { call, view } = useWatchCall(me, active && partnerUser ? partnerUser.id : null, (e) => send(e as StreamEvent));
  const callRef = useRef(call);
  callRef.current = call;

  useEffect(() => {
    if (!active || !session?.partner) return;
    const ch = openLive<StreamEvent>('stream');
    chanRef.current = ch;
    const off = ch.subscribe((e) => {
      if (e.by === me) return;
      if (e.type === 'rtc' || e.type === 'media') {
        void callRef.current?.handle(e as unknown as WatchEvent);
        return;
      }
      setPartnerSeen(e.type === 'bye' ? 0 : Date.now());
      toExt({ kind: 'event', e });
    });
    const waiting = queue.current;
    queue.current = [];
    waiting.forEach((e) => ch.send(e));
    return () => {
      off();
      ch.close();
      chanRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, openLive, !!session?.partner, me]);

  /* ---------- the extension ---------- */

  const onExt = (msg: ExtMsg) => {
    if (msg.kind === 'hello') {
      window.clearTimeout(byeTimer.current);
      setActive(true);
      toExt({ kind: 'session', session: sessionRef.current });
    } else if (msg.kind === 'send') send(msg.e);
    else if (msg.kind === 'watched') recordWatched(msg.title, msg.pos);
    else if (msg.kind === 'ptt') void callRef.current?.talk(msg.down);
    else if (msg.kind === 'bye') {
      window.clearTimeout(byeTimer.current);
      byeTimer.current = window.setTimeout(() => setActive(false), 8000);
    }
  };
  const onExtRef = useRef(onExt);
  onExtRef.current = onExt;

  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (ev.source !== window) return;
      const d = ev.data as BridgeToPage | undefined;
      if (!d || d.source !== EXT_SOURCE) return;
      if (d.kind === 'present') {
        setExtension('present');
        post({ kind: 'hub' });
      } else if (d.kind === 'msg') onExtRef.current(d.msg);
    };
    window.addEventListener('message', onMsg);
    post({ kind: 'probe' });
    const t = window.setTimeout(() => setExtension((x) => (x === 'checking' ? 'missing' : x)), 1500);
    return () => {
      window.removeEventListener('message', onMsg);
      window.clearTimeout(t);
    };
  }, []);

  /* ---------- cameras, in a little window that floats over the show ---------- */

  const [pip, setPip] = useState<Window | null>(null);
  const openCams = useCallback(() => {
    if (pip && !pip.closed) {
      pip.focus();
      return;
    }
    const setup = (w: Window | null) => {
      if (!w) return;
      const d = w.document;
      d.title = 'Soultied cameras';
      const base = d.createElement('base');
      base.href = location.href;
      d.head.append(base);
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((n) => {
        const copy = n.cloneNode(true) as HTMLElement;
        if (copy instanceof HTMLLinkElement) copy.href = (n as HTMLLinkElement).href;
        d.head.append(copy);
      });
      d.body.style.margin = '0';
      d.body.style.background = '#1d1512';
      w.addEventListener('pagehide', () => setPip(null));
      setPip(w);
    };
    const dpip = (window as unknown as { documentPictureInPicture?: { requestWindow(o: object): Promise<Window> } }).documentPictureInPicture;
    if (dpip)
      dpip
        .requestWindow({ width: 300, height: 470 })
        .then(setup)
        .catch(() => setup(window.open('', 'soultied-cams', 'popup,width=300,height=470')));
    else setup(window.open('', 'soultied-cams', 'popup,width=300,height=470'));
    // ask for the mic now (muted), so holding T on Netflix can talk straight away
    void callRef.current?.prepareMic();
  }, [pip]);

  useEffect(() => () => pip?.close(), [pip]);

  // who's talking: the extension turns the show down
  useEffect(() => {
    if (extension !== 'present') return;
    toExt({ kind: 'voice', mine: !!view?.talking, partner: !!view?.partnerTalking, cams: !!pip });
  }, [extension, view?.talking, view?.partnerTalking, pip]);

  // re-check "is your person watching" now and then
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => tick((n) => n + 1), 15000);
    return () => window.clearInterval(t);
  }, [active]);

  const partnerWatching = active && Date.now() - partnerSeen < 50000;
  const [audioBlocked, setAudioBlocked] = useState(false);

  const value: StreamHubValue = { extension, active, partnerWatching, call, view, camsOpen: !!pip, openCams, log };
  const partnerName = partnerUser?.name || 'your person';

  return (
    <StreamHubContext.Provider value={value}>
      {children}
      {active && view?.remote && <PartnerAudio stream={view.remote} onBlocked={setAudioBlocked} />}
      {active && audioBlocked && view?.remote && (
        <div className="fixed right-4 bottom-20 z-50 px-ui">
          <button
            className="px-btn px-btn--sage px-btn--small"
            onClick={() => document.querySelectorAll('audio').forEach((a) => a.play().then(() => setAudioBlocked(false), () => undefined))}
          >
            Hear {partnerName}
          </button>
        </div>
      )}
      {pip &&
        view &&
        createPortal(
          <CamsWindow call={call} view={view} partnerName={partnerName} partnerAvatar={partnerUser?.avatar || null} me={currentUser} />,
          pip.document.body
        )}
    </StreamHubContext.Provider>
  );
};

const CamsWindow: React.FC<{
  call: WatchCall | null;
  view: CallView;
  partnerName: string;
  partnerAvatar: Session['me']['avatar'] | null;
  me: { name: string; avatar: Session['me']['avatar'] };
}> = ({ call, view, partnerName, partnerAvatar, me }) => (
  <div className="px-ui flex flex-col items-center gap-3 p-3" style={{ minHeight: '100vh', background: '#1d1512', color: '#e9d7b7' }}>
    <style>{`
      @keyframes call-wave { 0%, 100% { transform: scaleY(.4); } 50% { transform: scaleY(1); } }
      .call-wave-bar { transform-origin: bottom; animation: call-wave 480ms steps(3) infinite; }
    `}</style>
    <CamFrame stream={view.remote} on={view.partnerCam} name={partnerName} avatar={partnerAvatar} talking={view.partnerTalking} width={250} stuck={view.stuck} />
    <CamFrame stream={view.local} on={view.camOn} mine name={me.name} avatar={me.avatar} talking={view.talking} width={140} />
    <div className="flex gap-2 flex-wrap justify-center">
      <CallButtons call={call} view={view} partnerName={partnerName} />
    </div>
    <p className="text-xs text-center m-0" style={{ color: '#cdb9a0' }}>
      On Netflix or Prime, hold T to talk. The show turns down while either of you talks.
    </p>
    {view.stuck && (view.camOn || view.partnerCam || view.talking || view.partnerTalking) && (
      <p className="text-xs text-center m-0" style={{ color: '#f3a19c' }}>
        {stuckMessage(partnerName)}
      </p>
    )}
    {view.error && (
      <p className="text-xs text-center m-0" style={{ color: '#f3a19c' }}>
        {view.error}
      </p>
    )}
  </div>
);

/** A small card in the room while a Netflix / Prime tab is open. */
export const StreamChip: React.FC = () => {
  const hub = useStreamHub();
  const { partnerUser } = useApp();
  if (!hub?.active) return null;
  const name = partnerUser?.name || 'your person';
  return (
    <div className="fixed left-4 bottom-4 z-30 px-ui max-w-[92vw]" role="status">
      <div className="px-box px-shadow px-3 py-2 flex items-center gap-3 flex-wrap">
        <span className={`inline-block w-2.5 h-2.5 ${hub.partnerWatching ? 'bg-[var(--sage)]' : 'bg-[#b9a98f]'}`} />
        <span className="text-sm">
          {hub.partnerWatching ? `Watching with ${name}.` : `Your show is open. ${name} isn’t on yet.`} Keep this tab open.
        </span>
        {partnerUser && (
          <button className="px-btn px-btn--sage px-btn--small" onClick={hub.openCams}>
            {hub.camsOpen ? 'Cameras open' : 'Pop out cameras'}
          </button>
        )}
      </div>
    </div>
  );
};
