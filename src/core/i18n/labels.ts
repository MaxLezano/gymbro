import type {
  ActivityLevel,
  DietaryCondition,
  ExperienceLevel,
  FitnessGoal,
  PriorityMuscle,
  HomeEquipment,
  TrainingLocation,
} from '../types';
import { t } from './index';

/** Labels for the English taxonomy of the exercise dataset, read from locales/<lang>/catalog.json. */
const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);
const label = (group: string, value: string) => t(`catalog:${group}.${value}`, { defaultValue: capitalize(value) });

export const labelBodyPart = (value: string) => label('bodyParts', value);
export const labelTarget = (value: string) => label('targets', value);
export const labelEquipment = (value: string) => label('equipment', value);

/** A whole group of a catalog namespace (e.g. every goal) as a typed record. */
const group = <T>(key: string) => t(`catalog:${key}`, { returnObjects: true }) as unknown as T;

const LOWERCASE_WORDS = new Set(['on', 'with', 'to', 'of', 'the', 'and', 'a', 'in', 'v.']);

/** Dataset names are lowercase ("dumbbell bench press"); present them in title case. */
export function formatExerciseName(name: string): string {
  return name
    .replace(/в°/g, '°')
    .split(' ')
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word
        .split('-')
        .map((part) => (/^\(?[a-z]/.test(part) ? part.replace(/[a-z]/, (c) => c.toUpperCase()) : part))
        .join('-');
    })
    .join(' ');
}

/** Translated exercise name, falling back to the title-cased English name. */
export const exerciseName = (id: string, englishName: string) => t(`exercises:${id}`, { defaultValue: formatExerciseName(englishName) });

export const GOAL_LABELS = group<Record<FitnessGoal, { title: string; short: string; description: string }>>('goals');

export const PRIORITY_LABELS = group<Record<PriorityMuscle, string>>('priorities');

export const DIETARY_CONDITION_LABELS = group<Record<DietaryCondition, { title: string; description: string }>>('dietaryConditions');

export const DIETARY_CONDITIONS = Object.keys(DIETARY_CONDITION_LABELS) as DietaryCondition[];

export const ACTIVITY_LABELS = group<Record<ActivityLevel, { title: string; description: string }>>('activity');

export const LOCATION_LABELS = group<Record<TrainingLocation, string>>('locations');

export const LEVEL_LABELS = group<Record<ExperienceLevel, string>>('levels');

const HOME_EQUIPMENT_ICONS: Record<HomeEquipment, string> = {
  body_weight: 'body-outline',
  dumbbells: 'barbell-outline',
  adjustable_bench: 'bed-outline',
  barbell_plates: 'barbell',
  pullup_bar: 'remove-outline',
  kettlebell: 'fitness-outline',
  resistance_bands: 'git-commit-outline',
  treadmill: 'walk-outline',
  stationary_bike: 'bicycle-outline',
  ab_wheel: 'ellipse-outline',
};

const HOME_EQUIPMENT_NAMES = group<Record<HomeEquipment, string>>('homeEquipment');

export const HOME_EQUIPMENT_OPTIONS: { id: HomeEquipment; label: string; icon: string }[] = (
  Object.keys(HOME_EQUIPMENT_ICONS) as HomeEquipment[]
).map((id) => ({ id, label: HOME_EQUIPMENT_NAMES[id], icon: HOME_EQUIPMENT_ICONS[id] }));
