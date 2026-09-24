import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { RoutineBuilderScreen } from '../features/routines/RoutineBuilderScreen';

export default function RoutineBuilderRoute() {
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  return <RoutineBuilderScreen editId={id} fromId={from} />;
}
