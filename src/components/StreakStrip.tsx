import React from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, ChevronRight } from 'lucide-react';

export const StreakStrip: React.FC = () => {
  const { progression, setActiveTab, activities } = useApp();
  const { currentStreak, weekDots } = progression;

  const latestActivity = activities[0] || {
    timestamp: 'Yesterday',
    description: 'You answered a question together',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mt-1">
      {/* Left 7-Dot Streak Progress Bar */}
      <div className="md:col-span-8 bg-[#EFE2CC]/80 border-2 border-[#D8C4A7] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-[#483B36] whitespace-nowrap">
            {currentStreak} days of little moments
          </span>

          {/* Connected dots with thread red line */}
          <div className="relative flex items-center gap-2">
            {/* Horizontal connector thread */}
            <div className="absolute left-1 right-1 top-1/2 -translate-y-1/2 h-0.5 bg-[#A84F4B]/40 z-0" />

            {weekDots.map((isFilled, idx) => (
              <div
                key={idx}
                className={`relative z-10 w-3.5 h-3.5 rounded-full transition-transform hover:scale-125 ${
                  isFilled
                    ? 'bg-[#A84F4B] border-2 border-[#A84F4B] shadow-2xs'
                    : 'bg-[#F7EBD4] border-2 border-[#A84F4B]'
                }`}
                title={`Day ${idx + 1}: ${isFilled ? 'Completed' : 'Upcoming'}`}
              />
            ))}
          </div>
        </div>

        {/* Supporting quiet motto */}
        <span className="text-sm text-[#805847] border-l border-[#D8C4A7] pl-3 hidden sm:inline">
          Every shared answer brings you closer.
        </span>
      </div>

      {/* Right Mini Activity shortcut */}
      <div
        onClick={() => setActiveTab('us')}
        className="md:col-span-4 bg-[#EFE2CC]/80 border-2 border-[#D8C4A7] hover:border-[#BD725D] rounded-xl px-4 py-3 flex items-center justify-between gap-2 cursor-pointer transition-colors shadow-2xs group"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="p-1 rounded-md bg-[#E4D5BE] text-[#805847] shrink-0">
            <Calendar className="w-4 h-4" />
          </div>
          <span className="text-sm md:text-base text-[#483B36] truncate">
            <strong>{latestActivity.timestamp}</strong> · {latestActivity.description}
          </span>
        </div>

        <ChevronRight className="w-4 h-4 text-[#805847] group-hover:text-[#BD725D] group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>
    </div>
  );
};
