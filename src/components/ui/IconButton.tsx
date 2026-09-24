import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: 'plain' | 'filled' | 'tonal' | 'primary';
  size?: number;
  iconSize?: number;
  color?: string;
  disabled?: boolean;
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'plain',
  size = 40,
  iconSize,
  color,
  disabled,
  badge,
  style,
}: IconButtonProps) {
  const background = {
    plain: 'transparent',
    filled: theme.colors.surfaceAlt,
    tonal: theme.colors.primarySoft,
    primary: theme.colors.primary,
  }[variant];
  const foreground =
    color ??
    { plain: theme.colors.textSecondary, filled: theme.colors.text, tonal: theme.colors.primary, primary: theme.colors.onPrimary }[
      variant
    ];
  // Keep a 44pt hit area even for visually smaller buttons.
  const slop = Math.max(0, (theme.hitTarget - size) / 2);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={slop}
      onPress={() => {
        FeedbackService.lightTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: pressed
            ? variant === 'primary'
              ? theme.colors.primaryPressed
              : theme.colors.surfacePressed
            : background,
          borderWidth: variant === 'filled' ? StyleSheet.hairlineWidth * 2 : 0,
          borderColor: theme.colors.border,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize ?? Math.round(size * 0.5)} color={foreground} />
      {badge && <View style={styles.badge} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  badge: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
});
