import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import type { Routine } from '../../core/types';
import { coverForRoutine } from '../../data/covers';
import { getExercise } from '../../data/catalog';
import { AppText } from '../../components/ui';
import { estimateMinutes } from '../../core/utils/programGenerator';

/** Compact list of the days of a weekly program, with cover art. */
export function ProgramPreview({
  routines,
  nextId,
  onPressDay,
}: {
  routines: Routine[];
  nextId?: string;
  onPressDay?: (routine: Routine) => void;
}) {
  return (
    <View style={styles.list}>
      {routines.map((routine) => {
        const isNext = routine.id === nextId;
        const names = routine.exercises
          .slice(0, 3)
          .map((item) => getExercise(item.exerciseId)?.displayName ?? item.exerciseName)
          .join(', ');
        return (
          <Pressable
            key={routine.id}
            accessibilityRole={onPressDay ? 'button' : undefined}
            disabled={!onPressDay}
            onPress={() => onPressDay?.(routine)}
            style={({ pressed }) => [styles.row, isNext && styles.rowNext, pressed && styles.pressed]}
          >
            <Image source={coverForRoutine(routine)} style={styles.cover} contentFit="cover" accessibilityIgnoresInvertColors />
            <View style={styles.texts}>
              {isNext && (
                <AppText variant="overline" color="primary">
                  Siguiente
                </AppText>
              )}
              <AppText variant="callout" style={styles.bold} numberOfLines={1}>
                {routine.title}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {routine.exercises.length} ejercicios · ~{estimateMinutes(routine.exercises)} min · {names}
              </AppText>
            </View>
            {onPressDay && <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: theme.spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    paddingRight: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  rowNext: {
    borderColor: theme.colors.primaryBorder,
  },
  pressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  cover: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.sm,
  },
  texts: {
    flex: 1,
    gap: 2,
  },
  bold: {
    fontWeight: '700',
  },
});
