import type { WorkoutSession } from '../types';
import { estimateOneRepMax, logDisplayName, startOfWeek } from './workout';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** How long progress may stall before a deload is worth it. */
const STALL_WEEKS = 3;
/** After dismissing (or doing) a deload, do not suggest another one this soon. */
export const DELOAD_SNOOZE_MS = 4 * WEEK_MS;

export interface DeloadSuggestion {
  /** Lifts that have not improved in the last weeks, by name. */
  stalledLifts: string[];
}

const completedAt = (session: WorkoutSession) => session.completedAt ?? session.startedAt;

/** Best estimated 1RM of an exercise in one session (0 when nothing heavy was logged). */
function sessionBest(session: WorkoutSession, exerciseId: string): number {
  const log = session.exercises.find((item) => item.exerciseId === exerciseId);
  return Math.max(0, ...(log?.sets ?? []).filter((set) => set.completed && set.weightKg > 0 && set.reps > 0).map((set) => estimateOneRepMax(set.weightKg, set.reps)));
}

/**
 * A deload helps when someone trains regularly but their main lifts stopped moving:
 * sessions in at least 4 of the last 5 weeks, and most lifts trained both before and
 * during the last 3 weeks without beating their earlier best.
 */
export function suggestDeload(
  history: readonly WorkoutSession[],
  options: { now?: number; snoozedAt?: number } = {}
): DeloadSuggestion | null {
  const now = options.now ?? Date.now();
  if (options.snoozedAt && now - options.snoozedAt < DELOAD_SNOOZE_MS) return null;

  const done = history.filter((session) => session.status === 'completed');
  const thisWeek = startOfWeek(now);
  const activeWeeks = new Set(
    done.map((session) => startOfWeek(completedAt(session))).filter((week) => week > thisWeek - 5 * WEEK_MS)
  );
  if (activeWeeks.size < 4) return null;

  const since = now - STALL_WEEKS * WEEK_MS;
  const recent = done.filter((session) => completedAt(session) >= since);
  const before = done.filter((session) => completedAt(session) < since && completedAt(session) >= since - 8 * WEEK_MS);

  const lifts = new Map<string, string>();
  for (const session of recent) for (const log of session.exercises) lifts.set(log.exerciseId, logDisplayName(log));

  let tracked = 0;
  const stalled: string[] = [];
  for (const [exerciseId, name] of lifts) {
    const recentBest = Math.max(0, ...recent.map((session) => sessionBest(session, exerciseId)));
    const earlierBest = Math.max(0, ...before.map((session) => sessionBest(session, exerciseId)));
    if (recentBest === 0 || earlierBest === 0) continue;
    tracked += 1;
    if (recentBest <= earlierBest) stalled.push(name);
  }
  // Two stalled lifts can be a bad week; most of the main lifts stalled is a trend.
  return tracked >= 2 && stalled.length >= 2 && stalled.length / tracked >= 0.6 ? { stalledLifts: stalled } : null;
}
