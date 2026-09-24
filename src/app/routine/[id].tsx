import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { RoutineDetailScreen } from '../../features/routines/RoutineDetailScreen';

export default function RoutineRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RoutineDetailScreen routineId={String(id)} />;
}
