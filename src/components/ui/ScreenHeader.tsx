import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../core/theme';
import { AppText } from './AppText';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  eyebrow?: string;
}

/** Large, left-aligned title used at the top of every tab. */
export function ScreenHeader({ title, subtitle, right, eyebrow }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.texts}>
        {eyebrow && (
          <AppText variant="overline" color="primary" style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        )}
        <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle && (
          <AppText variant="subhead" color="textMuted" numberOfLines={2} style={styles.subtitle}>
            {subtitle}
          </AppText>
        )}
      </View>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  texts: {
    flex: 1,
  },
  eyebrow: {
    marginBottom: 2,
  },
  subtitle: {
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingBottom: 2,
  },
});
