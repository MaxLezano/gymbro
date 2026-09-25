import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import type { DietaryCondition, NutritionMetrics } from '../../core/types';
import { buildMealPlan, localDateKey, pantryLabels } from '../../core/services/coach/mealPlan';
import { adaptedToNote, lowCalorieNote, medicalDisclaimerFor } from '../../core/services/coach/nutritionNotes';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Card, Chip, SectionHeader } from '../../components/ui';
import { appActions, selectProfile, useAppStore } from '../../state/appStore';

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
  const profile = useAppStore(selectProfile);
  const pantry = useMemo(() => profile.pantry ?? [], [profile.pantry]);
  const pantryOn = !!profile.pantryMode && pantry.length > 0;
  // Swaps belong to one day: tomorrow's menu starts fresh.
  const swaps = profile.menuSwaps?.date === dateKey ? profile.menuSwaps.meals : undefined;
  const meals = useMemo(
    () => buildMealPlan(plan, { conditions, date: dateKey, swaps, pantry: pantryOn ? pantry : undefined }),
    [plan, conditions, dateKey, swaps, pantryOn, pantry]
  );
  const [open, setOpen] = useState<number | null>(() => currentMealIndex());
  const adapted = adaptedToNote(conditions);
  const lowCalorie = lowCalorieNote(plan.targetCalories);
  const disclaimer = medicalDisclaimerFor(conditions);

  // A few ingredients rarely reach the day's calories: say how far off and what closes the gap.
  const dayKcal = meals.reduce((sum, meal) => sum + (meal.kcal ?? 0), 0);
  const pantryShort = pantryOn && dayKcal < plan.targetCalories * 0.9;

  const setSwap = (index: number, count: number) => {
    const meals = { ...(swaps ?? {}), [index]: count };
    appActions.patchProfile({ menuSwaps: { date: dateKey, meals } });
  };

  const togglePantry = () => {
    FeedbackService.selection();
    if (pantry.length === 0) router.push('/pantry');
    else appActions.patchProfile({ pantryMode: !pantryOn });
  };

  const askCoach = (label: string, kcal?: number, protein?: number) => {
    const size = kcal ? ` de unas ${kcal} kcal y ${protein ?? 0} g de proteína` : '';
    const home = pantryOn ? ` usando lo que tengo en casa: ${pantryLabels(pantry).join(', ')}` : '';
    router.push({ pathname: '/coach', params: { prompt: `Dame otra opción de ${label.toLowerCase()}${size}${home}` } });
  };

  return (
    <Card>
      <SectionHeader title="Tu menú de hoy" />
      <View style={styles.hint}>
        <Ionicons name="refresh-outline" size={14} color={theme.colors.textMuted} />
        <AppText variant="caption" color="textMuted" style={styles.flex}>
          Cambia cada día · cantidades aproximadas
        </AppText>
      </View>
      <View style={styles.pantryRow}>
        <Chip label="Con lo que tengo" icon="basket-outline" size="sm" selected={pantryOn} onPress={togglePantry} />
        {pantry.length > 0 && (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => router.push('/pantry')}>
            <AppText variant="caption" color="primary">
              Editar ingredientes ({pantry.length})
            </AppText>
          </Pressable>
        )}
      </View>
      {pantryShort && (
        <View style={styles.note}>
          <Ionicons name="information-circle-outline" size={14} color={theme.colors.primary} />
          <AppText variant="caption" color="textSecondary" style={styles.flex}>
            Con estos ingredientes llegas a ~{dayKcal.toLocaleString('es-ES')} de {plan.targetCalories.toLocaleString('es-ES')} kcal. Suma una grasa (aceite, palta,
            frutos secos) o fruta para completar.
          </AppText>
        </View>
      )}

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
                {meal.fromPantry === false && (
                  <AppText variant="caption" color="textMuted" style={styles.missing}>
                    Con lo que tienes no alcanza para esta comida: te dejamos la sugerida.
                  </AppText>
                )}
                {meal.items.map((item, itemIndex) => (
                  <AppText key={itemIndex} variant="subhead" color="textSecondary">
                    • {item}
                  </AppText>
                ))}
                <View style={styles.actions}>
                  <Chip
                    label="Otra opción"
                    icon="shuffle"
                    size="sm"
                    onPress={() => {
                      FeedbackService.lightTap();
                      setSwap(index, (swaps?.[index] ?? 0) + 1);
                    }}
                  />
                  <Chip label="Preguntar al coach" icon="chatbubble-ellipses-outline" size="sm" onPress={() => askCoach(label, meal.kcal, meal.proteinGrams)} />
                  {(swaps?.[index] ?? 0) > 0 && <Chip label="Original" icon="arrow-undo" size="sm" onPress={() => setSwap(index, 0)} />}
                </View>
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
  pantryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  missing: {
    marginBottom: theme.spacing.xs,
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
