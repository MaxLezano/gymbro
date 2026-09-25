import type { UserProfile } from '../types';

export type DailyLog = NonNullable<UserProfile['todayLog']>;

/** One glass: the step of the water tracker. */
export const GLASS_ML = 250;

/** Today's log, or an empty one when the stored log belongs to another day. */
export function logFor(profile: Pick<UserProfile, 'todayLog'>, dateKey: string): DailyLog {
  const log = profile.todayLog;
  return log?.date === dateKey ? log : { date: dateKey, eatenMeals: [], waterMl: 0 };
}

export function toggleMeal(log: DailyLog, mealIndex: number): DailyLog {
  const eatenMeals = log.eatenMeals.includes(mealIndex)
    ? log.eatenMeals.filter((index) => index !== mealIndex)
    : [...log.eatenMeals, mealIndex].sort((a, b) => a - b);
  return { ...log, eatenMeals };
}

/** Adds (or with a negative amount, removes) water, never below zero or above 10 L. */
export function addWater(log: DailyLog, ml: number): DailyLog {
  return { ...log, waterMl: Math.min(10_000, Math.max(0, log.waterMl + ml)) };
}

/** Calories and protein from the meals marked as eaten. */
export function eatenTotals(
  meals: readonly { kcal?: number; proteinGrams?: number }[],
  log: DailyLog
): { kcal: number; protein: number } {
  return log.eatenMeals.reduce(
    (sum, index) => ({ kcal: sum.kcal + (meals[index]?.kcal ?? 0), protein: sum.protein + (meals[index]?.proteinGrams ?? 0) }),
    { kcal: 0, protein: 0 }
  );
}
