import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExercisePickerScreen } from '../features/exercises/ExercisePickerScreen';

export default function ExercisePickerRoute() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return <ExercisePickerScreen mode={mode === 'builder' ? 'builder' : 'workout'} />;
}
