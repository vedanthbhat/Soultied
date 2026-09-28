import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PixelAvatarRenderer } from './PixelAvatarRenderer';

export const SpacePanel: React.FC = () => {
  const { space, currentUser, partnerUser, inviteLink, regenerateInvite, resetAll, switchActiveUser } = useApp();
  const { cloudEnabled, cloudMode, demo, signedInEmail, signOut, moveOnline, authError } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [moving, setMoving] = useState(false);
  if (!space) return null;

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const expires = new Date(space.inviteExpiresAt);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end gap-6 flex-wrap">
        <div className="flex items-end gap-2">
          <div className="flex flex-col items-center">
            <PixelAvatarRenderer config={currentUser.avatar} size={120} />
            <span className="text-sm font-semibold mt-1">{currentUser.name}</span>
          </div>
          <div className="flex flex-col items-center">
            {partnerUser ? (
              <>
                <PixelAvatarRenderer config={partnerUser.avatar} size={120} flipped />
                <span className="text-sm font-semibold mt-1">{partnerUser.name}</span>
              </>
            ) : (
              <>
                <div className="px-inset flex items-center justify-center text-3xl text-[var(--terracotta)]" style={{ width: 60, height: 120 }}>
                  +
                </div>
                <span className="text-sm font-semibold mt-1 text-[var(--muted)]">{space.partnerPlaceholderName}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[220px]">
          <div className="text-3xl font-bold leading-tight">{space.name}</div>
          <p className="text-[var(--muted)]">
            {partnerUser
              ? `${currentUser.name} & ${partnerUser.name} live here.`
              : `${space.partnerPlaceholderName}'s seat is saved. Send the link below.`}
          </p>
        </div>
      </div>

      {!partnerUser && (
        <div className="flex flex-col gap-4">
          <div>
            <span className="px-label">Invite link</span>
            <div className="flex gap-3">
              <input className="px-input text-sm" readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
              <button className="px-btn px-btn--sage shrink-0" onClick={() => copy('link', inviteLink)}>
                {copied === 'link' ? 'Copied!' : 'Copy link'}
              </button>
            </div>
          </div>
          <div>
            <span className="px-label">Invite code</span>
            <div className="flex gap-3">
              <div className="px-inset flex-1 text-center text-xl font-bold tracking-[0.12em] py-2 select-all">{space.inviteCode}</div>
              <button className="px-btn px-btn--paper shrink-0" onClick={() => copy('code', space.inviteCode)}>
                {copied === 'code' ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-sm text-[var(--muted)]">
              <span>Expires {expires.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              <button className="px-link text-sm" onClick={regenerateInvite}>
                Make a new code
              </button>
            </div>
          </div>
          {!cloudMode && (
            <p className="text-xs text-[var(--muted)]">
              {cloudEnabled
                ? 'This place only lives in this browser, so the invite only works here. Move it online (below) to invite someone on another device.'
                : "Preview build: open the link in this same browser to try the partner's side."}
            </p>
          )}
        </div>
      )}

      {partnerUser && !cloudMode && (
        <div className="px-inset p-4 text-sm">
          Prototype helper: you're viewing as <strong>{currentUser.name}</strong>.{' '}
          <button className="px-link" onClick={() => switchActiveUser(partnerUser.id)}>
            Switch to {partnerUser.name}
          </button>
        </div>
      )}

      {cloudEnabled && !cloudMode && !demo && (
        <div className="px-inset p-4 flex items-center justify-between gap-3 flex-wrap text-sm">
          <span>
            <strong>Move this place online</strong> so it follows you to any device and your person can join from theirs.
            {authError && <span className="block text-[var(--terracotta)] mt-1">{authError}</span>}
          </span>
          <button
            className="px-btn px-btn--sage px-btn--small"
            disabled={moving}
            onClick={async () => {
              setMoving(true);
              await moveOnline().finally(() => setMoving(false));
            }}
          >
            {moving ? 'Moving…' : 'Sign in with Google'}
          </button>
        </div>
      )}

      <div className="px-divider" />
      {cloudMode ? (
        <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
          <span className="text-[var(--muted)]">Signed in{signedInEmail ? ` as ${signedInEmail}` : ''}. Everything here is saved online.</span>
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      ) : (
      <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
        <span className="text-[var(--muted)]">{demo ? 'This is the demo room.' : "Start over clears this browser's saved room."}</span>
        {demo ? (
          <button className="px-btn px-btn--paper px-btn--small" onClick={resetAll}>
            Leave the demo
          </button>
        ) : confirmReset ? (
          <span className="flex gap-3">
            <button className="px-btn px-btn--small" onClick={resetAll}>
              Yes, clear it
            </button>
            <button className="px-btn px-btn--paper px-btn--small" onClick={() => setConfirmReset(false)}>
              Keep it
            </button>
          </span>
        ) : (
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => setConfirmReset(true)}>
            Start over
          </button>
        )}
      </div>
      )}
    </div>
  );
};
