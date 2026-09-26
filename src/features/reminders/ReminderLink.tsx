import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { AppText } from '../../components/ui';

/** Compact row that opens the Notifications screen: the setting lives in one place, not on every card. */
export function ReminderLink({ label, active, style }: { label: string; active: boolean; style?: object }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Configurar notificaciones`}
      onPress={() => router.push('/reminders')}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
      hitSlop={6}
    >
      <Ionicons name={active ? 'notifications' : 'notifications-outline'} size={16} color={active ? theme.colors.primary : theme.colors.textMuted} />
      <AppText variant="caption" color={active ? 'textSecondary' : 'textMuted'} style={styles.label} numberOfLines={1}>
        {label}
      </AppText>
      <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
  },
  label: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
