import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AvatarConfig } from '../types';
import { DEFAULT_AVATAR_A, DEFAULT_AVATAR_B } from '../pixel/character';
import { CharacterStudio } from './CharacterStudio';
import type { Seat } from '../pixel/room';

type Step = 'welcome' | 'details' | 'look' | 'invite' | 'join' | 'join-look';

interface Props {
  initialJoinCode?: string | null;
  onDraftSeats: (seats: { left: Seat; right: Seat }) => void;
  onDone: () => void;
}

const empty = (name = ''): Seat => ({ avatar: null, name, status: 'empty' });

export const Welcome: React.FC<Props> = ({ initialJoinCode, onDraftSeats, onDone }) => {
  const { createSpace, findInvite, joinWithCode, loadDemo, inviteLink, space } = useApp();
  const [step, setStep] = useState<Step>(initialJoinCode ? 'join' : 'welcome');

  // create flow
  const [myName, setMyName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [together, setTogether] = useState('');
  const [placeName, setPlaceName] = useState('Our Little Place');
  const [look, setLook] = useState<AvatarConfig>(DEFAULT_AVATAR_A);

  // join flow
  const [code, setCode] = useState(initialJoinCode || '');
  const [joinName, setJoinName] = useState('');
  const [joinLook, setJoinLook] = useState<AvatarConfig>(DEFAULT_AVATAR_B);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  const invite = code ? findInvite(code) : null;

  // Keep the room behind the sheet in sync with what's being built
  useEffect(() => {
    if (step === 'look') onDraftSeats({ left: { avatar: look, name: myName, status: 'online' }, right: empty(partnerName) });
    else if (step === 'invite' && space) onDraftSeats({ left: { avatar: look, name: myName, status: 'online' }, right: empty(partnerName) });
    else if ((step === 'join' || step === 'join-look') && invite)
      onDraftSeats({
        left: { avatar: invite.host.avatar, name: invite.host.name, status: 'online' },
        right: step === 'join-look' ? { avatar: joinLook, name: joinName, status: 'online' } : empty(),
      });
    else onDraftSeats({ left: empty(), right: empty() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, look, joinLook, myName, partnerName, joinName, invite?.space.id]);

  const copy = async (what: 'link' | 'code') => {
    const text = what === 'link' ? inviteLink : space?.inviteCode || '';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard blocked: the text is selectable in the box
    }
    setCopied(what);
    window.setTimeout(() => setCopied(null), 2200);
  };

  const Dots = ({ n }: { n: number }) => (
    <div className="flex gap-2 mb-4" aria-label={`Step ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="inline-block w-3 h-3" style={{ background: i <= n ? 'var(--terracotta)' : 'var(--paper-shade)' }} />
      ))}
    </div>
  );

  const wide = step === 'look' || step === 'join-look';

  return (
    <div className="fixed inset-0 z-40 pointer-events-none px-ui flex items-end md:items-center p-3 md:p-6">
      <div
        className="pointer-events-auto px-box px-shadow px-pop w-full flex flex-col max-h-[72vh] md:max-h-[calc(100vh-48px)]"
        style={{ maxWidth: wide ? 560 : 470 }}
        key={step}
      >
        <div className="px-scroll overflow-y-auto p-6 md:p-8 flex-1">
          {step === 'welcome' && (
            <div className="flex flex-col gap-5 h-full">
              <div>
                <div className="text-sm font-semibold tracking-[0.16em] uppercase text-[var(--terracotta-d)]">Welcome to</div>
                <h1 className="text-5xl md:text-6xl font-bold leading-none text-[var(--ink-soft)] mt-1">Soultied</h1>
              </div>
              <p className="text-xl leading-snug">A little home for two, wherever you both are.</p>
              <p className="text-[var(--muted)]">
                Build a cosy room together: a fire, a couch, and a seat that's always saved for your person. Come
                back each day to open a letter together.
              </p>
              <div className="flex flex-col gap-4 mt-2">
                <button className="px-btn text-lg" onClick={() => setStep('details')}>
                  Build our place →
                </button>
                <button className="px-btn px-btn--paper" onClick={() => setStep('join')}>
                  I have an invite
                </button>
              </div>
              <div className="pt-2 text-sm text-[var(--muted)]">
                Just looking?{' '}
                <button
                  className="px-link"
                  onClick={() => {
                    loadDemo();
                    onDone();
                  }}
                >
                  Peek inside a demo room
                </button>
              </div>
            </div>
          )}

          {step === 'details' && (
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                setStep('look');
              }}
            >
              <Dots n={1} />
              <div>
                <h2 className="text-3xl font-bold leading-tight">First, the two of you.</h2>
                <p className="text-[var(--muted)] mt-1">Just names for now. You can change everything later.</p>
              </div>
              <label>
                <span className="px-label">Your name</span>
                <input className="px-input" value={myName} onChange={(e) => setMyName(e.target.value)} placeholder="e.g. Vedanth" required autoFocus maxLength={24} />
              </label>
              <label>
                <span className="px-label">Your person's name</span>
                <input className="px-input" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Who's the other seat for?" required maxLength={24} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <label>
                  <span className="px-label">Together since (optional)</span>
                  <input className="px-input" type="date" value={together} onChange={(e) => setTogether(e.target.value)} max={new Date().toISOString().split('T')[0]} />
                </label>
                <label>
                  <span className="px-label">Name your place</span>
                  <input className="px-input" value={placeName} onChange={(e) => setPlaceName(e.target.value)} maxLength={32} />
                </label>
              </div>
              <div className="flex items-center justify-between gap-3 mt-2">
                <button type="button" className="px-btn px-btn--paper" onClick={() => setStep('welcome')}>
                  Back
                </button>
                <button type="submit" className="px-btn">
                  Make my character →
                </button>
              </div>
            </form>
          )}

          {step === 'look' && (
            <div className="flex flex-col gap-4">
              <Dots n={2} />
              <div>
                <h2 className="text-3xl font-bold leading-tight">Now make you.</h2>
                <p className="text-[var(--muted)] mt-1">Watch the couch: that's you, already sitting by the fire.</p>
              </div>
              <CharacterStudio value={look} onChange={setLook} compact />
              <div className="flex items-center justify-between gap-3 mt-2">
                <button className="px-btn px-btn--paper" onClick={() => setStep('details')}>
                  Back
                </button>
                <button
                  className="px-btn"
                  onClick={() => {
                    createSpace({ spaceName: placeName, myName, partnerName, togetherSince: together || undefined, avatar: look });
                    setStep('invite');
                  }}
                >
                  Save my seat →
                </button>
              </div>
            </div>
          )}

          {step === 'invite' && space && (
            <div className="flex flex-col gap-5">
              <Dots n={3} />
              <div>
                <h2 className="text-3xl font-bold leading-tight">Save {partnerName || 'them'} a seat.</h2>
                <p className="text-[var(--muted)] mt-1">
                  Send {partnerName || 'your person'} this link. They'll make their character and sit down right next
                  to you.
                </p>
              </div>
              <div>
                <span className="px-label">Invite link</span>
                <div className="flex gap-3 items-stretch">
                  <input className="px-input text-sm" readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} aria-label="Invite link" />
                  <button className="px-btn px-btn--sage shrink-0" onClick={() => copy('link')}>
                    {copied === 'link' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <div>
                <span className="px-label">Or share the code</span>
                <div className="flex gap-3 items-stretch">
                  <div className="px-inset flex-1 text-center text-xl font-bold tracking-[0.12em] py-2 select-all">{space.inviteCode}</div>
                  <button className="px-btn px-btn--paper shrink-0" onClick={() => copy('code')}>
                    {copied === 'code' ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-sm text-[var(--muted)] mt-2">Valid for 7 days. You can find it again under “Invite” in the menu.</p>
              </div>
              <button className="px-btn text-lg mt-1" onClick={onDone}>
                Step inside →
              </button>
              <p className="text-xs text-[var(--muted)]">
                Preview build: invites work within this browser until the backend is connected.
              </p>
            </div>
          )}

          {step === 'join' && (
            <form
              className="flex flex-col gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                if (!invite) {
                  setError("We couldn't find that invite. Check the code, or ask for a fresh link. (In this preview, invites only work in the browser that created them.)");
                  return;
                }
                if (invite.space.partnerId) {
                  setError('That seat is already taken. This place already has two people.');
                  return;
                }
                setStep('join-look');
              }}
            >
              <div>
                <div className="text-sm font-semibold tracking-[0.16em] uppercase text-[var(--terracotta-d)]">You're invited</div>
                <h2 className="text-3xl font-bold leading-tight mt-1">
                  {invite ? `${invite.host.name} saved you a seat.` : 'Come on in.'}
                </h2>
                <p className="text-[var(--muted)] mt-1">
                  {invite ? `Welcome to ${invite.space.name}.` : 'Paste the code from your invite.'}
                </p>
              </div>
              <label>
                <span className="px-label">Invite code</span>
                <input className="px-input uppercase tracking-[0.1em]" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ST-XXXX-XXXX-XXXX" required />
              </label>
              <label>
                <span className="px-label">Your name</span>
                <input
                  className="px-input"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                  placeholder={invite?.space.partnerPlaceholderName || 'Your name'}
                  required
                  maxLength={24}
                />
              </label>
              {error && <div className="px-inset text-sm p-3 text-[#7f3835]">{error}</div>}
              <div className="flex items-center justify-between gap-3 mt-2">
                <button type="button" className="px-btn px-btn--paper" onClick={() => setStep('welcome')}>
                  Back
                </button>
                <button type="submit" className="px-btn">
                  Make my character →
                </button>
              </div>
            </form>
          )}

          {step === 'join-look' && invite && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-3xl font-bold leading-tight">Now make you.</h2>
                <p className="text-[var(--muted)] mt-1">{invite.host.name} is already on the couch. Your seat's right there.</p>
              </div>
              <CharacterStudio value={joinLook} onChange={setJoinLook} compact />
              {error && <div className="px-inset text-sm p-3 text-[#7f3835]">{error}</div>}
              <div className="flex items-center justify-between gap-3 mt-2">
                <button className="px-btn px-btn--paper" onClick={() => setStep('join')}>
                  Back
                </button>
                <button
                  className="px-btn"
                  onClick={() => {
                    const r = joinWithCode(code, joinName, joinLook);
                    if (r === 'ok') onDone();
                    else setError(r === 'expired' ? 'This invite has expired. Ask for a fresh one.' : r === 'full' ? 'That seat is already taken.' : "We couldn't find that invite.");
                  }}
                >
                  Take my seat →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
