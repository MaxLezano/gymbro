import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';
import { AppText } from './AppText';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
  size?: 'sm' | 'md';
}

export function Chip({ label, selected = false, onPress, icon, count, size = 'md' }: ChipProps) {
  const fg = selected ? theme.colors.onPrimary : theme.colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={count !== undefined ? `${label}, ${count}` : label}
      disabled={!onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={() => {
        FeedbackService.selection();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' && styles.small,
        selected ? styles.selected : styles.idle,
        pressed && !selected && styles.pressed,
      ]}
    >
      {icon && <Ionicons name={icon} size={size === 'sm' ? 13 : 15} color={selected ? fg : theme.colors.primary} />}
      <AppText variant={size === 'sm' ? 'caption' : 'subhead'} style={[styles.label, { color: fg }]} numberOfLines={1}>
        {label}
      </AppText>
      {count !== undefined && (
        <AppText variant="caption" style={[styles.count, { color: selected ? fg : theme.colors.textMuted }]}>
          {count}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  small: {
    height: 30,
    paddingHorizontal: 11,
  },
  idle: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
  },
  selected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  label: {
    fontWeight: '600',
  },
  count: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
