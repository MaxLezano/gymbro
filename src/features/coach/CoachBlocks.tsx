import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import type { NutritionMetrics } from '../../core/types';
import type { CoachBlock, MealPlanItem } from '../../core/services/coach';
import { getExercise } from '../../data/catalog';
import { labelTarget } from '../../core/i18n/labels';
import { appActions, registerDraftRoutine, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, StatTile } from '../../components/ui';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { MacroSummary } from '../nutrition/MacroSummary';
import { startRoutineWorkout } from '../workout/startWorkout';

type RoutineBlockData = Extract<CoachBlock, { type: 'routine' }>;

function BlockShell({ icon, title, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.shell}>
      <View style={styles.shellHeader}>
        <Ionicons name={icon} size={16} color={theme.colors.primary} />
        <AppText variant="subhead" style={styles.shellTitle} numberOfLines={2}>
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

function RoutineBlock({ block }: { block: RoutineBlockData }) {
  const { routine } = block;
  const isSaved = useAppStore((state) => state.customRoutines.some((item) => item.id === routine.id));
  const [expanded, setExpanded] = useState(routine.exercises.length <= 5);
  const visible = expanded ? routine.exercises : routine.exercises.slice(0, 4);

  return (
    <BlockShell icon="barbell" title={routine.title}>
      <AppText variant="caption" color="textMuted" style={styles.meta}>
        {routine.exercises.length} ejercicios · ~{routine.estimatedMinutes} min
      </AppText>
      <View style={styles.routineList}>
        {visible.map((item, index) => {
          const exercise = getExercise(item.exerciseId);
          return (
            <Pressable
              key={`${item.exerciseId}_${index}`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.exerciseId } })}
              style={({ pressed }) => [styles.routineRow, pressed && styles.pressed]}
            >
              <ExerciseThumb uri={exercise?.thumbnailUrl} size={40} />
              <View style={styles.flex}>
                <AppText variant="subhead" style={styles.bold} numberOfLines={1}>
                  {exercise?.displayName ?? item.exerciseName}
                </AppText>
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {item.note ?? (exercise ? labelTarget(exercise.target) : '')}
                </AppText>
              </View>
              <AppText variant="subhead" color="primary" style={styles.bold}>
                {item.targetSets}×{item.targetReps}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {!expanded && (
        <Pressable accessibilityRole="button" onPress={() => setExpanded(true)} hitSlop={8} style={styles.more}>
          <AppText variant="caption" color="primary" style={styles.bold}>
            Ver {routine.exercises.length - visible.length} más
          </AppText>
        </Pressable>
      )}
      <View style={styles.actions}>
        <Button
          label={isSaved ? 'Guardada' : 'Guardar'}
          icon={isSaved ? 'checkmark' : 'bookmark-outline'}
          variant="secondary"
          size="md"
          disabled={isSaved}
          onPress={() => {
            FeedbackService.success();
            appActions.upsertRoutine(routine);
          }}
        />
        <Button
          label="Empezar"
          icon="play"
          size="md"
          style={styles.flex}
          onPress={() => {
            registerDraftRoutine(routine);
            startRoutineWorkout(routine);
          }}
        />
      </View>
    </BlockShell>
  );
}

function ExercisesBlock({ title, exerciseIds }: { title?: string; exerciseIds: string[] }) {
  return (
    <View style={styles.carouselWrap}>
      {title && (
        <AppText variant="subhead" style={[styles.bold, styles.carouselTitle]}>
          {title}
        </AppText>
      )}
      <FlatList
        horizontal
        data={exerciseIds}
        keyExtractor={(id) => id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
        renderItem={({ item }) => {
          const exercise = getExercise(item);
          if (!exercise) return null;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver ${exercise.displayName}`}
              onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
              style={({ pressed }) => [styles.exerciseCard, pressed && styles.pressed]}
            >
              <ExerciseThumb uri={exercise.thumbnailUrl} size={128} radius={theme.radius.md} />
              <AppText variant="subhead" style={styles.bold} numberOfLines={2}>
                {exercise.displayName}
              </AppText>
              <AppText variant="caption" color="primary" numberOfLines={1}>
                {labelTarget(exercise.target)}
              </AppText>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

function TipsBlock({ title, items }: { title?: string; items: string[] }) {
  return (
    <BlockShell icon="checkmark-done" title={title ?? 'Claves'}>
      <View style={styles.tips}>
        {items.map((item, index) => (
          <View key={index} style={styles.tip}>
            <View style={styles.tipDot}>
              <AppText variant="caption" color="primary" style={styles.bold}>
                {index + 1}
              </AppText>
            </View>
            <AppText variant="subhead" color="textSecondary" style={styles.flex}>
              {item}
            </AppText>
          </View>
        ))}
      </View>
    </BlockShell>
  );
}

function MealsBlock({ title, meals }: { title?: string; meals: MealPlanItem[] }) {
  return (
    <BlockShell icon="restaurant" title={title ?? 'Plan de comidas'}>
      <View style={styles.meals}>
        {meals.map((meal, index) => (
          <View key={`${meal.name}_${index}`} style={[styles.meal, index > 0 && styles.mealBorder]}>
            <View style={styles.mealHeader}>
              <AppText variant="subhead" style={[styles.bold, styles.flex]} numberOfLines={2}>
                {meal.name}
              </AppText>
              <AppText variant="caption" color="textMuted" style={styles.noShrink}>
                {[meal.kcal ? `${meal.kcal} kcal` : null, meal.proteinGrams ? `${meal.proteinGrams} g prot.` : null].filter(Boolean).join(' · ')}
              </AppText>
            </View>
            {meal.items.map((item, itemIndex) => (
              <AppText key={itemIndex} variant="subhead" color="textSecondary">
                • {item}
              </AppText>
            ))}
          </View>
        ))}
      </View>
    </BlockShell>
  );
}

export function CoachBlockView({ block, plan }: { block: CoachBlock; plan: NutritionMetrics }) {
  switch (block.type) {
    case 'routine':
      return <RoutineBlock block={block} />;
    case 'exercises':
      return <ExercisesBlock title={block.title} exerciseIds={block.exerciseIds} />;
    case 'tips':
      return <TipsBlock title={block.title} items={block.items} />;
    case 'meals':
      return <MealsBlock title={block.title} meals={block.meals} />;
    case 'macros':
      return (
        <BlockShell icon="nutrition" title={`Tu meta: ${plan.targetCalories.toLocaleString('es-ES')} kcal/día`}>
          <MacroSummary plan={plan} compact />
        </BlockShell>
      );
    case 'body':
      return (
        <BlockShell icon="body" title="Tu composición corporal">
          <View style={styles.row}>
            <StatTile label="Grasa" value={plan.bodyFatPercent} unit="%" style={styles.tile} />
            <StatTile label="Magra" value={plan.leanMassKg} unit="kg" style={styles.tile} />
            <StatTile label="FFMI" value={plan.ffmi} style={styles.tile} />
          </View>
          <AppText variant="caption" color="textMuted" style={styles.meta}>
            Peso atlético meta: {plan.idealWeightKg} kg
          </AppText>
        </BlockShell>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  shellHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shellTitle: {
    flex: 1,
    fontWeight: '700',
    color: theme.colors.text,
  },
  meta: {
    marginTop: 4,
  },
  routineList: {
    marginTop: theme.spacing.md,
    gap: 2,
  },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  more: {
    paddingVertical: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  carouselWrap: {
    marginHorizontal: -theme.spacing.md,
  },
  carouselTitle: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  carousel: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  exerciseCard: {
    width: 144,
    padding: theme.spacing.sm,
    gap: 4,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  tips: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  tip: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tipDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  meals: {
    marginTop: theme.spacing.sm,
  },
  meal: {
    paddingVertical: theme.spacing.sm,
    gap: 2,
  },
  mealBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  tile: {
    backgroundColor: theme.colors.surface,
  },
  bold: {
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
  noShrink: {
    flexShrink: 0,
  },
});
