import type { WorkoutSession } from '../types';

/** How many recent exercises the pickers offer. */
export const RECENT_LIMIT = 10;

/**
 * Most recently trained distinct exercises, newest first. Derived from the
 * history (newest session first), so there is nothing extra to store or sync.
 */
export function recentExerciseIds(history: readonly WorkoutSession[], limit = RECENT_LIMIT): string[] {
  const sorted = [...history].sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt));
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const session of sorted) {
    for (const log of session.exercises) {
      if (seen.has(log.exerciseId)) continue;
      seen.add(log.exerciseId);
      ids.push(log.exerciseId);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

/** Adds (to the front) or removes a favorite; the list never holds duplicates. */
export function toggleFavorite(favorites: readonly string[] | undefined, exerciseId: string): string[] {
  const current = favorites ?? [];
  return current.includes(exerciseId) ? current.filter((id) => id !== exerciseId) : [exerciseId, ...current];
}
