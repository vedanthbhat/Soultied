import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { X, Copy, Check, UserPlus, Home, RefreshCw, KeyRound } from 'lucide-react';

export const OnboardingModal: React.FC = () => {
  const {
    isOnboardingOpen,
    setIsOnboardingOpen,
    space,
    currentUser,
    partnerUser,
    createSpace,
    joinWithCode,
    regenerateInvite,
  } = useApp();

  const [mode, setMode] = useState<'status' | 'create' | 'join'>('status');

  // Create form state
  const [spaceName, setSpaceName] = useState('Our Little Place');
  const [creatorName, setCreatorName] = useState(currentUser.name || 'Aanya');
  const [partnerName, setPartnerName] = useState(space?.partnerPlaceholderName || 'Rohan');
  const [togetherDate, setTogetherDate] = useState(space?.togetherSince || '2025-06-14');

  // Join form state
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinUserName, setJoinUserName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Copy feedback
  const [copied, setCopied] = useState(false);

  if (!isOnboardingOpen) return null;

  const handleCopyInvite = () => {
    if (!space) return;
    const inviteText = `Join my private couples space on Thread & Bean: "${space.name}". Code: ${space.inviteCode} (valid for 7 days)`;
    navigator.clipboard.writeText(inviteText).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSpace(spaceName, creatorName, partnerName, togetherDate);
    setMode('status');
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const success = joinWithCode(joinCodeInput, joinUserName);
    if (success) {
      setIsOnboardingOpen(false);
    } else {
      setJoinError('Invalid invitation code. Check the code format or ask for a fresh invite.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#483B36]/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#F7EBD4] border-2 border-[#805847] rounded-2xl shadow-xl overflow-hidden my-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8C4A7] bg-[#EFE2CC]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-[#E4D5BE] text-[#A84F4B]">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#483B36]">
                {mode === 'status'
                  ? 'Space & Pairing Settings'
                  : mode === 'create'
                  ? 'Create a New Space'
                  : 'Join an Existing Space'}
              </h2>
            </div>
          </div>
          <button
            onClick={() => setIsOnboardingOpen(false)}
            className="p-1.5 rounded-lg hover:bg-[#DFCAAC] text-[#483B36] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {mode === 'status' && (
            <div className="flex flex-col gap-4">
              {/* Space summary card */}
              <div className="p-4 rounded-xl bg-[#EFE2CC] border border-[#D8C4A7] flex flex-col gap-2">
                <span className="text-xs uppercase font-bold text-[#805847]">Current Space</span>
                <div className="text-2xl font-bold text-[#483B36]">{space?.name}</div>
                <div className="text-sm text-[#805847]">
                  Members: <strong>{currentUser.name}</strong> &amp;{' '}
                  <strong>{partnerUser ? partnerUser.name : `${space?.partnerPlaceholderName} (Pending invite)`}</strong>
                </div>
              </div>

              {/* Invitation Code Section */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#483B36]">
                    Private Invitation Code
                  </span>
                  <button
                    onClick={regenerateInvite}
                    className="flex items-center gap-1 text-xs text-[#BD725D] hover:underline"
                    title="Generate new 128-bit secret code"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Rotate code</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#F7EBD4] border-2 border-[#D8C4A7] rounded-xl px-3 py-2 font-mono text-base font-bold text-[#483B36] tracking-wider text-center select-all">
                    {space?.inviteCode}
                  </div>
                  <button
                    onClick={handleCopyInvite}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-[#8C9B75] hover:bg-[#788961] text-[#F7EBD4] rounded-xl font-bold text-sm transition-colors shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <span className="text-xs text-[#805847]">
                  Valid for 7 days. Give this code to your partner so they can join your room.
                </span>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#D8C4A7]">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#EBD9BE] hover:bg-[#DFCAAC] border border-[#CDB596] rounded-xl text-sm font-bold text-[#483B36] transition-colors"
                >
                  <Home className="w-4 h-4 text-[#805847]" />
                  <span>Start New Space</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('join')}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#EBD9BE] hover:bg-[#DFCAAC] border border-[#CDB596] rounded-xl text-sm font-bold text-[#483B36] transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-[#BD725D]" />
                  <span>Enter Invite Code</span>
                </button>
              </div>
            </div>
          )}

          {mode === 'create' && (
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-bold text-[#483B36] block mb-1">
                  Space Name
                </label>
                <input
                  type="text"
                  value={spaceName}
                  onChange={(e) => setSpaceName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-[#D8C4A7] bg-[#F7EBD4] text-[#483B36] focus:border-[#BD725D] outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-[#D8C4A7] bg-[#F7EBD4] text-[#483B36] focus:border-[#BD725D] outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-bold text-[#483B36] block mb-1">
                    Partner Placeholder
                  </label>
                  <input
                    type="text"
                    value={partnerName}
                    onChange={(e) => setPartnerName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border-2 border-[#D8C4A7] bg-[#F7EBD4] text-[#483B36] focus:border-[#BD725D] outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-[#483B36] block mb-1">
                  Together Since (optional)
                </label>
                <input
                  type="date"
                  value={togetherDate}
                  onChange={(e) => setTogetherDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-[#D8C4A7] bg-[#F7EBD4] text-[#483B36] focus:border-[#BD725D] outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#D8C4A7]">
                <button
                  type="button"
                  onClick={() => setMode('status')}
                  className="px-4 py-2 text-[#805847] hover:underline text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#BD725D] hover:bg-[#A85F4C] text-[#F7EBD4] font-bold text-sm shadow-xs transition-colors"
                >
                  Create &amp; Generate Invite
                </button>
              </div>
            </form>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-sm font-bold text-[#483B36] block mb-1">
                  Invitation Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. TB-8F2K-9X4M-7Q1W"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-[#D8C4A7] bg-[#F7EBD4] font-mono text-[#483B36] uppercase focus:border-[#BD725D] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-[#483B36] block mb-1">
                  Your Display Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rohan"
                  value={joinUserName}
                  onChange={(e) => setJoinUserName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border-2 border-[#D8C4A7] bg-[#F7EBD4] text-[#483B36] focus:border-[#BD725D] outline-none"
                  required
                />
              </div>

              {joinError && (
                <div className="text-xs text-[#721C24] bg-[#F8D7DA] p-2.5 rounded-lg border border-[#F5C6CB]">
                  {joinError}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-[#D8C4A7]">
                <button
                  type="button"
                  onClick={() => setMode('status')}
                  className="px-4 py-2 text-[#805847] hover:underline text-sm font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#8C9B75] hover:bg-[#788961] text-[#F7EBD4] font-bold text-sm shadow-xs transition-colors"
                >
                  Join Space
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
