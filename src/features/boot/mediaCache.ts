import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as Network from 'expo-network';
import { getExercise, getExercises } from '../../data/catalog';
import { programRoutines } from '../../core/utils/program';
import { recentExerciseIds } from '../../core/utils/exerciseLists';
import { getAppState } from '../../state/appStore';

/** Bump when the media source changes, so the new images are fetched again. */
const THUMBNAILS_DONE_KEY = 'mediaCache:thumbnails:v1';
const BATCH = 60;

/** Exercises this athlete is likely to open offline: their program, favorites and recent lifts. */
export function personalExerciseIds(): string[] {
  const { customRoutines, profile, history } = getAppState();
  const program = programRoutines(customRoutines).flatMap((routine) => routine.exercises.map((item) => item.exerciseId));
  return [...new Set([...program, ...(profile.favoriteExerciseIds ?? []), ...recentExerciseIds(history)])];
}

const prefetch = (urls: (string | null | undefined)[]) =>
  Image.prefetch(urls.filter((url): url is string => !!url), 'disk').catch(() => false);

/**
 * Background download so the gym (often without signal) still shows the exercises:
 * - always: animation + thumbnail of the athlete's own exercises (a few MB at most);
 * - on Wi-Fi only, once: every catalog thumbnail (~8 MB), in small batches.
 * Already cached files are skipped by the image cache, so repeating this is cheap.
 */
export async function warmMediaCache(): Promise<void> {
  const network = await Network.getNetworkStateAsync().catch(() => null);
  if (!network?.isConnected) return;

  const personal = personalExerciseIds()
    .map((id) => getExercise(id))
    .filter((exercise) => !!exercise);
  await prefetch(personal.flatMap((exercise) => [exercise.thumbnailUrl, exercise.gifUrl]));

  if (network.type !== Network.NetworkStateType.WIFI) return;
  if ((await AsyncStorage.getItem(THUMBNAILS_DONE_KEY).catch(() => null)) === 'done') return;
  const thumbnails = getExercises().map((exercise) => exercise.thumbnailUrl);
  for (let start = 0; start < thumbnails.length; start += BATCH) {
    await prefetch(thumbnails.slice(start, start + BATCH));
  }
  await AsyncStorage.setItem(THUMBNAILS_DONE_KEY, 'done').catch(() => undefined);
}
