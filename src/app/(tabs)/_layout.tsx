import React from 'react';
import { Redirect, Tabs } from 'expo-router';
import { TabBar } from '../../components/navigation/TabBar';
import { selectAccount, selectProfile, useAppStore } from '../../state/appStore';

export default function TabsLayout() {
  const account = useAppStore(selectAccount);
  const profile = useAppStore(selectProfile);

  if (!account) return <Redirect href="/login" />;
  if (!profile.hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs screenOptions={{ headerShown: false, lazy: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="train" options={{ title: 'Entrenar' }} />
      <Tabs.Screen name="exercises" options={{ title: 'Ejercicios' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progreso' }} />
      <Tabs.Screen name="nutrition" options={{ title: 'Nutrición' }} />
    </Tabs>
  );
}
