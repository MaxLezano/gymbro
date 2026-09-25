import type { WorkoutExerciseLog } from '../types';
import { getExercise } from '../../data/catalog';

export interface WarmupSet {
  weightKg: number;
  reps: number;
}

/** Below this working weight a warm-up ramp adds little: the first working set is the warm-up. */
const MIN_WORKING_KG = 30;
const BAR_KG = 20;
const RAMPED = new Set(['barbell', 'olympic barbell', 'ez barbell', 'trap bar', 'smith machine', 'dumbbell', 'leverage machine', 'cable', 'sled machine', 'kettlebell']);

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * Ramp to the working weight: light, then fewer reps as it gets heavier, never tiring.
 * Barbells start with the empty bar; dumbbells and machines at half the load.
 */
export function warmupSets(equipment: string, workingKg: number): WarmupSet[] {
  if (!RAMPED.has(equipment) || workingKg < MIN_WORKING_KG) return [];
  const barbell = equipment.includes('barbell') || equipment === 'trap bar' || equipment === 'smith machine';
  const step = barbell ? 2.5 : equipment === 'dumbbell' || equipment === 'kettlebell' ? 2 : 5;
  const ramp = barbell
    ? [
        { ratio: 0.5, reps: 5 },
        { ratio: 0.7, reps: 3 },
        ...(workingKg >= 80 ? [{ ratio: 0.85, reps: 2 }] : []),
      ]
    : [
        { ratio: 0.5, reps: 8 },
        { ratio: 0.75, reps: 4 },
      ];
  const sets: WarmupSet[] = barbell ? [{ weightKg: BAR_KG, reps: 10 }] : [];
  for (const { ratio, reps } of ramp) {
    const weightKg = roundTo(workingKg * ratio, step);
    // Skip steps that would repeat (or pass) the previous one or reach the working weight.
    if (weightKg >= workingKg || weightKg <= (sets[sets.length - 1]?.weightKg ?? 0)) continue;
    sets.push({ weightKg, reps });
  }
  return sets;
}

/** Heaviest planned working weight of an exercise (its first set is usually the one to warm up for). */
const workingWeight = (log: WorkoutExerciseLog) => Math.max(0, ...log.sets.map((set) => set.weightKg));

/** The first exercise of the session that deserves a warm-up ramp, or -1. */
export function warmupExerciseIndex(exercises: readonly WorkoutExerciseLog[]): number {
  return exercises.findIndex((log) => {
    const equipment = getExercise(log.exerciseId)?.equipment ?? '';
    return warmupSets(equipment, workingWeight(log)).length > 0;
  });
}

/** Warm-up for one exercise log (empty when it does not need one). */
export function warmupFor(log: WorkoutExerciseLog): WarmupSet[] {
  return warmupSets(getExercise(log.exerciseId)?.equipment ?? '', workingWeight(log));
}
