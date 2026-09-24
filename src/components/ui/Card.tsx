import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  onLongPress?: () => void;
  tone?: 'default' | 'alt' | 'accent';
  padding?: keyof typeof theme.spacing | 0;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const TONES = {
  default: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
  alt: { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
  accent: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primaryBorder },
} as const;

export function Card({
  onPress,
  onLongPress,
  tone = 'default',
  padding = 'lg',
  style,
  children,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const base = [
    styles.card,
    TONES[tone],
    { padding: padding === 0 ? 0 : theme.spacing[padding] },
    style,
  ];

  if (!onPress && !onLongPress) {
    return (
      <View {...rest} style={base}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={
        onPress &&
        (() => {
          FeedbackService.selection();
          onPress();
        })
      }
      onLongPress={onLongPress}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
