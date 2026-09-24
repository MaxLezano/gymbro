import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../core/theme';
import type { NutritionMetrics } from '../../core/types';
import { AppText } from '../../components/ui';

const MACROS = [
  { key: 'protein', label: 'Proteína', color: theme.colors.protein, kcalPerGram: 4 },
  { key: 'carbs', label: 'Carbos', color: theme.colors.carbs, kcalPerGram: 4 },
  { key: 'fat', label: 'Grasas', color: theme.colors.fat, kcalPerGram: 9 },
] as const;

export function macroGrams(plan: NutritionMetrics) {
  return { protein: plan.proteinGrams, carbs: plan.carbGrams, fat: plan.fatGrams };
}

/** Stacked calorie bar + three macro columns. Shared by Nutrition and the Coach. */
export function MacroSummary({ plan, compact = false }: { plan: NutritionMetrics; compact?: boolean }) {
  const grams = macroGrams(plan);
  const kcal = MACROS.map((macro) => grams[macro.key] * macro.kcalPerGram);
  const totalKcal = Math.max(1, kcal.reduce((sum, value) => sum + value, 0));

  return (
    <View style={styles.container}>
      <View style={[styles.bar, compact && styles.barCompact]} accessibilityElementsHidden>
        {MACROS.map((macro, index) => (
          <View key={macro.key} style={{ flex: Math.max(kcal[index], 1), backgroundColor: macro.color }} />
        ))}
      </View>
      <View style={styles.columns}>
        {MACROS.map((macro, index) => (
          <View
            key={macro.key}
            style={styles.column}
            accessible
            accessibilityLabel={`${macro.label}: ${grams[macro.key]} gramos, ${Math.round((kcal[index] / totalKcal) * 100)} por ciento`}
          >
            <View style={styles.labelRow}>
              <View style={[styles.dot, { backgroundColor: macro.color }]} />
              <AppText variant="caption" color="textMuted">
                {macro.label}
              </AppText>
            </View>
            <AppText variant={compact ? 'headline' : 'title'} style={styles.value}>
              {grams[macro.key]}
              <AppText variant="subhead" color="textMuted">
                {' '}g
              </AppText>
            </AppText>
            {!compact && (
              <AppText variant="caption" color="textSecondary">
                {Math.round((kcal[index] / totalKcal) * 100)}% · {kcal[index]} kcal
              </AppText>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    gap: 2,
  },
  barCompact: {
    height: 8,
  },
  columns: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  column: {
    flex: 1,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  value: {
    fontVariant: ['tabular-nums'],
  },
});
