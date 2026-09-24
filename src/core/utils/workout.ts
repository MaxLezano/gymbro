import type { Routine, SetLog, WorkoutExerciseLog, WorkoutSession } from '../types';
import { getExercise } from '../../data/catalog';

let idCounter = 0;
/** Collision-safe id without extra deps (timestamp + counter + random). */
export function createId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const DEFAULT_REST_SECONDS = 90;

/** "8-12" -> 10, "12" -> 12, "Al fallo" -> 10 */
export function parseTargetReps(targetReps?: string): number {
  if (!targetReps) return 10;
  const numbers = targetReps.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return 10;
  if (numbers.length === 1) return numbers[0];
  return Math.round((numbers[0] + numbers[1]) / 2);
}

function createSets(count: number, weightKg: number, reps: number): SetLog[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: createId('set'),
    setNumber: index + 1,
    type: 'normal' as const,
    weightKg,
    reps,
    completed: false,
  }));
}

/** Last completed working set for an exercise, used to prefill loads. */
export function findLastPerformance(
  exerciseId: string,
  history: WorkoutSession[]
): { weightKg: number; reps: number; sets: SetLog[] } | null {
  for (const session of history) {
    const log = session.exercises.find((item) => item.exerciseId === exerciseId);
    const done = log?.sets.filter((set) => set.completed && set.reps > 0) ?? [];
    if (done.length > 0) {
      const top = done.reduce((best, set) => (set.weightKg > best.weightKg ? set : best), done[0]);
      return { weightKg: top.weightKg, reps: top.reps, sets: done };
    }
  }
  return null;
}

export function createExerciseLog(
  exerciseId: string,
  history: WorkoutSession[],
  options: { sets?: number; targetReps?: string; restSeconds?: number; fallbackName?: string } = {}
): WorkoutExerciseLog {
  const exercise = getExercise(exerciseId);
  const last = findLastPerformance(exerciseId, history);
  const reps = last?.reps ?? parseTargetReps(options.targetReps);
  const isBodyweight = exercise?.equipment === 'body weight';
  const weight = last?.weightKg ?? (isBodyweight ? 0 : 10);

  return {
    exerciseId,
    exerciseName: exercise?.displayName ?? options.fallbackName ?? `Ejercicio ${exerciseId}`,
    targetMuscle: exercise?.target,
    targetReps: options.targetReps,
    restSeconds: options.restSeconds ?? DEFAULT_REST_SECONDS,
    sets: createSets(options.sets ?? 3, weight, reps),
  };
}

export function createSessionFromRoutine(routine: Routine, history: WorkoutSession[]): WorkoutSession {
  return {
    id: createId('session'),
    title: routine.title,
    routineId: routine.id,
    startedAt: Date.now(),
    durationSeconds: 0,
    totalVolumeKg: 0,
    status: 'in_progress',
    exercises: routine.exercises.map((item) =>
      createExerciseLog(item.exerciseId, history, {
        sets: item.targetSets,
        targetReps: item.targetReps,
        restSeconds: item.restSeconds,
        fallbackName: item.exerciseName,
      })
    ),
  };
}

export function createEmptySession(title = 'Entrenamiento libre'): WorkoutSession {
  return {
    id: createId('session'),
    title,
    startedAt: Date.now(),
    durationSeconds: 0,
    totalVolumeKg: 0,
    status: 'in_progress',
    exercises: [],
  };
}

export function computeVolume(exercises: WorkoutExerciseLog[]): number {
  let total = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (set.completed) total += (set.weightKg || 0) * (set.reps || 0);
    }
  }
  return Math.round(total);
}

export function countCompletedSets(exercises: WorkoutExerciseLog[]): number {
  return exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.completed).length, 0);
}

export function countTotalSets(exercises: WorkoutExerciseLog[]): number {
  return exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

/**
 * Estimated one-rep max. Epley for reps > 10, Brzycki for <= 10 (more accurate
 * in low rep ranges). Returns the weight itself for singles.
 */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  const value = reps <= 10 ? weightKg * (36 / (37 - reps)) : weightKg * (1 + reps / 30);
  return Math.round(value * 10) / 10;
}

