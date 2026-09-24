import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ExerciseDetailScreen } from '../../features/exercises/ExerciseDetailScreen';

export default function ExerciseRoute() {
  // sets/reps/rest arrive when opened from a routine or a workout (the prescription).
  const { id, sets, reps, rest } = useLocalSearchParams<{ id: string; sets?: string; reps?: string; rest?: string }>();
  const prescription = sets && reps ? { sets: Number(sets), reps: String(reps), restSeconds: rest ? Number(rest) : undefined } : undefined;
  return <ExerciseDetailScreen exerciseId={String(id)} prescription={prescription} />;
}
