import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { labelEquipment, labelTarget } from '../../core/i18n/labels';
import type { CatalogExercise } from '../../data/catalog';
import { AppText } from '../../components/ui';
import { ExerciseThumb } from './ExerciseThumb';

export const EXERCISE_ROW_HEIGHT = 76;

interface ExerciseRowProps {
  exercise: CatalogExercise;
  onPress: (exercise: CatalogExercise) => void;
  /** Selection mode (picker): shows a check instead of a chevron. */
  selected?: boolean;
  selectable?: boolean;
  unavailable?: boolean;
  /** Starred by the athlete: a small star next to the name. */
  favorite?: boolean;
  /** Long press toggles the favorite (optional). */
  onLongPress?: (exercise: CatalogExercise) => void;
}

export const ExerciseRow = React.memo(function ExerciseRow({
  exercise,
  onPress,
  selected = false,
  selectable = false,
  unavailable = false,
  favorite = false,
  onLongPress,
}: ExerciseRowProps) {
  return (
    <Pressable
      accessibilityRole={selectable ? 'checkbox' : 'button'}
      accessibilityState={selectable ? { checked: selected } : undefined}
      accessibilityLabel={`${exercise.displayName}${favorite ? ', favorito' : ''}, ${labelTarget(exercise.target)}, ${labelEquipment(exercise.equipment)}`}
      accessibilityHint={onLongPress ? (favorite ? 'Mantén presionado para quitarlo de favoritos' : 'Mantén presionado para añadirlo a favoritos') : undefined}
      onPress={() => onPress(exercise)}
      onLongPress={onLongPress ? () => onLongPress(exercise) : undefined}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ExerciseThumb uri={exercise.thumbnailUrl} size={56} />
      <View style={styles.texts}>
        <View style={styles.nameRow}>
          {favorite && <Ionicons name="star" size={13} color={theme.colors.primary} />}
          <AppText variant="callout" numberOfLines={1} style={[styles.name, styles.metaFlex]}>
            {exercise.displayName}
          </AppText>
        </View>
        <View style={styles.metaRow}>
          <AppText variant="caption" color="primary" numberOfLines={1} style={styles.meta}>
            {labelTarget(exercise.target)}
          </AppText>
          <View style={styles.dot} />
          <AppText variant="caption" color="textMuted" numberOfLines={1} style={styles.metaFlex}>
            {labelEquipment(exercise.equipment)}
          </AppText>
          {unavailable && (
            <Ionicons name="alert-circle-outline" size={14} color={theme.colors.textMuted} accessibilityLabel="Requiere equipo que no tienes" />
          )}
        </View>
      </View>
      {selectable ? (
        <View style={[styles.check, selected && styles.checkOn]}>
          {selected && <Ionicons name="checkmark" size={16} color={theme.colors.onPrimary} />}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: EXERCISE_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  pressed: {
    backgroundColor: theme.colors.surface,
  },
  texts: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontWeight: '600',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  meta: {
    fontWeight: '600',
  },
  metaFlex: {
    flexShrink: 1,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: theme.colors.textMuted,
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
});
