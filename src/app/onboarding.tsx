import React from 'react';
import { Redirect } from 'expo-router';
import { OnboardingScreen } from '../features/profile/OnboardingScreen';
import { selectAccount, useAppStore } from '../state/appStore';

export default function OnboardingRoute() {
  const account = useAppStore(selectAccount);
  if (!account) return <Redirect href="/login" />;
  return <OnboardingScreen />;
}
