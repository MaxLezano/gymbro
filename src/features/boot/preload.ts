import { Image } from 'expo-image';
import { InteractionManager } from 'react-native';
import { firstCatalogPage } from '../exercises/useExerciseSearch';

const IMAGE_BUDGET_MS = 2_500;

/**
 * Warms the image cache with the first catalog screen so its thumbnails appear instantly.
 * Never blocks boot for long: offline or slow networks simply skip ahead after the budget.
 */
export function preloadImages(): Promise<void> {
  const urls = firstCatalogPage(16)
    .map((exercise) => exercise.thumbnailUrl)
    .filter((url): url is string => !!url);
  const prefetch = Image.prefetch(urls, 'memory-disk').catch(() => false);
  const budget = new Promise((resolve) => setTimeout(resolve, IMAGE_BUDGET_MS));
  return Promise.race([prefetch, budget]).then(() => undefined);
}

/** Resolves once the screens mounted behind the boot overlay have finished their first render. */
export function afterFirstRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => InteractionManager.runAfterInteractions(() => resolve()));
  });
}
