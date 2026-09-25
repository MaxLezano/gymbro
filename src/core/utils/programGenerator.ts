import type { CoverKey, ExperienceLevel, FitnessGoal, PriorityMuscle, Routine, RoutineExercise, UserProfile } from '../types';
import { EXERCISES, getExercise, type CatalogExercise } from '../../data/catalog';
import { fitsHomeEquipment } from './equipment';
import { createId } from './workout';

export type TrainingFocus =
  | 'full_body'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'core'
  | 'glutes'
  | 'cardio';

export const FOCUS_LABELS: Record<TrainingFocus, string> = {
  full_body: 'Cuerpo completo',
  upper: 'Tren superior',
  lower: 'Tren inferior',
  push: 'Empuje',
  pull: 'Tracción',
  legs: 'Piernas',
  chest: 'Pecho y tríceps',
  back: 'Espalda',
  shoulders: 'Hombros',
  arms: 'Brazos',
  core: 'Core y abdomen',
  glutes: 'Glúteos',
  cardio: 'Cardio y acondicionamiento',
};

interface Slot {
  /** Preferred exercises, best first. The first available one wins. */
  candidates: string[];
  /** Fallback: any available catalog exercise hitting these targets. */
  targets: string[];
  compound?: boolean;
}

const SLOTS = {
  squat: { candidates: ['0043', '0739', '1760', '0534', '1004', '0514', '3769'], targets: ['quads', 'glutes'], compound: true },
  hinge: { candidates: ['0085', '0032', '1459', '0549', '3013'], targets: ['glutes', 'hamstrings'], compound: true },
  lunge: { candidates: ['0336', '0054', '0431', '1460', '1001'], targets: ['glutes', 'quads'] },
  hamstring: { candidates: ['0586', '0599', '1459', '0496', '3561'], targets: ['hamstrings'] },
  quadIso: { candidates: ['0585', '3007', '1460', '0514'], targets: ['quads'] },
  calves: { candidates: ['0088', '0417', '1373'], targets: ['calves'] },
  glute: { candidates: ['1409', '3523', '3561', '3013', '3236'], targets: ['glutes'] },
  hPush: { candidates: ['0025', '0289', '1254', '0662'], targets: ['pectorals'], compound: true },
  inclinePush: { candidates: ['0047', '0314', '0493'], targets: ['pectorals'] },
  chestIso: { candidates: ['0188', '0596', '0308', '0251', '0662'], targets: ['pectorals'] },
  vPush: { candidates: ['0091', '0405', '0426', '0520', '0997', '3662'], targets: ['delts'], compound: true },
  lateral: { candidates: ['0192', '0334', '0977'], targets: ['delts'] },
  rearDelt: { candidates: ['0378', '1022', '0293'], targets: ['delts', 'upper back'] },
  shrug: { candidates: ['0406'], targets: ['traps'] },
  vPull: { candidates: ['2330', '0652', '1326', '0970', '0499'], targets: ['lats'], compound: true },
  hPull: { candidates: ['0861', '0027', '0293', '0292', '0541', '0990', '0499'], targets: ['upper back', 'lats'], compound: true },
  biceps: { candidates: ['0031', '0294', '0968', '3123'], targets: ['biceps'] },
  biceps2: { candidates: ['0313', '0976', '0294'], targets: ['biceps'] },
  triceps: { candidates: ['0241', '0351', '0283', '0129', '0814'], targets: ['triceps'] },
  triceps2: { candidates: ['0283', '0129', '0351', '0814'], targets: ['triceps'] },
  core: { candidates: ['0857', '0472', '0872', '0276', '0001'], targets: ['abs'] },
  core2: { candidates: ['0620', '0464', '0687', '0003', '0274'], targets: ['abs'] },
  core3: { candidates: ['3544', '0687', '0276', '0003'], targets: ['abs'] },
  cardio: { candidates: ['3666', '2138', '2612', '0630', '1160', '0514'], targets: ['cardiovascular system'] },
} satisfies Record<string, Slot>;

type SlotId = keyof typeof SLOTS;

const TEMPLATES: Record<TrainingFocus, SlotId[]> = {
  full_body: ['squat', 'hPush', 'hPull', 'hinge', 'vPush', 'core'],
  upper: ['hPush', 'hPull', 'vPush', 'vPull', 'lateral', 'biceps', 'triceps'],
  lower: ['squat', 'hinge', 'lunge', 'hamstring', 'calves', 'core'],
  push: ['hPush', 'vPush', 'inclinePush', 'lateral', 'chestIso', 'triceps'],
  pull: ['vPull', 'hPull', 'rearDelt', 'biceps', 'biceps2', 'core'],
  legs: ['squat', 'hinge', 'lunge', 'quadIso', 'hamstring', 'calves'],
  chest: ['hPush', 'inclinePush', 'chestIso', 'triceps', 'triceps2'],
  back: ['vPull', 'hPull', 'hinge', 'rearDelt', 'biceps'],
  shoulders: ['vPush', 'lateral', 'rearDelt', 'shrug', 'core'],
  arms: ['biceps', 'triceps', 'biceps2', 'triceps2', 'core'],
  core: ['core', 'core2', 'core3', 'cardio'],
  glutes: ['glute', 'hinge', 'lunge', 'squat', 'core'],
  cardio: ['cardio', 'cardio', 'cardio', 'core', 'core2'],
};

