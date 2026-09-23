import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DailyQuestionCard } from './DailyQuestionCard';
import { QUESTIONS_CATALOGUE } from '../data/questionsCatalogue';
import { MessageSquare, Sparkles, Filter, CheckCircle2 } from 'lucide-react';

export const QuestionsPage: React.FC = () => {
  const { dailySession, currentUser, partnerUser } = useApp();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Little Joys', 'Us', 'Dream Days', 'Silly Things', 'Feeling Close'];

  const filteredQuestions =
    selectedCategory === 'All'
      ? QUESTIONS_CATALOGUE
      : QUESTIONS_CATALOGUE.filter((q) => q.category === selectedCategory);

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 flex flex-col gap-8">
      {/* Active Today's Question section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-[#E4D5BE] text-[#A84F4B]">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#483B36]">
            Today’s Question
          </h1>
        </div>
        <DailyQuestionCard />
      </div>

      {/* Past & Upcoming Question Topics */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#805847]" />
            <h2 className="text-2xl font-bold text-[#483B36]">Question Catalogue &amp; Archive</h2>
          </div>

          {/* Category filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
            <Filter className="w-4 h-4 text-[#805847] shrink-0 mr-1" />
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-[#BD725D] text-[#F7EBD4]'
                    : 'bg-[#EFE2CC] text-[#805847] hover:bg-[#E4D5BE]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* List of Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredQuestions.map((q) => {
            const isToday = q.id === dailySession.question.id;
            return (
              <div
                key={q.id}
                className={`p-4 rounded-xl border-2 flex flex-col justify-between gap-3 transition-colors ${
                  isToday
                    ? 'bg-[#EFE2CC] border-[#BD725D] shadow-xs'
                    : 'bg-[#EFE2CC]/60 border-[#D8C4A7] hover:border-[#805847]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs uppercase font-bold text-[#BD725D] tracking-wider">
                      {q.category}
                    </span>
                    {isToday && (
                      <span className="bg-[#BD725D] text-[#F7EBD4] text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                        Active Today
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-[#483B36] leading-snug">
                    {q.prompt}
                  </h3>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-xs text-[#805847]">
                  {q.options.map((opt) => (
                    <div
                      key={opt.id}
                      className="p-1.5 rounded-md bg-[#F7EBD4]/70 border border-[#D8C4A7] truncate"
                    >
                      • {opt.text}
                    </div>
                  ))}
                </div>

                {isToday && dailySession.revealed && (
                  <div className="pt-2 border-t border-[#D8C4A7] flex items-center gap-1.5 text-xs text-[#3D5226] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#8C9B75]" />
                    <span>
                      Answered by {currentUser.name} and {partnerUser?.name || 'partner'}!
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
