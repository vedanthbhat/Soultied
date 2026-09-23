import React from 'react';
import { useApp } from '../context/AppContext';
import { PixelAvatarRenderer } from './PixelAvatarRenderer';
import { Home, MessageSquare, Heart, RefreshCw, UserPlus } from 'lucide-react';

export const Header: React.FC = () => {
  const {
    currentUser,
    partnerUser,
    activeTab,
    setActiveTab,
    setIsWardrobeOpen,
    setIsOnboardingOpen,
    switchActiveUser,
  } = useApp();

  return (
    <header className="w-full border-b border-[#E3D4BC] bg-[#F7EBD4]/90 backdrop-blur-xs sticky top-0 z-30 px-4 md:px-8 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left wordmark */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setActiveTab('home')}>
            <span className="text-2xl md:text-[32px] font-bold tracking-tight text-[#483B36] leading-none">
              thread <span className="text-[#A84F4B]">&amp;</span> bean
            </span>
          </div>
          <span className="text-xs uppercase tracking-widest text-[#805847] font-semibold mt-0.5">
            OUR LITTLE PLACE
          </span>
        </div>

        {/* Center / Right navigation */}
        <nav className="flex items-center gap-2 md:gap-3" aria-label="Main Navigation">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-base md:text-lg font-medium transition-all ${
              activeTab === 'home'
                ? 'bg-[#8C9B75] text-[#F7EBD4] shadow-xs'
                : 'text-[#483B36] hover:bg-[#EEDEC2]'
            }`}
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>

          <button
            onClick={() => setActiveTab('questions')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-base md:text-lg font-medium transition-all ${
              activeTab === 'questions'
                ? 'bg-[#8C9B75] text-[#F7EBD4] shadow-xs'
                : 'text-[#483B36] hover:bg-[#EEDEC2]'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Questions</span>
          </button>

          <button
            onClick={() => setActiveTab('us')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-base md:text-lg font-medium transition-all ${
              activeTab === 'us'
                ? 'bg-[#8C9B75] text-[#F7EBD4] shadow-xs'
                : 'text-[#483B36] hover:bg-[#EEDEC2]'
            }`}
          >
            <Heart className="w-4 h-4" />
            <span>Us</span>
          </button>
        </nav>

        {/* Far Right user pill & switcher */}
        <div className="flex items-center gap-2">
          {/* Switch persona button for testing 2-person sync */}
          {partnerUser && (
            <button
              onClick={() => switchActiveUser(partnerUser.id)}
              title={`Switch to ${partnerUser.name}'s perspective`}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs md:text-sm bg-[#EBD9BE] hover:bg-[#DFCAAC] text-[#483B36] rounded-md transition-colors border border-[#D5C1A2]"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#805847]" />
              <span>Viewing: <strong>{currentUser.name}</strong></span>
            </button>
          )}

          {/* New space / invite button */}
          <button
            onClick={() => setIsOnboardingOpen(true)}
            title="Space settings or invite link"
            className="p-1.5 rounded-full bg-[#EBD9BE] hover:bg-[#DFCAAC] text-[#483B36] transition-colors border border-[#D5C1A2]"
          >
            <UserPlus className="w-4 h-4" />
          </button>

          {/* Avatar button */}
          <button
            onClick={() => setIsWardrobeOpen(true)}
            title="Open Wardrobe & Edit Look"
            className="relative p-1 rounded-full bg-[#EAE0CE] border-2 border-[#805847] hover:border-[#BD725D] transition-transform hover:scale-105"
          >
            <div className="w-9 h-9 overflow-hidden rounded-full flex items-center justify-center bg-[#F7EBD4]">
              <PixelAvatarRenderer config={currentUser.avatar} size={50} animate={false} />
            </div>
            {/* Online status indicator */}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#8C9B75] border-2 border-[#F7EBD4] rounded-full" />
          </button>
        </div>
      </div>
    </header>
  );
};
