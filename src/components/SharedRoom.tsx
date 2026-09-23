import React from 'react';
import { useApp } from '../context/AppContext';
import { PixelAvatarRenderer } from './PixelAvatarRenderer';
import { Armchair, Sparkles, UserPlus } from 'lucide-react';

export const SharedRoom: React.FC = () => {
  const { currentUser, partnerUser, space, setIsWardrobeOpen, setIsOnboardingOpen } = useApp();

  const isPaired = !!partnerUser;
  const user1 = currentUser;
  const user2 = partnerUser;

  return (
    <div className="flex flex-col gap-3">
      {/* Top Greeting & Pair Presence */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 px-1">
        <div>
          <h1 className="text-3xl md:text-[38px] font-bold text-[#483B36] leading-tight">
            Make yourself at home.
          </h1>
          <p className="text-lg text-[#805847] mt-0.5">
            A little closer, even from far away.
          </p>
        </div>

        {/* Presence status badge */}
        <div className="flex items-center gap-2 bg-[#EBD9BE]/80 border border-[#D8C4A7] px-3.5 py-1.5 rounded-full text-base font-medium text-[#483B36] self-start sm:self-auto shadow-xs">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8C9B75] animate-pulse" />
          <span>
            {isPaired
              ? `${user1.name} & ${user2?.name} · Both here`
              : `${user1.name} · Waiting for your person`}
          </span>
        </div>
      </div>

      {/* Main Room Viewport */}
      <div className="relative w-full aspect-[3/2] rounded-2xl overflow-hidden border-2 border-[#D8C4A7] shadow-sm bg-[#EBD9BE]">
        {/* Background pixel-art room */}
        <img
          src="/assets/01-shared-room.png"
          alt="Shared pixel living room"
          className="w-full h-full object-cover pixelated select-none"
        />

        {/* SVG Red Thread connecting avatars */}
        {isPaired && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            viewBox="0 0 1000 667"
            preserveAspectRatio="none"
          >
            {/* Soft shadow of thread */}
            <path
              d="M 405 520 C 430 540, 460 560, 480 545 C 490 535, 500 520, 510 535 C 525 555, 550 540, 585 520"
              fill="none"
              stroke="#805847"
              strokeWidth="2.5"
              strokeOpacity="0.3"
            />
            {/* The Red Thread with gentle looping heart in center */}
            <path
              d="M 405 518 C 430 538, 460 558, 480 543 C 490 533, 500 518, 510 533 C 525 553, 550 538, 585 518"
              fill="none"
              stroke="#A84F4B"
              strokeWidth="3"
              strokeLinecap="round"
              className="drop-shadow-xs"
            />
            {/* Heart accent loop in center of thread */}
            <circle cx="495" cy="528" r="4" fill="#A84F4B" />
          </svg>
        )}

        {/* Left Avatar (Current User / Aanya) */}
        <div
          className="absolute z-20 cursor-pointer group transition-transform hover:scale-105"
          style={{
            left: '37%',
            top: '59%',
            transform: 'translate(-50%, -50%)',
          }}
          onClick={() => setIsWardrobeOpen(true)}
          title={`Click to customize ${user1.name}'s look`}
        >
          {/* Avatar Label */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-[#483B36] text-[#F7EBD4] text-xs px-2 py-0.5 rounded-md pointer-events-none shadow-sm">
            {user1.name} (You)
          </div>
          <div className="w-[110px] md:w-[140px] lg:w-[160px]">
            <PixelAvatarRenderer config={user1.avatar} size={150} />
          </div>
        </div>

        {/* Right Avatar (Partner User / Rohan or Empty Invitation Placeholder) */}
        <div
          className="absolute z-20"
          style={{
            left: '61%',
            top: '59%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {isPaired && user2 ? (
            <div
              className="cursor-pointer group transition-transform hover:scale-105"
              onClick={() => setIsWardrobeOpen(true)}
              title={`${user2.name} · Click to customize`}
            >
              {/* Partner Label */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-[#483B36] text-[#F7EBD4] text-xs px-2 py-0.5 rounded-md pointer-events-none shadow-sm">
                {user2.name}
              </div>
              <div className="w-[110px] md:w-[140px] lg:w-[160px]">
                <PixelAvatarRenderer config={user2.avatar} size={150} flipped={true} />
              </div>
            </div>
          ) : (
            /* Unpaired Invite Placeholder */
            <div
              onClick={() => setIsOnboardingOpen(true)}
              className="flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-[#A84F4B] bg-[#F7EBD4]/90 backdrop-blur-xs text-center cursor-pointer hover:bg-[#F7EBD4] transition-all shadow-sm max-w-[150px]"
            >
              <div className="w-10 h-10 rounded-full bg-[#EBD9BE] flex items-center justify-center text-[#A84F4B] mb-1.5">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-[#483B36] leading-tight">
                Invite {space?.partnerPlaceholderName || 'Partner'}
              </span>
              <span className="text-xs text-[#805847] mt-0.5">
                Tap to share code
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Room bottom action footer */}
      <div className="flex items-center justify-between gap-3 px-1">
        {/* Left pill */}
        <div className="flex items-center gap-2 text-base text-[#483B36] bg-[#EBD9BE]/60 border border-[#D8C4A7] px-3.5 py-1.5 rounded-lg">
          <Armchair className="w-4 h-4 text-[#805847]" />
          <span>Your little space</span>
        </div>

        {/* Right Change look button */}
        <button
          onClick={() => setIsWardrobeOpen(true)}
          className="flex items-center gap-2 text-base font-medium text-[#483B36] bg-[#EBD9BE] hover:bg-[#DFCAAC] border border-[#CDB596] px-4 py-1.5 rounded-lg transition-colors shadow-2xs"
        >
          <Sparkles className="w-4 h-4 text-[#BD725D]" />
          <span>Change my look</span>
        </button>
      </div>
    </div>
  );
};
