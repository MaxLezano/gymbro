import React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';
import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

const VARIANTS: Record<Variant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: theme.colors.primary, pressed: theme.colors.primaryPressed, fg: theme.colors.onPrimary },
  secondary: {
    bg: theme.colors.surfaceAlt,
    pressed: theme.colors.surfacePressed,
    fg: theme.colors.text,
    border: theme.colors.borderStrong,
  },
  tonal: {
    bg: theme.colors.primarySoft,
    pressed: 'rgba(255, 159, 10, 0.2)',
    fg: theme.colors.primary,
    border: theme.colors.primaryBorder,
  },
  ghost: { bg: 'transparent', pressed: theme.colors.surfaceAlt, fg: theme.colors.textSecondary },
  danger: {
    bg: theme.colors.dangerSoft,
    pressed: 'rgba(255, 69, 58, 0.2)',
    fg: theme.colors.danger,
    border: 'rgba(255, 69, 58, 0.35)',
  },
};

const SIZES: Record<Size, { height: number; paddingX: number; icon: number; text: 'subhead' | 'bodyStrong' | 'callout' }> = {
  sm: { height: 36, paddingX: 14, icon: 16, text: 'subhead' },
  md: { height: 48, paddingX: 18, icon: 18, text: 'callout' },
  lg: { height: 54, paddingX: 22, icon: 20, text: 'bodyStrong' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading,
  disabled,
  fullWidth,
  haptic = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const palette = VARIANTS[variant];
  const dims = SIZES[size];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 6 : 0}
      onPress={() => {
        if (haptic) FeedbackService.lightTap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          height: dims.height,
          paddingHorizontal: dims.paddingX,
          backgroundColor: pressed ? palette.pressed : palette.bg,
          borderColor: palette.border ?? 'transparent',
          borderWidth: palette.border ? StyleSheet.hairlineWidth * 2 : 0,
          borderRadius: size === 'sm' ? theme.radius.pill : theme.radius.md,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={dims.icon} color={palette.fg} />}
          <AppText variant={dims.text} style={[styles.label, { color: palette.fg }]} numberOfLines={1}>
            {label}
          </AppText>
          {iconRight && <Ionicons name={iconRight} size={dims.icon} color={palette.fg} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  label: {
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
});
