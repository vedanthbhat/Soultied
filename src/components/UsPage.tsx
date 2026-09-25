import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { PixelAvatarRenderer } from './PixelAvatarRenderer';
import { Heart, Sparkles, Calendar, Clock, Globe, Award, Edit3, Check } from 'lucide-react';

export const UsPage: React.FC = () => {
  const {
    space,
    currentUser,
    partnerUser,
    progression,
    activities,
    setIsWardrobeOpen,
    updateSpaceDetails,
  } = useApp();

  const [isEditingName, setIsEditingName] = useState(false);
  const [spaceNameInput, setSpaceNameInput] = useState(space?.name || 'Our Little Place');

  // Calculate days together
  const calculateDaysTogether = () => {
    if (!space?.togetherSince) return null;
    const start = new Date(space.togetherSince);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysTogether = calculateDaysTogether();

  const handleSaveSpaceName = () => {
    updateSpaceDetails(spaceNameInput);
    setIsEditingName(false);
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 flex flex-col gap-6">
      {/* Top Banner: Our Story & Days Together */}
      <div className="bg-[#EFE2CC]/90 border-2 border-[#D8C4A7] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs">
        <div className="flex flex-col gap-2 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 text-[#A84F4B]">
            <Heart className="w-5 h-5 fill-current" />
            <span className="text-sm uppercase tracking-widest font-bold">
              ABOUT OUR LITTLE SPACE
            </span>
          </div>

          <div className="flex items-center justify-center md:justify-start gap-3">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={spaceNameInput}
                  onChange={(e) => setSpaceNameInput(e.target.value)}
                  className="text-2xl md:text-3xl font-bold bg-[#F7EBD4] border-2 border-[#805847] rounded-xl px-3 py-1 text-[#483B36]"
                />
                <button
                  onClick={handleSaveSpaceName}
                  className="p-2 bg-[#8C9B75] text-[#F7EBD4] rounded-xl hover:bg-[#788961]"
                >
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-3xl md:text-4xl font-bold text-[#483B36]">
                  {space?.name}
                </h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-md text-[#805847] hover:bg-[#DFCAAC] transition-colors"
                  title="Edit space name"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {daysTogether !== null ? (
            <p className="text-lg text-[#805847]">
              Together for <strong>{daysTogether} days</strong> (since{' '}
              {new Date(space?.togetherSince || '').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              )
            </p>
          ) : (
            <p className="text-lg text-[#805847]">
              {currentUser.name} &amp; {partnerUser ? partnerUser.name : 'Waiting for partner'}
            </p>
          )}
        </div>

        {/* Side-by-side Avatars portrait */}
        <div className="flex items-end gap-3 p-3 bg-[#F7EBD4] border-2 border-[#D8C4A7] rounded-2xl shadow-inner">
          <div className="flex flex-col items-center">
            <PixelAvatarRenderer config={currentUser.avatar} size={130} />
            <span className="text-sm font-bold text-[#483B36] mt-1">{currentUser.name}</span>
          </div>

          {partnerUser ? (
            <div className="flex flex-col items-center">
              <PixelAvatarRenderer config={partnerUser.avatar} size={130} flipped={true} />
              <span className="text-sm font-bold text-[#483B36] mt-1">{partnerUser.name}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-[90px] h-[130px] border-2 border-dashed border-[#A84F4B] rounded-xl text-center p-2">
              <span className="text-xs font-bold text-[#A84F4B]">Partner slot open</span>
            </div>
          )}
        </div>
      </div>

      {/* Progression Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#EFE2CC]/80 border-2 border-[#D8C4A7] rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#E4D5BE] text-[#A84F4B]">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-[#805847] block">
              Current Streak
            </span>
            <span className="text-2xl font-bold text-[#483B36]">
              {progression.currentStreak} Days
            </span>
          </div>
        </div>

        <div className="bg-[#EFE2CC]/80 border-2 border-[#D8C4A7] rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#E4D5BE] text-[#E4BB6B]">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-[#805847] block">
              Best Streak
            </span>
            <span className="text-2xl font-bold text-[#483B36]">
              {progression.bestStreak} Days
            </span>
          </div>
        </div>

        <div className="bg-[#EFE2CC]/80 border-2 border-[#D8C4A7] rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#E4D5BE] text-[#8C9B75]">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs uppercase font-bold text-[#805847] block">
              Connected Days
            </span>
            <span className="text-2xl font-bold text-[#483B36]">
              {progression.lifetimeConnectedDays} Total
            </span>
          </div>
        </div>
      </div>

      {/* Quick Settings & Wardrobe Access */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Space details card */}
        <div className="bg-[#EFE2CC]/80 border-2 border-[#D8C4A7] rounded-xl p-5 flex flex-col gap-3">
          <h2 className="text-xl font-bold text-[#483B36]">Connection Details</h2>
          <div className="flex flex-col gap-2 text-sm text-[#483B36]">
            <div className="flex items-center justify-between py-1 border-b border-[#D8C4A7]">
              <span className="flex items-center gap-2 text-[#805847]">
                <Globe className="w-4 h-4" /> Shared Timezone
              </span>
              <strong>{space?.timezone}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-[#D8C4A7]">
              <span className="flex items-center gap-2 text-[#805847]">
                <Clock className="w-4 h-4" /> Space Created
              </span>
              <strong>
                {new Date(space?.createdAt || '').toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </strong>
            </div>

            <div className="flex items-center justify-between py-1">
              <span className="text-[#805847]">Partner Status</span>
              <strong>{partnerUser ? 'Paired & Active' : 'Waiting for redemption'}</strong>
            </div>
          </div>
        </div>

        {/* Wardrobe launch card */}
        <div className="bg-[#EFE2CC]/80 border-2 border-[#D8C4A7] rounded-xl p-5 flex flex-col justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#483B36]">Your Appearance</h2>
            <p className="text-sm text-[#805847] mt-1">
              Change your clothes, hair, skin tone and little extras anytime.
            </p>
          </div>

          <button
            onClick={() => setIsWardrobeOpen(true)}
            className="w-full py-2.5 px-4 bg-[#BD725D] hover:bg-[#A85F4C] text-[#F7EBD4] font-bold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4" />
            <span>Open Wardrobe &amp; Styling</span>
          </button>
        </div>
      </div>

      {/* Activity History */}
      <div className="bg-[#EFE2CC]/80 border-2 border-[#D8C4A7] rounded-xl p-6 flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-[#483B36]">Activity Log</h2>
        <div className="flex flex-col gap-3">
          {activities.map((act) => (
            <div
              key={act.id}
              className="flex items-start gap-3 p-3 bg-[#F7EBD4] border border-[#D8C4A7] rounded-xl"
            >
              <div className="p-2 rounded-lg bg-[#EFE2CC] text-[#A84F4B] mt-0.5">
                <Heart className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#483B36]">{act.title}</span>
                  <span className="text-xs text-[#805847] font-semibold">{act.timestamp}</span>
                </div>
                <p className="text-sm text-[#805847] mt-0.5">{act.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
