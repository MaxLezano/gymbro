import { useDeferredValue, useMemo } from 'react';
import { EXERCISES, normalizeText, type CatalogExercise } from '../../data/catalog';
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

const byRelevance = (a: CatalogExercise, b: CatalogExercise) =>
  (EQUIPMENT_RANK[a.equipment] ?? 3) - (EQUIPMENT_RANK[b.equipment] ?? 3) || a.name.length - b.name.length;

interface SearchOptions {
  query: string;
  bodyPart: string;
  onlyMyEquipment: boolean;
  homeEquipment: HomeEquipment[];
}

/**
 * Filters the full catalog. The query is deferred so typing stays responsive
 * while the (cheap, pre-normalized) filter runs at lower priority.
 */
export function useExerciseSearch({ query, bodyPart, onlyMyEquipment, homeEquipment }: SearchOptions): CatalogExercise[] {
  const deferredQuery = useDeferredValue(query);

  return useMemo(() => {
    const terms = normalizeText(deferredQuery.trim()).split(/\s+/).filter(Boolean);
    const matches = EXERCISES.filter((exercise) => {
      if (bodyPart !== 'all' && exercise.bodyPart !== bodyPart) return false;
      if (onlyMyEquipment && !fitsHomeEquipment(exercise, homeEquipment)) return false;
      return terms.every((term) => exercise.searchText.includes(term));
    });
    // Browsing stays alphabetical; a search puts the classic version of the lift first.
    return terms.length === 0 ? matches : [...matches].sort(byRelevance);
  }, [deferredQuery, bodyPart, onlyMyEquipment, homeEquipment]);
}
