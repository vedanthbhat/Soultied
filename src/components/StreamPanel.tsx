import React from 'react';
import { useApp } from '../context/AppContext';
import { useStreamHub } from '../stream/StreamHub';
import { clock } from '../stream/protocol';

/** Netflix & Prime Video together: set-up, the two buttons, and where you left off. */
export const StreamPanel: React.FC = () => {
  const hub = useStreamHub();
  const { partnerUser, cloudMode, cloudEnabled } = useApp();
  const name = partnerUser?.name || 'your person';
  if (!hub) return null;

  const open = (url: string) => window.open(url, '_blank', 'noopener');
  const recent = Object.values(hub.log.shows)
    .sort((a, b) => b.at - a.at)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-[var(--muted)]">
        Play, pause and skip stay in sync, with a chat, reactions and your two characters on a little couch in the corner of the
        show. You each need your own Netflix or Prime account.
      </p>

      {hub.extension === 'checking' && <p className="m-0">Looking for the Soultied extension…</p>}

      {hub.extension === 'missing' && (
        <div className="px-inset p-4 flex flex-col gap-2 text-sm">
          <strong className="text-base">First, add the Soultied extension</strong>
          <span>It works in Chrome, Edge or Brave on a computer, and you both need it.</span>
          <ol className="m-0 pl-5 flex flex-col gap-1">
            <li>
              <a href="/soultied-extension.zip" download className="underline">
                Download the Soultied extension
              </a>{' '}
              and unzip it.
            </li>
            <li>
              Open <code>chrome://extensions</code> and switch on <strong>Developer mode</strong> (top right).
            </li>
            <li>
              Click <strong>Load unpacked</strong> and pick the unzipped folder.
            </li>
            <li>Come back and refresh this page.</li>
          </ol>
        </div>
      )}

      {hub.extension === 'present' && (
        <>
          {!partnerUser && <p className="m-0 text-[#7f3835]">Invite your person first, so there's someone on the couch with you.</p>}
          {cloudEnabled && !cloudMode && partnerUser && (
            <p className="m-0 text-[#7f3835]">This place only lives in this browser. Move it online (under “Our place”) so {name} can watch from their computer.</p>
          )}
          <div className="flex gap-3 flex-wrap">
            <button className="px-btn" onClick={() => open('https://www.netflix.com/browse')}>
              Open Netflix
            </button>
            <button className="px-btn" onClick={() => open('https://www.primevideo.com/')}>
              Open Prime Video
            </button>
            {partnerUser && (
              <button className="px-btn px-btn--sage" onClick={hub.openCams}>
                {hub.camsOpen ? 'Cameras open' : 'Pop out cameras'}
              </button>
            )}
          </div>
          <ul className="m-0 pl-5 text-sm flex flex-col gap-1">
            <li>Start anything. When {name} opens the same thing, you snap into sync.</li>
            <li>Keep this Soultied tab open while you watch. It carries everything between the two of you.</li>
            <li>Hold T to talk. The show turns down while either of you is talking.</li>
            <li>The cameras window stays on top of the show (in Chrome and Edge).</li>
          </ul>
          {recent.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="px-label">Where you left off together</span>
              {recent.map((s) => (
                <div key={s.key} className="px-inset px-3 py-2 flex items-center justify-between gap-3 text-sm">
                  <span>
                    <strong>{s.show}</strong>
                    {s.episode ? ` · ${s.episode.split(' · ')[0]}` : ''} at {clock(s.pos)}
                  </span>
                  <button
                    className="px-btn px-btn--paper px-btn--small shrink-0"
                    onClick={() => open(s.key.startsWith('netflix:') ? `${s.url}?t=${Math.floor(s.pos)}` : s.url)}
                  >
                    Continue
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
