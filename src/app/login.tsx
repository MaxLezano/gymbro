import React from 'react';
import { Redirect } from 'expo-router';
import { LoginScreen } from '../features/auth/LoginScreen';
import { selectAccount, selectProfile, useAppStore } from '../state/appStore';

export default function LoginRoute() {
  const account = useAppStore(selectAccount);
  const profile = useAppStore(selectProfile);
  if (account) return <Redirect href={profile.hasCompletedOnboarding ? '/' : '/onboarding'} />;
  return <LoginScreen />;
}
