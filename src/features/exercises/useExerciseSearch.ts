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
    return EXERCISES.filter((exercise) => {
      if (bodyPart !== 'all' && exercise.bodyPart !== bodyPart) return false;
      if (onlyMyEquipment && !fitsHomeEquipment(exercise, homeEquipment)) return false;
      return terms.every((term) => exercise.searchText.includes(term));
    });
  }, [deferredQuery, bodyPart, onlyMyEquipment, homeEquipment]);
}
