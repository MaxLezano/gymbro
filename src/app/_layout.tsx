import React, { useEffect } from 'react';
import { View } from 'react-native';
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { theme } from '../core/theme';
import { appActions, selectHydrated, useAppStore } from '../state/appStore';
import { WorkoutBackgroundServices } from '../features/workout/WorkoutBackgroundServices';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.background,
    card: theme.colors.surface,
    text: theme.colors.text,
    border: theme.colors.border,
    notification: theme.colors.primary,
  },
};

export default function RootLayout() {
  const hydrated = useAppStore(selectHydrated);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.colors.background).catch(() => undefined);
    appActions.hydrate().finally(() => SplashScreen.hideAsync().catch(() => undefined));
  }, []);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      {hydrated && <WorkoutBackgroundServices />}
      {hydrated ? (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="coach" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="exercise-picker" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="exercise/[id]" />
          <Stack.Screen name="routine/[id]" />
          <Stack.Screen name="routine-builder" />
          <Stack.Screen name="program" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        </Stack>
      ) : (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }} />
      )}
    </ThemeProvider>
  );
}
