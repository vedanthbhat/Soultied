import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useTogether } from '../together/TogetherContext';
import { VISIT_WHAT_MAX, daysLeft, visitLine } from '../together/visit';
import { plannedLine } from '../together/bucket';
import { addDays } from '../letters/engine';

/** The next time you'll be together: the countdown, and a way for either of you to set or change the day. */
export const NextVisit: React.FC = () => {
  const { today, partnerUser } = useApp();
  const { visit, setVisit, bucket } = useTogether();
  const left = daysLeft(visit, today);
  const line = visitLine(visit, today);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(visit.date || '');
  const [what, setWhat] = useState(visit.what);

  if (!partnerUser) return null;

  const open = () => {
    setDate(left !== null ? visit.date : '');
    setWhat(left !== null ? visit.what : '');
    setEditing(true);
  };

  return (
    <section className="px-inset flex flex-col gap-3 px-4 py-3.5" aria-label={line ?? "The next time you're together"}>
      <div className="flex items-center gap-4 flex-wrap">
        <div className="leading-tight flex-1 min-w-[180px]">
          <div className="text-sm text-[var(--muted)]">Next time together</div>
          {left !== null ? (
            <div className="text-xl font-bold">{left > 1 ? `${left} days` : left === 1 ? 'Tomorrow' : 'Today!'}</div>
          ) : (
            <div className="text-xl font-bold">When will you see each other?</div>
          )}
          <div className="text-sm text-[var(--muted)]">
            {left === null
              ? 'Set the day and you’ll both count down to it.'
              : left > 1
                ? `until ${visit.what || 'you’re together'}`
                : visit.what || 'you’re together'}
          </div>
          {left !== null && plannedLine(bucket, visit.what) && <div className="text-sm text-[var(--terracotta-d,#8f4b3a)]">{plannedLine(bucket, visit.what)}</div>}
        </div>
        {!editing && (
          <button className="px-btn px-btn--small" onClick={open}>
            {left !== null ? 'Change' : 'Set the day'}
          </button>
        )}
      </div>
      {editing && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (date) setVisit(date, what);
            setEditing(false);
          }}
        >
          <div className="flex gap-3 flex-wrap">
            <label className="flex-1 min-w-[150px]">
              <span className="px-label">The day</span>
              <input className="px-input" type="date" required min={today} max={addDays(today, 3 * 365)} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="flex-[2] min-w-[180px]">
              <span className="px-label">Where, or what for (if you like)</span>
              <input className="px-input" value={what} maxLength={VISIT_WHAT_MAX} placeholder="Goa, the wedding, your birthday" onChange={(e) => setWhat(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button className="px-btn px-btn--small" type="submit">
              Save
            </button>
            <button className="px-btn px-btn--paper px-btn--small" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
            {left !== null && (
              <button
                className="px-link text-sm ml-auto"
                type="button"
                onClick={() => {
                  setVisit('', '');
                  setEditing(false);
                }}
              >
                Take it down
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
};
