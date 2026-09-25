import { Image } from 'expo-image';
import { InteractionManager } from 'react-native';
import { appActions } from '../../state/appStore';
import { firstCatalogPage } from '../exercises/useExerciseSearch';
import { warmMediaCache } from './mediaCache';

const IMAGE_BUDGET_MS = 2_500;

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Warms the image cache with the first catalog screen so its thumbnails appear instantly.
 * Never blocks boot for long: offline or slow networks simply skip ahead after the budget.
 */
function preloadImages(): Promise<void> {
  const urls = firstCatalogPage(16)
    .map((exercise) => exercise.thumbnailUrl)
    .filter((url): url is string => !!url);
  const prefetch = Image.prefetch(urls, 'memory-disk').catch(() => false);
  const budget = new Promise((resolve) => setTimeout(resolve, IMAGE_BUDGET_MS));
  return Promise.race([prefetch, budget]).then(() => undefined);
}

/** Resolves once the screens mounted behind the boot overlay have finished their first render. */
function afterFirstRender(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => InteractionManager.runAfterInteractions(() => resolve()));
  });
}

/**
 * Everything the app needs before its first screen, in steps the boot bar can report.
 * Heavy synchronous work (the catalog) runs only after the bar is on screen.
 */
export async function runBoot(onProgress: (progress: number) => void): Promise<void> {
  await nextFrame();
  const data = appActions.hydrate().catch(() => undefined);

  await nextFrame();
  // Builds the 1.324-exercise catalog and its browsing order: the heaviest step.
  firstCatalogPage(1);
  onProgress(0.45);

  await nextFrame();
  const images = preloadImages();
  await data;
  onProgress(0.65);
  await images;
  onProgress(0.85);

  // Account data is in: the right first screen (login, onboarding or tabs) mounts behind the bar.
  await afterFirstRender();
  onProgress(1);

  // After boot, never blocking it: offline copies of the images the athlete will need.
  warmMediaCache().catch(() => undefined);
}
