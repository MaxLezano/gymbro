import React, { useCallback, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { useNow } from '../../core/hooks/useNow';
import {
  countCompletedSets,
  countTotalSets,
  estimateOneRepMax,
  findLastPerformance,
  formatDuration,
  formatVolume,
  personalRecords,
  pluralize,
} from '../../core/utils/workout';
import type { SetLog, WorkoutSession } from '../../core/types';
import { appActions, getAppState, selectActiveWorkout, selectHistory, selectRestTimer, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, EmptyState, IconButton, ProgressBar } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';
import { ExerciseLogCard } from './ExerciseLogCard';
import { RestTimer } from './RestTimer';
import { WorkoutSummary, type NewRecord } from './WorkoutSummary';

function Clock({ startedAt }: { startedAt: number }) {
  const now = useNow();
  return (
    <AppText variant="headline" color="primary" style={styles.clock} accessibilityLabel="Tiempo transcurrido">
      {formatDuration((now - startedAt) / 1000)}
    </AppText>
  );
}

export function WorkoutScreen() {
  const session = useAppStore(selectActiveWorkout);
  const history = useAppStore(selectHistory);
  const rest = useAppStore(selectRestTimer);
  const [summary, setSummary] = useState<{ session: WorkoutSession; records: NewRecord[] } | null>(null);

  // Previous performance per exercise (for the "Anterior" column).
  const exerciseKey = session?.exercises.map((log) => log.exerciseId).join('|') ?? '';
  const previousByExercise = useMemo(() => {
    const map = new Map<string, SetLog[]>();
    for (const id of exerciseKey.split('|').filter(Boolean)) {
      const last = findLastPerformance(id, history);
      if (last) map.set(id, last.sets);
    }
    return map;
  }, [exerciseKey, history]);

  const handleSetCompleted = useCallback((exerciseIndex: number, restSeconds: number) => {
    const current = getAppState().activeWorkout;
    if (!current) return;
    const log = current.exercises[exerciseIndex];
    const pendingHere = log.sets.some((set) => !set.completed);
    const nextLog = pendingHere ? log : current.exercises.slice(exerciseIndex + 1).find((item) => item.sets.some((set) => !set.completed));
    if (!nextLog) {
      appActions.clearRest();
      return;
    }
    appActions.startRest(restSeconds, nextLog.exerciseName);
  }, []);

  if (summary) {
    return <WorkoutSummary session={summary.session} records={summary.records} onDone={() => router.replace('/progress')} onClose={() => router.replace('/')} />;
  }

  if (!session) {
    return (
      <StackScreen>
        <EmptyState
          icon="barbell-outline"
          title="No hay entrenamiento activo"
          message="Elige una rutina o empieza uno libre desde Entrenar."
          actionLabel="Volver"
          onAction={() => router.back()}
        />
      </StackScreen>
    );
  }

  const done = countCompletedSets(session.exercises);
  const total = countTotalSets(session.exercises);

  const finish = () => {
    const previousBest = new Map(personalRecords(history).map((record) => [record.exerciseId, record.bestOneRepMax]));
    const saved = appActions.finishWorkout();
    if (!saved) {
      router.back();
      return;
    }
    const records: NewRecord[] = [];
    for (const log of saved.exercises) {
      const best = Math.max(...log.sets.map((set) => estimateOneRepMax(set.weightKg, set.reps)));
      const previous = previousBest.get(log.exerciseId) ?? null;
      if (best > 0 && previous !== null && best > previous) {
        records.push({ exerciseName: log.exerciseName, oneRepMax: best, previous });
      }
    }
    FeedbackService.success();
    setSummary({ session: saved, records });
  };

  const askFinish = () => {
    if (done === 0) {
      Alert.alert('Aún no completaste series', 'Marca las series con el check a medida que las haces.', [
        { text: 'Seguir entrenando', style: 'cancel' },
        { text: 'Descartar entrenamiento', style: 'destructive', onPress: discard },
      ]);
      return;
    }
    const pending = total - done;
    Alert.alert(
      'Terminar entrenamiento',
      pending > 0 ? `Te quedan ${pluralize(pending, 'serie')} sin marcar. Solo se guardarán las completadas.` : 'Se guardará en tu historial.',
      [
        { text: 'Seguir', style: 'cancel' },
        { text: 'Terminar', onPress: finish },
      ]
    );
  };

  function discard() {
    appActions.discardWorkout();
    router.back();
  }

  const askDiscard = () => {
    FeedbackService.warning();
    Alert.alert('Descartar entrenamiento', 'Se perderán todas las series de esta sesión.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: discard },
    ]);
  };

  return (
    <StackScreen>
      <View style={styles.header}>
        <IconButton icon="chevron-down" variant="filled" size={38} onPress={() => router.back()} accessibilityLabel="Minimizar entrenamiento" />
        <View style={styles.headerCenter}>
          <AppText variant="caption" color="textMuted" numberOfLines={1}>
            {session.title}
          </AppText>
          <Clock startedAt={session.startedAt} />
        </View>
        <Button label="Terminar" size="sm" onPress={askFinish} />
      </View>

      <View style={styles.progress}>
        <View style={styles.progressTexts}>
          <AppText variant="caption" color="textSecondary">
            {done}/{total} series
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {formatVolume(session.totalVolumeKg)}
          </AppText>
        </View>
        <ProgressBar value={total ? done / total : 0} height={4} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {session.exercises.length === 0 && (
            <EmptyState icon="add-circle-outline" title="Entrenamiento vacío" message="Añade ejercicios del catálogo para empezar." />
          )}
          {session.exercises.map((log, index) => (
            <ExerciseLogCard
              key={`${log.exerciseId}_${index}`}
              log={log}
              index={index}
              total={session.exercises.length}
              previousSets={previousByExercise.get(log.exerciseId) ?? null}
              onSetCompleted={handleSetCompleted}
            />
          ))}

          <Button
            label="Añadir ejercicios"
            icon="add"
            variant="tonal"
            size="lg"
            fullWidth
            onPress={() => router.push({ pathname: '/exercise-picker', params: { mode: 'workout' } })}
          />
          <Button label="Descartar entrenamiento" variant="ghost" size="md" onPress={askDiscard} style={styles.discard} />
        </ScrollView>
      </KeyboardAvoidingView>

      {rest && (
        <RestTimer
          endsAt={rest.endsAt}
          totalSeconds={rest.totalSeconds}
          nextLabel={rest.nextLabel}
          onAdjust={appActions.adjustRest}
          onDismiss={appActions.clearRest}
        />
      )}
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  clock: {
    fontVariant: ['tabular-nums'],
  },
  progress: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  progressTexts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scroll: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl * 2,
  },
  discard: {
    alignSelf: 'center',
  },
});
