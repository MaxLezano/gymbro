import type { Exercise, HomeEquipment, Routine, UserProfile } from '../types';
import { getExercise } from '../../data/catalog';

const NEEDS_PULLUP_BAR = /pull-?up|chin-?up|hanging|muscle up|toes to bar/;
const NEEDS_BENCH = /\bbench\b|incline|decline|\bseated\b|lying/;

/**
 * Returns the home equipment an exercise requires, or null when it needs gym-only
 * equipment (cables, machines, smith, sleds...).
 */
export function requiredHomeEquipment(exercise: Pick<Exercise, 'name' | 'equipment'>): HomeEquipment[] | null {
  const name = exercise.name.toLowerCase();
  const equipment = exercise.equipment.toLowerCase();
  const needs: HomeEquipment[] = [];

  if (name.includes('treadmill') || name === 'run (equipment)') return ['treadmill'];
  if (equipment === 'stationary bike' || name.includes('stationary bike')) return ['stationary_bike'];

  switch (equipment) {
    case 'body weight':
      needs.push(NEEDS_PULLUP_BAR.test(name) ? 'pullup_bar' : 'body_weight');
      break;
    case 'dumbbell':
      needs.push('dumbbells');
      break;
    case 'barbell':
    case 'olympic barbell':
    case 'ez barbell':
    case 'trap bar':
      needs.push('barbell_plates');
      break;
    case 'kettlebell':
      needs.push('kettlebell');
      break;
    case 'band':
    case 'resistance band':
      needs.push('resistance_bands');
      break;
    case 'wheel roller':
      needs.push('ab_wheel');
      break;
    default:
      return null;
  }

  if ((equipment === 'dumbbell' || needs.includes('barbell_plates')) && NEEDS_BENCH.test(name)) {
    needs.push('adjustable_bench');
  }
  return needs;
}

export function fitsHomeEquipment(exercise: Pick<Exercise, 'name' | 'equipment'>, owned: HomeEquipment[]): boolean {
  const needs = requiredHomeEquipment(exercise);
  if (!needs) return false;
  return needs.every((item) => item === 'body_weight' || owned.includes(item));
}

/** Whether the athlete can perform the exercise where they usually train. */
export function isExerciseAvailable(exercise: Exercise, profile: Pick<UserProfile, 'trainingLocation' | 'homeEquipment'>): boolean {
  if (profile.trainingLocation !== 'home') return true;
  return fitsHomeEquipment(exercise, profile.homeEquipment);
}

export interface RoutineCompatibility {
  available: number;
  total: number;
  missing: string[];
  isFullyAvailable: boolean;
}

export function routineCompatibility(
  routine: Routine,
  profile: Pick<UserProfile, 'trainingLocation' | 'homeEquipment'>
): RoutineCompatibility {
  const total = routine.exercises.length;
  if (profile.trainingLocation !== 'home') {
    return { available: total, total, missing: [], isFullyAvailable: true };
  }
  const missing: string[] = [];
  let available = 0;
  for (const item of routine.exercises) {
    const exercise = getExercise(item.exerciseId);
    if (exercise && fitsHomeEquipment(exercise, profile.homeEquipment)) available += 1;
    else missing.push(exercise?.displayName ?? item.exerciseName ?? item.exerciseId);
  }
  return { available, total, missing, isFullyAvailable: available === total };
}
