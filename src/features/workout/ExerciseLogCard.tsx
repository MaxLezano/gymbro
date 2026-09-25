import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { labelTarget } from '../../core/i18n/labels';
import { formatRest } from '../../core/utils/workout';
import { getExercise } from '../../data/catalog';
import type { SetLog, WorkoutExerciseLog } from '../../core/types';
import { appActions } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { ActionSheet, AppText, Button, Chip, IconButton, type SheetAction } from '../../components/ui';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { NumberInput } from './NumberInput';

interface ExerciseLogCardProps {
  log: WorkoutExerciseLog;
  index: number;
  total: number;
  previousSets: SetLog[] | null;
  onSetCompleted: (exerciseIndex: number, restSeconds: number) => void;
}

/** Quick rest presets: short for isolation/circuits, long for heavy compound lifts. */
const REST_PRESETS = [30, 45, 60, 90, 120, 150, 180];

const SetRow = React.memo(function SetRow({
  set,
  exerciseIndex,
  setIndex,
  previous,
  isBodyweight,
  showPrevious,
  bodyweightMode,
  autoFocusWeight,
  onAddLoad,
  onCompleted,
}: {
  set: SetLog;
  exerciseIndex: number;
  setIndex: number;
  previous?: SetLog;
  isBodyweight: boolean;
  /** False when this exercise has no previous data at all: the column is hidden. */
  showPrevious: boolean;
  /** Bodyweight exercise without load: the weight cell reads "PC" instead of a disabled 0. */
  bodyweightMode: boolean;
  autoFocusWeight: boolean;
  onAddLoad: (setId: string) => void;
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
      {showPrevious && (
        <View style={styles.colPrev}>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {previous ? `${previous.weightKg > 0 ? previous.weightKg : 'PC'}×${previous.reps}` : '—'}
          </AppText>
        </View>
      )}
      <View style={[styles.colInput, !showPrevious && styles.colInputWide]}>
        {bodyweightMode ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Peso corporal"
            accessibilityHint="Toca para añadir lastre"
            onPress={() => {
              FeedbackService.lightTap();
              onAddLoad(set.id);
            }}
            style={({ pressed }) => [styles.bodyweightCell, set.completed && styles.bodyweightCellDone, pressed && styles.checkPressed]}
          >
            <AppText variant="callout" color={set.completed ? 'success' : 'textSecondary'} style={styles.bold}>
              PC
            </AppText>
          </Pressable>
        ) : (
          <NumberInput
            value={set.weightKg}
            decimals
            completed={set.completed}
            autoFocus={autoFocusWeight}
            accessibilityLabel={`Peso serie ${set.setNumber}`}
            onChange={(weightKg) => appActions.updateSet(exerciseIndex, setIndex, { weightKg })}
            style={isBodyweight && set.weightKg === 0 ? styles.bodyweightHint : undefined}
          />
        )}
      </View>
      <View style={[styles.colInput, !showPrevious && styles.colInputWide]}>
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
  const [editingRest, setEditingRest] = useState(false);
  const rest = log.restSeconds ?? 90;
  const showPrevious = (previousSets?.length ?? 0) > 0;
  // Bodyweight work shows "PC" until the athlete adds load (or already used load before).
  const [loadFocusSetId, setLoadFocusSetId] = useState<string | null>(null);
  const bodyweightMode =
    isBodyweight && loadFocusSetId === null && !previousSets?.some((set) => set.weightKg > 0) && log.sets.every((set) => set.weightKg === 0);
  const addLoad = useCallback((setId: string) => setLoadFocusSetId(setId), []);
  const caption = [exercise ? labelTarget(exercise.target) : null, log.targetReps ? `${log.targetReps} reps` : null].filter(Boolean).join(' · ');

  const [menuOpen, setMenuOpen] = useState(false);
  const menuActions: SheetAction[] = [
    {
      label: 'Reemplazar ejercicio',
      icon: 'swap-horizontal',
      onPress: () =>
        router.push({ pathname: '/exercise-picker', params: { replace: String(index), bodyPart: exercise?.bodyPart ?? 'all' } }),
    },
    ...(index > 0 ? [{ label: 'Mover arriba', icon: 'arrow-up' as const, onPress: () => appActions.moveExercise(index, -1) }] : []),
    ...(index < total - 1 ? [{ label: 'Mover abajo', icon: 'arrow-down' as const, onPress: () => appActions.moveExercise(index, 1) }] : []),
    {
      label: 'Quitar ejercicio',
      icon: 'trash-outline',
      destructive: true,
      onPress: () =>
        Alert.alert('¿Quitar este ejercicio?', log.exerciseName, [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Quitar', style: 'destructive', onPress: () => appActions.removeExerciseFromWorkout(index) },
        ]),
    },
  ];
  const openMenu = () => setMenuOpen(true);

  return (
    <View style={[styles.card, allDone && styles.cardDone]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver técnica de ${log.exerciseName}`}
          onPress={() =>
            router.push({
              pathname: '/exercise/[id]',
              params: log.targetReps
                ? { id: log.exerciseId, sets: String(log.sets.length), reps: log.targetReps, rest: String(log.restSeconds ?? 90) }
                : { id: log.exerciseId },
            })
          }
          style={styles.headerMain}
        >
          <ExerciseThumb uri={exercise?.thumbnailUrl} size={40} />
          <View style={styles.headerTexts}>
            <AppText variant="headline" numberOfLines={2}>
              {log.exerciseName}
            </AppText>
            {!!caption && (
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {caption}
              </AppText>
            )}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Descanso ${formatRest(rest)}. Toca para cambiarlo`}
          accessibilityState={{ expanded: editingRest }}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          onPress={() => {
            FeedbackService.lightTap();
            setEditingRest((value) => !value);
          }}
          style={({ pressed }) => [styles.restPill, editingRest && styles.restPillOpen, pressed && styles.checkPressed]}
        >
          <Ionicons name="timer-outline" size={14} color={theme.colors.primary} />
          <AppText variant="caption" color="textSecondary" style={[styles.bold, styles.tabular]}>
            {formatRest(rest)}
          </AppText>
        </Pressable>
        <IconButton icon="ellipsis-horizontal" size={36} onPress={openMenu} accessibilityLabel={`Opciones de ${log.exerciseName}`} />
      </View>

      {editingRest && (
        <View style={styles.restPresets}>
          {REST_PRESETS.map((seconds) => (
            <Chip
              key={seconds}
              size="sm"
              label={formatRest(seconds)}
              selected={seconds === rest}
              onPress={() => {
                appActions.setExerciseRest(index, seconds);
                setEditingRest(false);
              }}
            />
          ))}
        </View>
      )}

      <View style={styles.tableHeader}>
        <AppText variant="overline" color="textMuted" style={styles.headSet}>
          Serie
        </AppText>
        {showPrevious && (
          <AppText variant="overline" color="textMuted" style={styles.colPrev}>
            Anterior
          </AppText>
        )}
        <AppText variant="overline" color="textMuted" style={[styles.colInput, !showPrevious && styles.colInputWide, styles.center]}>
          {bodyweightMode ? 'Peso' : 'Kg'}
        </AppText>
        <AppText variant="overline" color="textMuted" style={[styles.colInput, !showPrevious && styles.colInputWide, styles.center]}>
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
          showPrevious={showPrevious}
          bodyweightMode={bodyweightMode}
          autoFocusWeight={loadFocusSetId === set.id}
          onAddLoad={addLoad}
          onCompleted={() => onSetCompleted(index, log.restSeconds ?? 90)}
        />
      ))}

      <Button label="Añadir serie" icon="add" variant="ghost" size="sm" onPress={() => appActions.addSet(index)} style={styles.addSet} />
      <ActionSheet visible={menuOpen} title={log.exerciseName} actions={menuActions} onClose={() => setMenuOpen(false)} />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xs,
  },
  cardDone: {
    borderColor: 'rgba(50, 215, 75, 0.35)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.sm,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 44,
  },
  headerTexts: {
    flex: 1,
  },
  restPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  restPillOpen: {
    borderColor: theme.colors.primaryBorder,
  },
  restPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
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
  colInputWide: {
    flex: 1,
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
  bodyweightCell: {
    height: 40,
    borderRadius: theme.radius.sm,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyweightCellDone: {
    borderColor: 'transparent',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
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
    marginTop: theme.spacing.xs,
  },
});