/** "1 serie" / "3 series" */
export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (value: number) => value.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function formatVolume(kg: number): string {
  if (kg >= 10_000) return `${(kg / 1000).toFixed(1)} t`;
  return `${Math.round(kg).toLocaleString('es-ES')} kg`;
}

/** 120 -> "2 min", 90 -> "1 min 30 s", 45 -> "45 s" */
export function formatRest(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes === 0) return `${secs} s`;
  return secs === 0 ? `${minutes} min` : `${minutes} min ${secs} s`;
}

/** "6-10" -> { min: 6, max: 10 }, "12" -> { min: 12, max: 12 } */
export function parseRepRange(targetReps?: string): { min: number; max: number } {
  const numbers = targetReps?.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length === 0) return { min: 8, max: 12 };
  return { min: Math.min(...numbers.slice(0, 2)), max: Math.max(...numbers.slice(0, 2)) };
}

/** Smallest practical jump per equipment (dumbbells usually go 2 kg per hand). */
function loadStep(equipment?: string): number {
  if (equipment === 'dumbbell') return 2;
  if (equipment === 'kettlebell') return 4;
  return 2.5;
}

const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

export interface LoadSuggestion {
  kind: 'bodyweight' | 'first' | 'up' | 'down' | 'repeat' | 'estimate';
  /** Suggested load in kg; null when it is bodyweight or unknown. */
  weightKg: number | null;
  /** One short sentence explaining the suggestion. */
  reason: string;
}

/**
 * Double progression: stay on a load until every set reaches the top of the rep
 * range, then add the smallest step. Below the bottom of the range, go lighter.
 */
export function suggestLoad(options: {
  equipment?: string;
  targetReps?: string;
  last?: { weightKg: number; reps: number } | null;
  oneRepMax?: number;
}): LoadSuggestion {
  const { min, max } = parseRepRange(options.targetReps);
  const step = loadStep(options.equipment);
  const last = options.last;

  if (options.equipment === 'body weight' && !(last && last.weightKg > 0)) {
    return {
      kind: 'bodyweight',
      weightKg: null,
      reason: `Con tu peso corporal. Cuando llegues a ${max} repeticiones en todas las series, hazlo más lento o añade lastre.`,
    };
  }
  if (last && last.weightKg > 0) {
    if (last.reps >= max) {
      return { kind: 'up', weightKg: last.weightKg + step, reason: `La última vez hiciste ${last.reps} repeticiones con ${last.weightKg} kg, el tope del rango: toca subir.` };
    }
    if (last.reps < min) {
      return { kind: 'down', weightKg: roundTo(last.weightKg * 0.9, step), reason: `La última vez llegaste a ${last.reps} con ${last.weightKg} kg, por debajo de ${min}: baja un poco para hacerlo bien.` };
    }
    return { kind: 'repeat', weightKg: last.weightKg, reason: `Mantén ${last.weightKg} kg e intenta hacer una repetición más que la última vez (${last.reps}).` };
  }
  if (options.oneRepMax && options.oneRepMax > 0) {
    // Inverse Brzycki for the middle of the range.
    const reps = Math.round((min + max) / 2);
    return { kind: 'estimate', weightKg: roundTo(options.oneRepMax * ((37 - reps) / 36), step), reason: 'Calculado a partir de tu 1RM estimado.' };
  }
  return {
    kind: 'first',
    weightKg: null,
    reason: `Primera vez: elige un peso con el que llegues a ${max} repeticiones y sientas que podrías hacer 1 o 2 más. Empieza liviano en la primera serie.`,
  };
}

// ---------------------------------------------------------------------------
// History analytics
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** Monday 00:00 of the week containing `timestamp`. */
export function startOfWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const day = (date.getDay() + 6) % 7; // Monday = 0
  date.setHours(0, 0, 0, 0);
  return date.getTime() - day * DAY_MS;
}

export const sessionDate = (session: WorkoutSession) => session.completedAt ?? session.startedAt;

export interface WeekBucket {
  weekStart: number;
  volumeKg: number;
  sessions: number;
}

