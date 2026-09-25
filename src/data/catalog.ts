import rawExercises from './exercises.json';
import type { Exercise } from '../core/types';
import {
  exerciseName,
  labelBodyPart,
  labelEquipment,
  labelTarget,
} from '../core/i18n/labels';
import { spanishAliases } from '../core/i18n/exerciseAliases';

export interface CatalogExercise extends Exercise {
  /** Name in the app language (locales/<lang>/exercises.json), or the title-cased English name. */
  displayName: string;
  /** Lowercased, accent-free haystack (EN + ES labels) for instant search. */
  searchText: string;
}

export const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Built once at module load: O(1) lookup and pre-normalized search text. */
export const EXERCISES: CatalogExercise[] = (rawExercises as Exercise[]).map((exercise) => {
  const displayName = exerciseName(exercise.id, exercise.name);
  return {
    ...exercise,
    displayName,
    searchText: normalizeText(
      [
        displayName,
        exercise.name,
        spanishAliases(exercise.name),
        exercise.target,
        exercise.bodyPart,
        exercise.equipment,
        labelTarget(exercise.target),
        labelBodyPart(exercise.bodyPart),
        labelEquipment(exercise.equipment),
      ].join(' ')
    ),
  };
});

const EXERCISE_BY_ID = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));

export const getExercise = (id: string): CatalogExercise | undefined => EXERCISE_BY_ID.get(id);

export const EXERCISE_COUNT = EXERCISES.length;
