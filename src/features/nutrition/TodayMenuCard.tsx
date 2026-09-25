import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import type { DietaryCondition, NutritionMetrics } from '../../core/types';
import { buildMealPlan, localDateKey } from '../../core/services/coach/mealPlan';
import { adaptedToNote, lowCalorieNote, medicalDisclaimerFor } from '../../core/services/coach/nutritionNotes';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Card, SectionHeader } from '../../components/ui';

/** Meal to open first: the next one by time of day (breakfast, lunch, snack, dinner). */
function currentMealIndex(date = new Date()): number {
  const hour = date.getHours();
  if (hour < 11) return 0;
  if (hour < 16) return 1;
  if (hour < 19) return 2;
  return 3;
}

/** "Desayuno · Avena con yogur" -> { meal: "Desayuno", dish: "Avena con yogur" } */
function splitName(name: string): { meal: string; dish?: string } {
  const [meal, ...rest] = name.split(' · ');
  return { meal, dish: rest.length ? rest.join(' · ') : undefined };
}

export function TodayMenuCard({ plan, conditions }: { plan: NutritionMetrics; conditions: DietaryCondition[] }) {
  // The menu rotates at local midnight: the date key keeps it fresh across days.
  const dateKey = localDateKey();
  const meals = useMemo(() => buildMealPlan(plan, { conditions, date: dateKey }), [plan, conditions, dateKey]);
  const [open, setOpen] = useState<number | null>(() => currentMealIndex());
  const adapted = adaptedToNote(conditions);
  const lowCalorie = lowCalorieNote(plan.targetCalories);
  const disclaimer = medicalDisclaimerFor(conditions);

  return (
    <Card>
      <SectionHeader title="Tu menú de hoy" />
      <View style={styles.hint}>
        <Ionicons name="refresh-outline" size={14} color={theme.colors.textMuted} />
        <AppText variant="caption" color="textMuted" style={styles.flex}>
          Cambia cada día · cantidades aproximadas
        </AppText>
      </View>

      {meals.map((meal, index) => {
        const expanded = open === index;
        const { meal: label, dish } = splitName(meal.name);
        const summary = [meal.kcal ? `${meal.kcal} kcal` : null, meal.proteinGrams ? `${meal.proteinGrams} g prot.` : null].filter(Boolean).join(' · ');
        return (
          <View key={`${meal.name}_${index}`} style={[styles.meal, index > 0 && styles.mealBorder]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${label}${dish ? `, ${dish}` : ''}. ${summary}`}
              onPress={() => {
                FeedbackService.selection();
                setOpen(expanded ? null : index);
              }}
              style={({ pressed }) => [styles.mealHeader, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <AppText variant="callout" style={styles.bold} numberOfLines={1}>
                  {label}
                </AppText>
                {dish && (
                  <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                    {dish}
                  </AppText>
                )}
              </View>
              <AppText variant="caption" color="textMuted" style={styles.tabular}>
                {summary}
              </AppText>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={theme.colors.textMuted} />
            </Pressable>
            {expanded && (
              <View style={styles.items}>
                {meal.items.map((item, itemIndex) => (
                  <AppText key={itemIndex} variant="subhead" color="textSecondary">
                    • {item}
                  </AppText>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {(adapted || lowCalorie || disclaimer) && (
        <View style={styles.notes}>
          {adapted && (
            <View style={styles.note}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
              <AppText variant="caption" color="textSecondary" style={styles.flex}>
                {adapted}
              </AppText>
            </View>
          )}
          {lowCalorie && (
            <View style={styles.note}>
              <Ionicons name="warning-outline" size={14} color={theme.colors.primary} />
              <AppText variant="caption" color="textSecondary" style={styles.flex}>
                <AppText variant="caption" style={styles.bold}>
                  Atención:{' '}
                </AppText>
                {lowCalorie}
              </AppText>
            </View>
          )}
          {disclaimer && (
            <AppText variant="caption" color="textMuted">
              {disclaimer}
            </AppText>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  meal: {
    paddingVertical: 2,
  },
  mealBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingVertical: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  items: {
    gap: 2,
    paddingBottom: theme.spacing.md,
  },
  notes: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
