import type { UserProfile } from '../types';

export type WeightEntry = NonNullable<UserProfile['weightLog']>[number];

/** Roughly a year of daily weigh-ins: plenty for trends, small enough to sync with the profile. */
const MAX_ENTRIES = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

/** One entry per day (a second weigh-in replaces the first), oldest first. */
export function recordWeight(log: readonly WeightEntry[] | undefined, date: string, kg: number): WeightEntry[] {
  const rounded = Math.round(kg * 10) / 10;
  const others = (log ?? []).filter((entry) => entry.date !== date);
  return [...others, { date, kg: rounded }].sort((a, b) => a.date.localeCompare(b.date)).slice(-MAX_ENTRIES);
}

const dayNumber = (date: string) => Math.round(new Date(`${date}T12:00:00`).getTime() / DAY_MS);

/** Change over the last `days` (from the latest entry back to the closest one at least that old). */
export function weightChange(log: readonly WeightEntry[], days: number): { kg: number; days: number } | null {
  if (log.length < 2) return null;
  const last = log[log.length - 1];
  const since = dayNumber(last.date) - days;
  const base = [...log].reverse().find((entry) => dayNumber(entry.date) <= since) ?? log[0];
  if (base === last) return null;
  return { kg: Math.round((last.kg - base.kg) * 10) / 10, days: dayNumber(last.date) - dayNumber(base.date) };
}

/** A weigh-in is due when there is none, or the last one is a week old or more. */
export function weighInDue(log: readonly WeightEntry[] | undefined, today: string): boolean {
  const last = log?.[log.length - 1];
  return !last || dayNumber(today) - dayNumber(last.date) >= 7;
}
