/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { SharedRoom } from './components/SharedRoom';
import { DailyQuestionCard } from './components/DailyQuestionCard';
import { StreakStrip } from './components/StreakStrip';
import { UsPage } from './components/UsPage';
import { QuestionsPage } from './components/QuestionsPage';
import { WardrobeModal } from './components/WardrobeModal';
import { OnboardingModal } from './components/OnboardingModal';

const MainContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-[#F7EBD4] text-[#483B36] font-['Pixelify_Sans',sans-serif]">
      {/* Navigation Header */}
      <Header />

      {/* Main Page Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 md:px-8 py-4 md:py-6">
        {activeTab === 'home' && (
          <div className="flex flex-col gap-4">
            {/* Desktop 2-column layout matching 06-interface-reference.png */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Shared Room (70% width on desktop) */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <SharedRoom />
                <StreakStrip />
              </div>

              {/* Right Column: Daily Question Card (30% width on desktop) */}
              <div className="lg:col-span-4 flex flex-col">
                <DailyQuestionCard />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && <QuestionsPage />}

        {activeTab === 'us' && <UsPage />}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#E3D4BC] py-4 text-center text-sm text-[#805847] bg-[#F7EBD4]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Thread &amp; Bean · A private cozy pixel place for two</span>
          <span className="text-xs text-[#805847]/80">
            Pixelify Sans typography · All items unlocked
          </span>
        </div>
      </footer>

      {/* Interactive Modals */}
      <WardrobeModal />
      <OnboardingModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