const EXERCISE_LIMIT: Record<ExperienceLevel, number> = { beginner: 4, intermediate: 5, advanced: 6 };
const SETS: Record<ExperienceLevel, number> = { beginner: 3, intermediate: 3, advanced: 4 };

function prescription(goal: FitnessGoal, level: ExperienceLevel, compound: boolean, focus: TrainingFocus) {
  if (focus === 'cardio' || focus === 'core') {
    return { reps: goal === 'fat_loss' ? '15-20' : '12-15', rest: 45 };
  }
  if (goal === 'fat_loss') return { reps: compound ? '8-12' : '12-15', rest: compound ? 75 : 45 };
  if (goal === 'aggressive_bulk' || level === 'advanced') {
    return { reps: compound ? '5-8' : '8-12', rest: compound ? 150 : 75 };
  }
  return { reps: compound ? '6-10' : '10-12', rest: compound ? 120 : 60 };
}

/** Extra slots appended when the athlete wants to prioritise a muscle group. */
const FOCUS_MUSCLE_SLOTS: Record<PriorityMuscle, { slots: SlotId[]; focuses: TrainingFocus[] }> = {
  chest: { slots: ['inclinePush', 'chestIso'], focuses: ['full_body', 'upper', 'push', 'chest'] },
  back: { slots: ['hPull', 'vPull'], focuses: ['full_body', 'upper', 'pull', 'back'] },
  legs: { slots: ['quadIso', 'lunge'], focuses: ['full_body', 'lower', 'legs'] },
  glutes: { slots: ['glute', 'lunge'], focuses: ['full_body', 'lower', 'legs', 'glutes'] },
  shoulders: { slots: ['lateral', 'rearDelt'], focuses: ['full_body', 'upper', 'push', 'shoulders'] },
  arms: { slots: ['biceps2', 'triceps2'], focuses: ['full_body', 'upper', 'push', 'pull', 'arms'] },
  core: { slots: ['core2', 'core3'], focuses: ['full_body', 'lower', 'legs', 'core'] },
};

const FOCUS_COVERS: Record<TrainingFocus, CoverKey> = {
  full_body: 'full_body',
  upper: 'upper',
  lower: 'legs',
  push: 'push',
  pull: 'pull',
  legs: 'legs',
  chest: 'push',
  back: 'pull',
  shoulders: 'upper',
  arms: 'arms',
  core: 'core',
  glutes: 'glutes',
  cardio: 'hiit',
};

export interface GenerateOptions {
  focus: TrainingFocus;
  profile: Pick<UserProfile, 'trainingLocation' | 'homeEquipment' | 'fitnessGoal' | 'experience'> &
    Partial<Pick<UserProfile, 'focusMuscles'>>;
  /** Force a location regardless of the profile preference. */
  location?: 'home' | 'gym';
  maxExercises?: number;
  title?: string;
  /** Exercises to avoid (used to build A/B variations of the same day type). */
  exclude?: Set<string>;
}

