import React from 'react';
import { Text, TextProps } from 'react-native';
import { theme, ThemeColor } from '../../core/theme';

export type TextVariant = keyof typeof theme.typography;

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: ThemeColor;
  align?: 'left' | 'center' | 'right';
}

export function AppText({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[theme.typography[variant], { color: theme.colors[color] }, align && { textAlign: align }, style]}
    />
  );
}
