import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExerciseDetailScreen } from '../../features/exercises/ExerciseDetailScreen';

export default function ExerciseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ExerciseDetailScreen exerciseId={String(id)} />;
}
