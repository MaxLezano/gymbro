import { useDeferredValue, useMemo } from 'react';
import { EXERCISES, getExercise, normalizeText, type CatalogExercise } from '../../data/catalog';
import { fitsHomeEquipment } from '../../core/utils/equipment';
import type { HomeEquipment } from '../../core/types';

export const BODY_PART_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'chest', label: 'Pecho' },
  { id: 'back', label: 'Espalda' },
  { id: 'upper legs', label: 'Piernas' },
  { id: 'shoulders', label: 'Hombros' },
  { id: 'upper arms', label: 'Brazos' },
  { id: 'waist', label: 'Abdomen' },
  { id: 'lower legs', label: 'Gemelos' },
  { id: 'lower arms', label: 'Antebrazos' },
  { id: 'cardio', label: 'Cardio' },
];

/** Everyday gym equipment ranks above bands, balls and odd variations. */
const EQUIPMENT_RANK: Record<string, number> = {
  barbell: 0,
  dumbbell: 0,
  'body weight': 1,
  'leverage machine': 1,
  cable: 1,
  'smith machine': 2,
  'ez barbell': 2,
  kettlebell: 2,
};

/** Browsing order: alphabetical by the translated name (the dataset is sorted by the English one). */
const ALPHABETICAL = [...EXERCISES].sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));

const byRelevance = (a: CatalogExercise, b: CatalogExercise) =>
  (EQUIPMENT_RANK[a.equipment] ?? 3) - (EQUIPMENT_RANK[b.equipment] ?? 3) || a.name.length - b.name.length;

/** Pseudo body-part filters that show the athlete's own lists instead of a muscle group. */
export const FAVORITES_FILTER = 'favorites';
export const RECENT_FILTER = 'recent';

interface SearchOptions {
  query: string;
  bodyPart: string;
  onlyMyEquipment: boolean;
  homeEquipment: HomeEquipment[];
  /** Restricts the results to these exercises, in this order (favorites, recents). Ignores body part and equipment. */
  ids?: readonly string[];
}

/**
 * Filters the full catalog. The query is deferred so typing stays responsive
 * while the (cheap, pre-normalized) filter runs at lower priority.
 */
export function useExerciseSearch({ query, bodyPart, onlyMyEquipment, homeEquipment, ids }: SearchOptions): CatalogExercise[] {
  const deferredQuery = useDeferredValue(query);

  return useMemo(() => {
    const terms = normalizeText(deferredQuery.trim()).split(/\s+/).filter(Boolean);
    if (ids) {
      // The athlete's own list keeps its order (newest first) and only narrows by the search.
      return ids
        .map((id) => getExercise(id))
        .filter((exercise): exercise is CatalogExercise => !!exercise && terms.every((term) => exercise.searchText.includes(term)));
    }
    const matches = ALPHABETICAL.filter((exercise) => {
      if (bodyPart !== 'all' && exercise.bodyPart !== bodyPart) return false;
      if (onlyMyEquipment && !fitsHomeEquipment(exercise, homeEquipment)) return false;
      return terms.every((term) => exercise.searchText.includes(term));
    });
    // Browsing stays alphabetical; a search puts the classic version of the lift first.
    return terms.length === 0 ? matches : [...matches].sort(byRelevance);
  }, [deferredQuery, bodyPart, onlyMyEquipment, homeEquipment, ids]);
}
