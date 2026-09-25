import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PixelAvatarRenderer } from './PixelAvatarRenderer';

export const SpacePanel: React.FC = () => {
  const { space, currentUser, partnerUser, inviteLink, regenerateInvite, resetAll, switchActiveUser } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
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
          <p className="text-xs text-[var(--muted)]">
            Preview build: open the link in this same browser to try the partner's side. Real two-device pairing
            arrives with the backend.
          </p>
        </div>
      )}

      {partnerUser && (
        <div className="px-inset p-4 text-sm">
          Prototype helper: you're viewing as <strong>{currentUser.name}</strong>.{' '}
          <button className="px-link" onClick={() => switchActiveUser(partnerUser.id)}>
            Switch to {partnerUser.name}
          </button>
        </div>
      )}

      <div className="px-divider" />
      <div className="flex items-center justify-between gap-3 flex-wrap text-sm">
        <span className="text-[var(--muted)]">Start over clears this browser's saved room.</span>
        {confirmReset ? (
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
    </div>
  );
};

export const LetterPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { partnerUser, space, progression, openPanel } = useApp();
  if (!partnerUser) {
    return (
      <div className="flex flex-col gap-4 items-start">
        <p className="text-xl leading-snug">
          Letters arrive once {space?.partnerPlaceholderName || 'your person'} moves in. Each day you'll both answer
          one little question in secret, then open the answers together.
        </p>
        <button className="px-btn px-btn--sage" onClick={() => openPanel('space')}>
          Send the invite
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {children}
      <div className="flex items-center gap-3 flex-wrap text-[var(--muted)]">
        <span className="font-semibold text-[var(--ink-soft)]">{progression.currentStreak} days of little moments</span>
        <span className="flex items-center gap-1.5" aria-label="This week">
          {progression.weekDots.map((d, i) => (
            <span key={i} className="inline-block w-3 h-3" style={{ background: d ? 'var(--thread)' : 'var(--paper-shade)' }} />
          ))}
        </span>
      </div>
    </div>
  );
};
