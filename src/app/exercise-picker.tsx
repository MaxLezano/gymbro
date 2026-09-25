import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExercisePickerScreen } from '../features/exercises/ExercisePickerScreen';

export default function ExercisePickerRoute() {
  const { mode, replace, bodyPart } = useLocalSearchParams<{ mode?: string; replace?: string; bodyPart?: string }>();
  const replaceIndex = replace !== undefined && /^\d+$/.test(replace) ? Number(replace) : undefined;
  return <ExercisePickerScreen mode={mode === 'builder' ? 'builder' : 'workout'} replaceIndex={replaceIndex} initialBodyPart={bodyPart} />;
}
