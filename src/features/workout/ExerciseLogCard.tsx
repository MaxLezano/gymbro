import React from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { labelTarget } from '../../core/i18n/labels';
import { getExercise } from '../../data/catalog';
import type { SetLog, WorkoutExerciseLog } from '../../core/types';
import { appActions } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, IconButton } from '../../components/ui';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { NumberInput } from './NumberInput';

interface ExerciseLogCardProps {
  log: WorkoutExerciseLog;
  index: number;
  total: number;
  previousSets: SetLog[] | null;
  onSetCompleted: (exerciseIndex: number, restSeconds: number) => void;
}

const SetRow = React.memo(function SetRow({
  set,
  exerciseIndex,
  setIndex,
  previous,
  isBodyweight,
  onCompleted,
}: {
  set: SetLog;
  exerciseIndex: number;
  setIndex: number;
  previous?: SetLog;
  isBodyweight: boolean;
  onCompleted: () => void;
}) {
  const toggle = () => {
    const completed = !set.completed;
    if (completed && set.reps <= 0) {
      FeedbackService.warning();
      return;
    }
    if (completed) FeedbackService.success();
    else FeedbackService.lightTap();
    appActions.updateSet(exerciseIndex, setIndex, { completed });
    if (completed) onCompleted();
  };

  const askRemove = () => {
    FeedbackService.mediumTap();
    Alert.alert(`Eliminar serie ${set.setNumber}`, '¿Quitar esta serie del ejercicio?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => appActions.removeSet(exerciseIndex, setIndex) },
    ]);
  };

  return (
    <View style={[styles.setRow, set.completed && styles.setRowDone]}>
      <Pressable
        onLongPress={askRemove}
        accessibilityRole="button"
        accessibilityLabel={`Serie ${set.setNumber}. Mantén presionado para eliminar`}
        style={styles.colSet}
      >
        <AppText variant="callout" color={set.completed ? 'success' : 'textSecondary'} style={styles.bold}>
          {set.setNumber}
        </AppText>
      </Pressable>
      <View style={styles.colPrev}>
        <AppText variant="caption" color="textMuted" numberOfLines={1}>
          {previous ? `${previous.weightKg > 0 ? previous.weightKg : 'PC'}×${previous.reps}` : '—'}
        </AppText>
      </View>
      <View style={styles.colInput}>
        <NumberInput
          value={set.weightKg}
          decimals
          completed={set.completed}
          accessibilityLabel={`Peso serie ${set.setNumber}`}
          onChange={(weightKg) => appActions.updateSet(exerciseIndex, setIndex, { weightKg })}
          style={isBodyweight && set.weightKg === 0 ? styles.bodyweightHint : undefined}
        />
      </View>
      <View style={styles.colInput}>
        <NumberInput
          value={set.reps}
          completed={set.completed}
          accessibilityLabel={`Repeticiones serie ${set.setNumber}`}
          onChange={(reps) => appActions.updateSet(exerciseIndex, setIndex, { reps })}
        />
      </View>
      <View style={styles.colCheck}>
        <Pressable
          onPress={toggle}
          hitSlop={4}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: set.completed }}
          accessibilityLabel={`Completar serie ${set.setNumber}`}
          style={({ pressed }) => [styles.check, set.completed && styles.checkDone, pressed && styles.checkPressed]}
        >
          <Ionicons name="checkmark" size={20} color={set.completed ? theme.colors.onPrimary : theme.colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );
});

export const ExerciseLogCard = React.memo(function ExerciseLogCard({
  log,
  index,
  total,
  previousSets,
  onSetCompleted,
}: ExerciseLogCardProps) {
  const exercise = getExercise(log.exerciseId);
  const isBodyweight = exercise?.equipment === 'body weight';
  const done = log.sets.filter((set) => set.completed).length;
  const allDone = done === log.sets.length && log.sets.length > 0;

  const openMenu = () => {
    const actions = [
      ...(index > 0 ? [{ text: 'Mover arriba', onPress: () => appActions.moveExercise(index, -1) }] : []),
      ...(index < total - 1 ? [{ text: 'Mover abajo', onPress: () => appActions.moveExercise(index, 1) }] : []),
      {
        text: 'Quitar ejercicio',
        style: 'destructive' as const,
        onPress: () => appActions.removeExerciseFromWorkout(index),
      },
      { text: 'Cancelar', style: 'cancel' as const },
    ];
    Alert.alert(log.exerciseName, undefined, actions);
  };

  return (
    <View style={[styles.card, allDone && styles.cardDone]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver técnica de ${log.exerciseName}`}
          onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: log.exerciseId } })}
          style={styles.headerMain}
        >
          <ExerciseThumb uri={exercise?.thumbnailUrl} size={48} />
          <View style={styles.headerTexts}>
            <AppText variant="headline" numberOfLines={2}>
              {log.exerciseName}
            </AppText>
            <AppText variant="caption" color="textMuted" numberOfLines={2}>
              {[
                exercise ? labelTarget(exercise.target) : null,
                log.targetReps ? `Objetivo ${log.targetReps} reps` : null,
                `Descanso ${log.restSeconds ?? 90} s`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
        </Pressable>
        <IconButton icon="ellipsis-horizontal" size={36} onPress={openMenu} accessibilityLabel={`Opciones de ${log.exerciseName}`} />
      </View>

      <View style={styles.tableHeader}>
        <AppText variant="overline" color="textMuted" style={styles.headSet}>
          Serie
        </AppText>
        <AppText variant="overline" color="textMuted" style={styles.colPrev}>
          Anterior
        </AppText>
        <AppText variant="overline" color="textMuted" style={[styles.colInput, styles.center]}>
          Kg
        </AppText>
        <AppText variant="overline" color="textMuted" style={[styles.colInput, styles.center]}>
          Reps
        </AppText>
        <View style={styles.colCheck} />
      </View>

      {log.sets.map((set, setIndex) => (
        <SetRow
          key={set.id}
          set={set}
          exerciseIndex={index}
          setIndex={setIndex}
          previous={previousSets?.[setIndex]}
          isBodyweight={isBodyweight}
          onCompleted={() => onSetCompleted(index, log.restSeconds ?? 90)}
        />
      ))}

      <Button label="Añadir serie" icon="add" variant="ghost" size="sm" onPress={() => appActions.addSet(index)} style={styles.addSet} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
  },
  cardDone: {
    borderColor: 'rgba(50, 215, 75, 0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  headerTexts: {
    flex: 1,
    gap: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 5,
  },
  setRowDone: {
    backgroundColor: theme.colors.successSoft,
  },
  colSet: {
    width: 44,
    height: 40,
    justifyContent: 'center',
  },
  headSet: {
    width: 44,
  },
  colPrev: {
    flex: 1,
    minWidth: 58,
  },
  colInput: {
    width: 72,
    marginHorizontal: 4,
  },
  colCheck: {
    width: 48,
    alignItems: 'flex-end',
  },
  center: {
    textAlign: 'center',
  },
  bold: {
    fontWeight: '800',
  },
  bodyweightHint: {
    borderStyle: 'dashed',
  },
  check: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: {
    backgroundColor: theme.colors.success,
    borderColor: theme.colors.success,
  },
  checkPressed: {
    opacity: 0.7,
  },
  addSet: {
    alignSelf: 'center',
    marginTop: theme.spacing.sm,
  },
});
