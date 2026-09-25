import type { DietaryCondition } from '../../types';
import { DIETARY_CONDITION_LABELS } from '../../i18n/labels';

/**
 * Notes that accompany a meal plan. Shared by the coach replies and the
 * Nutrition tab so both always say the same thing.
 */

/** Below this daily target the minimum sensible servings can overshoot, so the plan warns. */
export const LOW_CALORIE_TARGET = 1500;

/** Shown whenever a menu is adapted to a health condition. */
export const MEDICAL_DISCLAIMER = 'Son recomendaciones generales y no reemplazan la indicación de tu médico o nutricionista.';

/** "Adaptado a: celiaquía, hipertensión." or null when there is nothing to adapt to. */
export function adaptedToNote(conditions: readonly DietaryCondition[]): string | null {
  const unique = [...new Set(conditions)];
  if (unique.length === 0) return null;
  return `Adaptado a: ${unique.map((condition) => DIETARY_CONDITION_LABELS[condition].title.toLowerCase()).join(', ')}.`;
}

/** Warning body for very low targets (the caller adds its own "Atención:" emphasis), or null. */
export function lowCalorieNote(targetCalories: number): string | null {
  if (targetCalories >= LOW_CALORIE_TARGET) return null;
  return (
    `Tu meta de ${targetCalories} kcal es muy baja. El menú usa porciones mínimas razonables y algunos días puede quedar un poco por encima. ` +
    'No recortes más las porciones por tu cuenta: un déficit tan grande conviene hacerlo con un nutricionista.'
  );
}

/** The disclaimer applies only when the plan was adapted to a health condition. */
export const medicalDisclaimerFor = (conditions: readonly DietaryCondition[]): string | null =>
  conditions.length > 0 ? MEDICAL_DISCLAIMER : null;
