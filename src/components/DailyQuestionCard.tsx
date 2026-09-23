import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Mail, CheckCircle2, Clock, Sparkles } from 'lucide-react';

export const DailyQuestionCard: React.FC = () => {
  const { dailySession, currentUser, partnerUser, submitAnswer } = useApp();
  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt-1');

  const { question, submittedUserIds, revealed, answers } = dailySession;

  const myId = currentUser.id;
  const partnerId = partnerUser?.id;

  const hasMySubmitted = submittedUserIds.includes(myId);
  const hasPartnerSubmitted = partnerId ? submittedUserIds.includes(partnerId) : false;

  const myAnswerOptionId = answers[myId] || selectedOptionId;
  const partnerAnswerOptionId = revealed && partnerId ? answers[partnerId] : null;

  const handleLockAnswer = () => {
    if (hasMySubmitted) return;
    submitAnswer(selectedOptionId);
  };

  return (
    <div className="bg-[#EFE2CC]/90 border-2 border-[#D8C4A7] rounded-2xl p-5 md:p-6 flex flex-col justify-between shadow-xs">
      {/* Top Header: Envelope icon + "TODAY'S QUESTION" */}
      <div>
        <div className="flex items-center gap-2 text-[#805847] mb-2.5">
          <div className="p-1.5 rounded-md bg-[#E4D5BE] text-[#A84F4B]">
            <Mail className="w-4 h-4" />
          </div>
          <span className="text-xs uppercase tracking-widest font-bold text-[#805847]">
            TODAY’S QUESTION · {question.category}
          </span>
        </div>

        {/* Main readable question prompt */}
        <h2 className="text-2xl md:text-[26px] font-bold text-[#483B36] leading-snug mb-5">
          {question.prompt}
        </h2>

        {/* 4 Accessible Radio Choices */}
        <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={question.prompt}>
          {question.options.map((option) => {
            const isSelected = hasMySubmitted
              ? myAnswerOptionId === option.id
              : selectedOptionId === option.id;
            const isPartnerChoice = revealed && partnerAnswerOptionId === option.id;
            const isMyChoice = revealed && myAnswerOptionId === option.id;

            return (
              <label
                key={option.id}
                onClick={() => !hasMySubmitted && setSelectedOptionId(option.id)}
                className={`relative flex items-center justify-between gap-3 p-3 md:p-3.5 rounded-xl border-2 transition-all select-none cursor-pointer ${
                  isSelected
                    ? 'bg-[#DDE5D6] border-[#8C9B75] text-[#344026] shadow-2xs'
                    : 'bg-[#F7EBD4]/70 hover:bg-[#F7EBD4] border-[#D8C4A7] text-[#483B36]'
                } ${hasMySubmitted ? 'cursor-default' : ''}`}
              >
                <div className="flex items-center gap-3">
                  {/* Custom Pixel Radio Dot */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected ? 'border-[#8C9B75] bg-[#8C9B75]' : 'border-[#805847] bg-[#F7EBD4]'
                    }`}
                  >
                    {isSelected && <span className="w-2 h-2 rounded-full bg-[#F7EBD4]" />}
                  </div>

                  <span className="text-lg leading-normal font-medium">{option.text}</span>
                </div>

                {/* Badges when revealed */}
                {revealed && (
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {isMyChoice && (
                      <span className="bg-[#8C9B75] text-[#F7EBD4] text-xs px-2 py-0.5 rounded-md font-semibold">
                        You
                      </span>
                    )}
                    {isPartnerChoice && (
                      <span className="bg-[#BD725D] text-[#F7EBD4] text-xs px-2 py-0.5 rounded-md font-semibold">
                        {partnerUser?.name}
                      </span>
                    )}
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Action / Reveal Area */}
      <div className="mt-6 flex flex-col gap-3">
        {revealed ? (
          <div className="p-3.5 rounded-xl bg-[#DDE5D6] border border-[#8C9B75] text-center">
            <div className="flex items-center justify-center gap-1.5 text-[#3D5226] font-bold text-base mb-1">
              <Sparkles className="w-4 h-4 text-[#BD725D]" />
              <span>Answers unlocked together!</span>
            </div>
            <p className="text-sm text-[#4E5C3E]">
              {myAnswerOptionId === partnerAnswerOptionId
                ? 'You both chose the exact same thing!'
                : `You chose one path and ${partnerUser?.name || 'your partner'} chose another.`}
            </p>
          </div>
        ) : (
          <>
            <button
              onClick={handleLockAnswer}
              disabled={hasMySubmitted}
              className={`w-full py-3 px-4 rounded-xl text-lg font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${
                hasMySubmitted
                  ? 'bg-[#C7B59F] text-[#F7EBD4] cursor-not-allowed'
                  : 'bg-[#BD725D] hover:bg-[#A85F4C] active:translate-y-0.5 text-[#F7EBD4]'
              }`}
            >
              {hasMySubmitted ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Answer locked in</span>
                </>
              ) : (
                <span>Lock my answer</span>
              )}
            </button>

            <p className="text-center text-sm text-[#805847]">
              Answers open when you’ve both shared.
            </p>
          </>
        )}

        {/* Live Submission Status Row */}
        <div className="flex items-center justify-between pt-3 border-t border-[#D8C4A7] text-sm text-[#483B36]">
          {/* Your status */}
          <div className="flex items-center gap-1.5">
            {hasMySubmitted ? (
              <CheckCircle2 className="w-4 h-4 text-[#8C9B75]" />
            ) : (
              <Clock className="w-4 h-4 text-[#BD725D]" />
            )}
            <span>
              You:{' '}
              <strong className={hasMySubmitted ? 'text-[#5C6E44]' : 'text-[#805847]'}>
                {hasMySubmitted ? 'locked' : 'choosing'}
              </strong>
            </span>
          </div>

          {/* Partner status */}
          <div className="flex items-center gap-1.5">
            {hasPartnerSubmitted ? (
              <CheckCircle2 className="w-4 h-4 text-[#8C9B75]" />
            ) : (
              <Clock className="w-4 h-4 text-[#BD725D]" />
            )}
            <span>
              {partnerUser?.name || 'Partner'}:{' '}
              <strong className={hasPartnerSubmitted ? 'text-[#5C6E44]' : 'text-[#805847]'}>
                {hasPartnerSubmitted ? 'answered' : 'thinking'}
              </strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
