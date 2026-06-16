// Reading-streak computation.
//
// A "reading day" is any local calendar day on which the user recorded reading
// activity — currently: logging a session (a mood_logs row) or finishing a
// book (books.date_finished). The streak is the number of consecutive days,
// counting back from today, on which there was activity.
//
// Today not yet having activity does NOT break the streak — it only breaks once
// a full day passes with nothing. So if you read yesterday but not yet today,
// the streak still stands (anchored on yesterday) until today ends.

// Local-time YYYY-MM-DD key for a date.
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * @param timestamps ISO date strings of reading activity (any order, may repeat)
 * @param now        override for "today" — defaults to the current time
 */
export function computeStreak(
  timestamps: (string | null | undefined)[],
  now: Date = new Date()
): number {
  const days = new Set<string>();
  for (const ts of timestamps) {
    if (!ts) continue;
    const d = new Date(ts);
    if (isNaN(d.getTime())) continue;
    days.add(dayKey(d));
  }
  if (days.size === 0) return 0;

  const today = startOfDay(now);
  let cursor = today;

  // If there's nothing today, the streak may still be alive through yesterday.
  if (!days.has(dayKey(today))) {
    const yesterday = addDays(today, -1);
    if (days.has(dayKey(yesterday))) cursor = yesterday;
    else return 0;
  }

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
