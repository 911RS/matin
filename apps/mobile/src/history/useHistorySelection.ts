import { useState } from 'react';
import { isoDate, monthOf, shiftMonth } from './monthGrid';
import type { MonthRef } from './monthGrid';

const sameMonth = (a: MonthRef, b: MonthRef) => a.year === b.year && a.month === b.month;

export function useHistorySelection(today: string) {
  const current = monthOf(today);
  const [month, setMonth] = useState<MonthRef>(current);
  const [selected, setSelected] = useState(today);
  const [seenToday, setSeenToday] = useState(today);

  if (seenToday !== today) {
    setSeenToday(today);
    if (selected === seenToday) setSelected(today);
    if (sameMonth(month, monthOf(seenToday))) setMonth(current);
  }

  const go = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(sameMonth(next, current) ? today : isoDate(next.year, next.month, 1));
  };

  return { month, current, atCurrent: sameMonth(month, current), selected, select: setSelected, go };
}
