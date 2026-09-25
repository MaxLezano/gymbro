import type { NutritionMetrics, UserProfile, WorkoutSession } from '../../types';
import { EXERCISES, getExercise, type CatalogExercise } from '../../../data/catalog';
import { fitsHomeEquipment } from '../../utils/equipment';
import { generateRoutine, type TrainingFocus } from '../../utils/programGenerator';
import { formatRelativeDate, logDisplayName, personalRecords, sessionDate } from '../../utils/workout';
import { ACTIVITY_LABELS, DIETARY_CONDITION_LABELS, GOAL_LABELS, HOME_EQUIPMENT_OPTIONS, LEVEL_LABELS, LOCATION_LABELS, PRIORITY_LABELS, labelTarget } from '../../i18n/labels';
import type { ParsedQuery } from './intents';

export interface CoachContext {
  profile: UserProfile;
  plan: NutritionMetrics;
  history: WorkoutSession[];
}

export function describeAthlete({ profile, plan }: CoachContext): string {
  const equipment = profile.homeEquipment
    .map((id) => HOME_EQUIPMENT_OPTIONS.find((option) => option.id === id)?.label ?? id)
    .join(', ');
  return [
    // No name or email: the AI provider only gets what it needs to coach.
    `${profile.gender === 'male' ? 'Hombre' : 'Mujer'}, ${profile.age} años`,
    `Peso ${profile.weightKg} kg, altura ${profile.heightCm} cm, IMC ${plan.bmi}`,
    `Grasa corporal ${plan.bodyFatPercent}% (${plan.bodyFatMethod === 'navy' ? 'U.S. Navy' : 'estimada'}), masa magra ${plan.leanMassKg} kg, FFMI ${plan.ffmi} (${plan.ffmiCategory})`,
    `Objetivo: ${GOAL_LABELS[profile.fitnessGoal].title} | Actividad: ${ACTIVITY_LABELS[profile.activityLevel].title} | Nivel: ${LEVEL_LABELS[profile.experience]}`,
    `Calorías meta ${plan.targetCalories} kcal (TDEE ${plan.tdee}) | Proteína ${plan.proteinGrams} g, carbohidratos ${plan.carbGrams} g, grasas ${plan.fatGrams} g | Agua ${plan.waterLitersDaily} L`,
    `Peso atlético meta ${plan.idealWeightKg} kg`,
    `Entrena en: ${LOCATION_LABELS[profile.trainingLocation]}${profile.trainingLocation !== 'gym' ? ` | Equipo en casa: ${equipment}` : ''}`,
    `Condiciones alimentarias: ${profile.dietaryConditions?.length ? profile.dietaryConditions.map((condition) => `${DIETARY_CONDITION_LABELS[condition].title} (${DIETARY_CONDITION_LABELS[condition].description.toLowerCase()})`).join(', ') : 'ninguna'}`,
    `Músculos prioritarios: ${profile.focusMuscles?.length ? profile.focusMuscles.map((muscle) => PRIORITY_LABELS[muscle]).join(', ') : 'ninguno (programa equilibrado)'}`,
  ].join('\n');
}

export function describeHistory(history: WorkoutSession[]): string {
  if (history.length === 0) return 'Sin entrenamientos registrados todavía.';
  const recent = history.slice(0, 4).map((session) => {
    const lifts = session.exercises
      .slice(0, 5)
      .map((log) => {
        const top = log.sets.reduce((best, set) => (set.weightKg * set.reps > best.weightKg * best.reps ? set : best), log.sets[0]);
        return top ? `${logDisplayName(log)} ${top.weightKg}kg×${top.reps}` : logDisplayName(log);
      })
      .join('; ');
    return `- ${formatRelativeDate(sessionDate(session))}: ${session.title} (${lifts})`;
  });
  const records = personalRecords(history)
    .slice(0, 5)
    .map((record) => `${record.exerciseName} 1RM≈${record.bestOneRepMax}kg`)
    .join(', ');
  return `Últimas sesiones:\n${recent.join('\n')}\nRécords: ${records || 'ninguno'}`;
}

/**
 * Picks the catalog slice the model may reference. Keeping it small (and only
 * exercises the athlete can actually do) makes answers grounded and fast.
 */
export function selectCandidates(query: ParsedQuery, context: CoachContext, limit = 40): CatalogExercise[] {
  const { profile } = context;
  const atHome = (query.location ?? (profile.trainingLocation === 'home' ? 'home' : 'gym')) === 'home';
  const available = (exercise: CatalogExercise) => !atHome || fitsHomeEquipment(exercise, profile.homeEquipment);

  const picked = new Map<string, CatalogExercise>();
  const add = (exercise?: CatalogExercise) => {
    if (exercise && available(exercise) && picked.size < limit) picked.set(exercise.id, exercise);
  };

  // The exercise being asked about always goes in, even if it needs gym equipment.
  const asked = query.exerciseId ? getExercise(query.exerciseId) : undefined;
  if (asked) picked.set(asked.id, asked);

  const focuses: TrainingFocus[] = query.focus ? [query.focus] : ['full_body', 'push', 'pull', 'legs', 'core'];
  for (const focus of focuses) {
    const routine = generateRoutine({ focus, profile, location: atHome ? 'home' : 'gym', maxExercises: 7 });
    routine.exercises.forEach((item) => add(getExercise(item.exerciseId)));
  }

  // Widen with same-target alternatives so the model has real choices.
  const targets = new Set([...picked.values()].map((exercise) => exercise.target));
  for (const exercise of EXERCISES) {
    if (picked.size >= limit) break;
    if (targets.has(exercise.target) && !/v\. \d|\(|pov/.test(exercise.name)) add(exercise);
  }
  return [...picked.values()];
}

/** Full card of the exercise the athlete asks about: same data the app shows. */
export function describeExercise(exerciseId: string): string {
  const exercise = getExercise(exerciseId);
  if (!exercise) return '';
  const secondary = exercise.secondaryMuscles.length ? ` | también: ${exercise.secondaryMuscles.map(labelTarget).join(', ')}` : '';
  const steps = exercise.instructions.slice(0, 6).map((step, i) => `${i + 1}. ${step}`).join('\n');
  return `${exercise.id} | ${exercise.displayName} | ${labelTarget(exercise.target)} | ${exercise.equipment}${secondary}\nTécnica según la app:\n${steps}`;
}

export function describeCandidates(candidates: CatalogExercise[]): string {
  return candidates.map((exercise) => `${exercise.id} | ${exercise.displayName} | ${labelTarget(exercise.target)} | ${exercise.equipment}`).join('\n');
}