export function weeklyVolume(history: WorkoutSession[], weeks = 8, now = Date.now()): WeekBucket[] {
  const currentWeek = startOfWeek(now);
  const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, index) => ({
    weekStart: currentWeek - (weeks - 1 - index) * 7 * DAY_MS,
    volumeKg: 0,
    sessions: 0,
  }));
  for (const session of history) {
    const week = startOfWeek(sessionDate(session));
    const bucket = buckets.find((item) => item.weekStart === week);
    if (bucket) {
      bucket.volumeKg += session.totalVolumeKg || 0;
      bucket.sessions += 1;
    }
  }
  return buckets;
}

/** Completed sets per body part in the given window (a common hypertrophy volume metric). */
export function setsByBodyPart(history: WorkoutSession[], sinceTimestamp: number): { bodyPart: string; sets: number }[] {
  const counts = new Map<string, number>();
  for (const session of history) {
    if (sessionDate(session) < sinceTimestamp) continue;
    for (const log of session.exercises) {
      const bodyPart = getExercise(log.exerciseId)?.bodyPart ?? 'other';
      const done = log.sets.filter((set) => set.completed).length;
      if (done > 0) counts.set(bodyPart, (counts.get(bodyPart) ?? 0) + done);
    }
  }
  return [...counts.entries()].map(([bodyPart, sets]) => ({ bodyPart, sets })).sort((a, b) => b.sets - a.sets);
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  bestOneRepMax: number;
  bestWeightKg: number;
  bestReps: number;
  achievedAt: number;
  /** Chronological estimated 1RM per session (oldest first). */
  trend: { date: number; oneRepMax: number }[];
}

export function personalRecords(history: WorkoutSession[]): PersonalRecord[] {
  const records = new Map<string, PersonalRecord>();
  const chronological = [...history].sort((a, b) => sessionDate(a) - sessionDate(b));

  for (const session of chronological) {
    for (const log of session.exercises) {
      let sessionBest = 0;
      let bestSet: SetLog | null = null;
      for (const set of log.sets) {
        if (!set.completed) continue;
        const oneRm = estimateOneRepMax(set.weightKg, set.reps);
        if (oneRm > sessionBest) {
          sessionBest = oneRm;
          bestSet = set;
        }
      }
      if (!bestSet || sessionBest <= 0) continue;

      const existing = records.get(log.exerciseId);
      const point = { date: sessionDate(session), oneRepMax: sessionBest };
      if (!existing) {
        records.set(log.exerciseId, {
          exerciseId: log.exerciseId,
          exerciseName: getExercise(log.exerciseId)?.displayName ?? log.exerciseName,
          bestOneRepMax: sessionBest,
          bestWeightKg: bestSet.weightKg,
          bestReps: bestSet.reps,
          achievedAt: point.date,
          trend: [point],
        });
      } else {
        existing.trend.push(point);
        if (sessionBest > existing.bestOneRepMax) {
          existing.bestOneRepMax = sessionBest;
          existing.bestWeightKg = bestSet.weightKg;
          existing.bestReps = bestSet.reps;
          existing.achievedAt = point.date;
        }
      }
    }
  }
  return [...records.values()].sort((a, b) => b.trend.length - a.trend.length || b.bestOneRepMax - a.bestOneRepMax);
}

/** Consecutive weeks (ending this week or last week) with at least one session. */
export function weekStreak(history: WorkoutSession[], now = Date.now()): number {
  if (history.length === 0) return 0;
  const weeks = new Set(history.map((session) => startOfWeek(sessionDate(session))));
  let cursor = startOfWeek(now);
  if (!weeks.has(cursor)) cursor -= 7 * DAY_MS;
  let streak = 0;
  while (weeks.has(cursor)) {
    streak += 1;
    cursor -= 7 * DAY_MS;
  }
  return streak;
}

/** Which weekdays (Mon=0..Sun=6) of the current week have a session. */
export function trainedDaysThisWeek(history: WorkoutSession[], now = Date.now()): boolean[] {
  const weekStart = startOfWeek(now);
  const days = Array.from({ length: 7 }, () => false);
  for (const session of history) {
    const date = sessionDate(session);
    if (date >= weekStart && date < weekStart + 7 * DAY_MS) {
      days[Math.floor((date - weekStart) / DAY_MS)] = true;
    }
  }
  return days;
}

export function formatRelativeDate(timestamp: number, now = Date.now()): string {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - new Date(timestamp).setHours(0, 0, 0, 0)) / DAY_MS);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return new Date(timestamp).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
