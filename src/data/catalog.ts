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

function buildExercises(raw: Exercise[]): CatalogExercise[] {
  return raw.map((exercise) => {
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
}

let catalog: { list: CatalogExercise[]; byId: Map<string, CatalogExercise> } | null = null;

/**
 * Built on first use, not at import: the 1.2 MB dataset used to be parsed before the app
 * could draw anything. The boot screen calls this while its progress bar is visible.
 */
function loadCatalog() {
  if (!catalog) {
    // Deferred require on purpose: see above.
    const list = buildExercises(require('./exercises.json') as Exercise[]);
    catalog = { list, byId: new Map(list.map((exercise) => [exercise.id, exercise])) };
  }
  return catalog;
}

/** The whole catalog (1.324 exercises), in dataset order. */
export const getExercises = (): CatalogExercise[] => loadCatalog().list;

export const getExercise = (id: string): CatalogExercise | undefined => loadCatalog().byId.get(id);

export const exerciseCount = (): number => loadCatalog().list.length;
