import React, { useEffect, useRef, useState } from 'react';

const still = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * A number that counts up to itself when it first shows, and to its new value when it changes (518 days, a
 * 4-day streak…). The iPhone's CountUp in Motion.swift. Stands still for prefers-reduced-motion.
 */
export const CountUp: React.FC<{ value: number; format?: (n: number) => string }> = ({ value, format = (n) => n.toLocaleString() }) => {
  const [shown, setShown] = useState(() => (still() ? value : 0));
  const from = useRef(shown);
  from.current = shown;
  useEffect(() => {
    if (still()) {
      setShown(value);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    // (small numbers tick quickly, big ones take a little longer, never long)
    const dur = Math.min(1100, 350 + Math.abs(value - start) / 0.6);
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(start + (value - start) * e));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span aria-label={format(value)}>{format(shown)}</span>;
};
