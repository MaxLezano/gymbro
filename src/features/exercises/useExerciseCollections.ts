import { useMemo } from 'react';
import { recentExerciseIds } from '../../core/utils/exerciseLists';
import { selectFavoriteExerciseIds, selectHistory, useAppStore } from '../../state/appStore';
import { FAVORITES_FILTER, RECENT_FILTER } from './useExerciseSearch';

/**
 * The athlete's own exercise lists (favorites and recently trained) and how the
 * current filter maps onto them. A list that became empty falls back to "all".
 */
export function useExerciseCollections(bodyPart: string) {
  const favorites = useAppStore(selectFavoriteExerciseIds);
  const history = useAppStore(selectHistory);
  const recents = useMemo(() => recentExerciseIds(history), [history]);

  const ids = bodyPart === FAVORITES_FILTER ? favorites : bodyPart === RECENT_FILTER ? recents : undefined;
  const emptyList = ids !== undefined && ids.length === 0;
  return {
    favorites,
    recents,
    ids: emptyList ? undefined : ids,
    effectiveBodyPart: emptyList ? 'all' : bodyPart,
  };
}
