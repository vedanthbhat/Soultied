import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AvatarThumb } from './PixelAvatarRenderer';

/**
 * The menu hides above the screen and slides down when the cursor touches
 * the top edge (or when anything inside it gets keyboard focus). On touch
 * screens a small tab stays visible to open it.
 */
export const TopNav: React.FC<{ letterUnread: boolean }> = ({ letterUnread }) => {
  const { space, currentUser, partnerUser, panel, openPanel, switchActiveUser } = useApp();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(true);
  const closeTimer = useRef<number | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const canHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches;

  const show = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
    setHint(false);
  };
  const hideSoon = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => {
      if (!navRef.current?.contains(document.activeElement)) setOpen(false);
    }, 380);
  };

  useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 6500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (panel) setOpen(false);
  }, [panel]);

  const go = (p: Parameters<typeof openPanel>[0]) => {
    openPanel(p);
    setOpen(false);
  };

  const partnerName = partnerUser?.name || space?.partnerPlaceholderName || 'your person';
  const presence = partnerUser
    ? partnerUser.status === 'online'
      ? `${partnerUser.name} is here`
      : `${partnerUser.name} is resting`
    : `Waiting for ${partnerName}`;

  return (
    <>
      {/* invisible hot zone along the top edge */}
      <div className="fixed top-0 inset-x-0 h-5 z-30" onMouseEnter={show} aria-hidden="true" />

      {/* touch handle */}
      {!canHover && !open && (
        <button
          className="fixed top-0 left-1/2 -translate-x-1/2 z-30 px-ui px-btn px-btn--paper px-btn--small"
          style={{ paddingTop: 6 }}
          onClick={show}
          aria-label="Open menu"
        >
          ☰ Menu
        </button>
      )}

      {/* first-visit hint */}
      {canHover && hint && !open && !panel && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 px-ui pointer-events-none px-fade">
          <div className="px-box px-shadow text-sm px-3 py-1.5 whitespace-nowrap">▲ Move to the top edge for the menu</div>
        </div>
      )}

      <nav
        ref={navRef}
        aria-label="Main"
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocusCapture={show}
        onBlurCapture={hideSoon}
        className="fixed top-0 inset-x-0 z-40 px-ui"
        style={{
          transform: open ? 'translateY(0)' : 'translateY(calc(-100% - 12px))',
          transition: 'transform 180ms steps(4)',
        }}
      >
        <div className="mx-auto max-w-[1180px] px-3 pt-3">
          <div className="px-box px-shadow flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
            {/* wordmark */}
            <button className="flex items-baseline gap-2 bg-transparent border-0 cursor-pointer p-0" onClick={() => go(null)}>
              <span className="text-2xl font-bold tracking-tight text-[var(--ink-soft)]">Soultied</span>
              <span className="hidden md:inline text-sm text-[var(--muted)]">· {space?.name}</span>
            </button>

            <div className="flex items-center gap-2 order-3 md:order-none w-full md:w-auto md:mx-auto">
              <button className="px-btn px-btn--paper px-btn--small" aria-current={!panel ? 'page' : undefined} onClick={() => go(null)}>
                Room
              </button>
              <button className="px-btn px-btn--paper px-btn--small" onClick={() => go('question')}>
                Today’s letter
                {letterUnread && <span aria-label="unread" className="inline-block w-2 h-2 bg-[var(--thread)]" />}
              </button>
              <button className="px-btn px-btn--paper px-btn--small" onClick={() => go('watch')}>
                Watch together
              </button>
              <button className="px-btn px-btn--paper px-btn--small" onClick={() => go('questions')}>
                Questions
              </button>
              <button className="px-btn px-btn--paper px-btn--small" onClick={() => go('us')}>
                Us
              </button>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <span className="hidden lg:flex items-center gap-2 text-sm text-[var(--muted)]">
                <span className={`inline-block w-2.5 h-2.5 ${partnerUser?.status === 'online' ? 'bg-[var(--sage)]' : 'bg-[#b9a98f]'}`} />
                {presence}
              </span>
              {partnerUser && (
                <button
                  className="px-btn px-btn--paper px-btn--small"
                  title="Prototype only: see the room as your partner"
                  onClick={() => switchActiveUser(partnerUser.id)}
                >
                  View as {partnerUser.name}
                </button>
              )}
              <button className="px-btn px-btn--sage px-btn--small" onClick={() => go('space')}>
                {partnerUser ? 'Our place' : 'Invite'}
              </button>
              <button
                className="px-btn px-btn--small"
                onClick={() => go('wardrobe')}
                aria-label="Change my look"
                title="Change my look"
              >
                <span className="-my-2">
                  <AvatarThumb config={currentUser.avatar} region="head" size={30} />
                </span>
                <span className="hidden sm:inline">My look</span>
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};
