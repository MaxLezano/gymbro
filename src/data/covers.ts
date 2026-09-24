import type { ImageSourcePropType } from 'react-native';
import type { CoverKey, Routine } from '../core/types';
import { getExercise } from './catalog';

/**
 * Cover art generated locally with SDXL (DreamShaper XL Turbo) for GymBro.
 * 800x450 progressive JPEG, ~40 KB each.
 */
export const COVERS: Record<CoverKey, ImageSourcePropType> = {
  push: require('../../assets/images/covers/push.jpg'),
  pull: require('../../assets/images/covers/pull.jpg'),
  legs: require('../../assets/images/covers/legs.jpg'),
  full_body: require('../../assets/images/covers/full_body.jpg'),
  upper: require('../../assets/images/covers/upper.jpg'),
  arms: require('../../assets/images/covers/arms.jpg'),
  core: require('../../assets/images/covers/core.jpg'),
  glutes: require('../../assets/images/covers/glutes.jpg'),
  home: require('../../assets/images/covers/home.jpg'),
  hiit: require('../../assets/images/covers/hiit.jpg'),
  cardio: require('../../assets/images/covers/cardio.jpg'),
};

export const WELCOME_IMAGES: ImageSourcePropType[] = [
  require('../../assets/images/welcome/1.jpg'),
  require('../../assets/images/welcome/2.jpg'),
  require('../../assets/images/welcome/3.jpg'),
];

/** Explicit cover, or inferred from the body parts the routine trains. */
export function coverForRoutine(routine: Pick<Routine, 'cover' | 'exercises' | 'targetLocation'>): ImageSourcePropType {
  if (routine.cover) return COVERS[routine.cover];

  const counts = new Map<string, number>();
  for (const item of routine.exercises) {
    const bodyPart = getExercise(item.exerciseId)?.bodyPart;
    if (bodyPart) counts.set(bodyPart, (counts.get(bodyPart) ?? 0) + 1);
  }
  const total = routine.exercises.length || 1;
  const share = (...parts: string[]) => parts.reduce((sum, part) => sum + (counts.get(part) ?? 0), 0) / total;

  if (share('cardio') >= 0.5) return COVERS.hiit;
  if (share('upper legs', 'lower legs') >= 0.6) return COVERS.legs;
  if (share('waist') >= 0.5) return COVERS.core;
  if (share('upper arms', 'lower arms') >= 0.5) return COVERS.arms;
  if (share('chest', 'shoulders') >= 0.5) return COVERS.push;
  if (share('back') >= 0.5) return COVERS.pull;
  if (routine.targetLocation === 'home') return COVERS.home;
  return COVERS.full_body;
}
