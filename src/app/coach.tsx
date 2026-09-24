import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { CoachScreen } from '../features/coach/CoachScreen';

export default function CoachRoute() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  return <CoachScreen initialPrompt={prompt} />;
}