export function generateRoutine({ focus, profile, location, maxExercises, title, exclude }: GenerateOptions): Routine {
  const trainsAtHome = (location ?? (profile.trainingLocation === 'home' ? 'home' : 'gym')) === 'home';
  const isAvailable = (exercise: CatalogExercise) =>
    !trainsAtHome || fitsHomeEquipment(exercise, profile.homeEquipment);

  const level = profile.experience ?? 'intermediate';
  const limit = maxExercises ?? EXERCISE_LIMIT[level];
  const chosen = new Set<string>();
  const exercises: RoutineExercise[] = [];

  // Priority muscles: their extra slots go right after the main compound lifts.
  // One priority on this day gets two extra slots; several share the space with one each.
  const template = TEMPLATES[focus];
  const priorities = (profile.focusMuscles ?? []).map((muscle) => FOCUS_MUSCLE_SLOTS[muscle]).filter((item) => item?.focuses.includes(focus));
  const extra = priorities.length === 1 ? priorities[0].slots : priorities.map((item) => item.slots[0]);
  const slots: SlotId[] = [...template.slice(0, 2), ...extra.filter((slot) => !template.slice(0, 2).includes(slot)), ...template.slice(2)];

  const pickFor = (slot: Slot, avoid?: Set<string>) =>
    slot.candidates
      .map((id) => getExercise(id))
      .find(
        (exercise): exercise is CatalogExercise =>
          !!exercise && !chosen.has(exercise.id) && !avoid?.has(exercise.id) && isAvailable(exercise)
      ) ??
    EXERCISES.find(
      (exercise) =>
        slot.targets.includes(exercise.target) &&
        !chosen.has(exercise.id) &&
        !avoid?.has(exercise.id) &&
        !/v\. \d|\(|pov/.test(exercise.name) &&
        isAvailable(exercise)
    );

  for (const slotId of slots) {
    if (exercises.length >= limit) break;
    const slot: Slot = SLOTS[slotId];
    // Prefer a fresh exercise for variation, but never drop a movement pattern for it.
    const pick = pickFor(slot, exclude) ?? pickFor(slot);
    if (!pick) continue;

    chosen.add(pick.id);
    const { reps, rest } = prescription(profile.fitnessGoal, level, !!slot.compound, focus);
    exercises.push({
      exerciseId: pick.id,
      exerciseName: pick.displayName,
      targetSets: SETS[level],
      targetReps: reps,
      restSeconds: rest,
    });
  }

  const bodyweightOnlyHome = trainsAtHome && profile.homeEquipment.every((item) => item === 'body_weight');
  return {
    id: createId('routine'),
    title: title ?? FOCUS_LABELS[focus],
    description: trainsAtHome ? 'Adaptada al equipo que tienes en casa.' : 'Diseñada para el gimnasio.',
    targetLocation: trainsAtHome ? 'home' : 'gym',
    level,
    estimatedMinutes: estimateMinutes(exercises),
    exercises,
    isCustom: true,
    cover: bodyweightOnlyHome && focus !== 'cardio' ? 'home' : FOCUS_COVERS[focus],
  };
}

/** ~40 s per set of work + prescribed rest + 5 min warm-up, rounded to 5. */
/**
 * Realistic session length: ~45 s per working set plus its rest, ~90 s to set up
 * each exercise (plates, bench, warm-up set) and 5 min of general warm-up.
 */
export function estimateMinutes(exercises: RoutineExercise[]): number {
  const seconds = exercises.reduce((sum, item) => sum + item.targetSets * (45 + item.restSeconds) + 90, 0);
  return Math.max(10, Math.round((seconds / 60 + 5) / 5) * 5);
}

/** Suggest a focus for today based on what was trained recently. */
export function suggestFocus(recentBodyParts: string[]): TrainingFocus {
  const recent = new Set(recentBodyParts);
  const trainedUpper = recent.has('chest') || recent.has('back') || recent.has('shoulders');
  const trainedLower = recent.has('upper legs');
  if (trainedUpper && !trainedLower) return 'lower';
  if (trainedLower && !trainedUpper) return 'upper';
  return 'full_body';
}

// ---------------------------------------------------------------------------
// Weekly program
// ---------------------------------------------------------------------------

/**
 * Splits by weekly frequency. From 2 days up every muscle group is trained at
 * least twice a week, which beats once-a-week for hypertrophy (Schoenfeld et al., 2016).
 */
function splitForDays(days: number, level: ExperienceLevel): TrainingFocus[] {
  switch (Math.max(1, Math.min(6, Math.round(days)))) {
    case 1:
      return ['full_body'];
    case 2:
      return ['full_body', 'full_body'];
    case 3:
      return level === 'beginner' ? ['full_body', 'full_body', 'full_body'] : ['push', 'pull', 'legs'];
    case 4:
      return ['upper', 'lower', 'upper', 'lower'];
    case 5:
      return ['upper', 'lower', 'push', 'pull', 'legs'];
    default:
      return ['push', 'pull', 'legs', 'push', 'pull', 'legs'];
  }
}

/** Working exercises that fit a session (≈8 min each incl. rest, plus a 5 min warm-up). */
function exercisesForMinutes(minutes: number): number {
  return Math.max(3, Math.min(7, Math.round((minutes - 5) / 8)));
}

export interface WeeklyProgram {
  id: string;
  title: string;
  daysPerWeek: number;
  routines: Routine[];
}

const DAY_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function generateWeeklyProgram(
  profile: GenerateOptions['profile'] & Partial<Pick<UserProfile, 'daysPerWeek' | 'sessionMinutes'>>
): WeeklyProgram {
  const days = Math.max(1, Math.min(6, profile.daysPerWeek ?? 3));
  const split = splitForDays(days, profile.experience);
  const maxExercises = exercisesForMinutes(profile.sessionMinutes ?? 60);
  const programId = createId('program');
  const usedByFocus = new Map<TrainingFocus, Set<string>>();
  const daysLabel = `${days} ${days === 1 ? 'día' : 'días'}`;

  const routines = split.map((focus, index) => {
    // When a day type repeats in the week, rotate exercises (A/B variation).
    const used = usedByFocus.get(focus);
    const routine = generateRoutine({ focus, profile, maxExercises, exclude: used });
    usedByFocus.set(focus, new Set([...(used ?? []), ...routine.exercises.map((item) => item.exerciseId)]));
    return {
      ...routine,
      title: `Día ${DAY_LETTERS[index]} · ${FOCUS_LABELS[focus]}`,
      description: `Parte de tu programa de ${daysLabel} por semana.`,
      programId,
      programDay: index + 1,
    };
  });

  return { id: programId, title: `Programa de ${daysLabel}`, daysPerWeek: days, routines };
}

