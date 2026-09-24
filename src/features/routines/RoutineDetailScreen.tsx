import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { LEVEL_LABELS, labelTarget } from '../../core/i18n/labels';
import { getExercise } from '../../data/catalog';
import { routineCompatibility } from '../../core/utils/equipment';
import { appActions, findRoutine, isDraftRoutine, selectCustomRoutines, selectProfile, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Badge, Button, Card, CoverImage, Divider, EmptyState, IconButton, ModalHeader, StatTile } from '../../components/ui';
import { coverForRoutine } from '../../data/covers';
import { StackScreen } from '../../components/layout/TabScreen';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { startRoutineWorkout } from '../workout/startWorkout';

export function RoutineDetailScreen({ routineId }: { routineId: string }) {
  const profile = useAppStore(selectProfile);
  // Subscribe so edits/deletes re-render this screen.
  useAppStore(selectCustomRoutines);
  const routine = findRoutine(routineId);
  const [savedDraft, setSavedDraft] = useState(false);

  if (!routine) {
    return (
      <StackScreen>
        <ModalHeader title="Rutina" onClose={() => router.back()} closeIcon="arrow-back" />
        <EmptyState icon="alert-circle-outline" title="Esta rutina ya no existe" actionLabel="Volver" onAction={() => router.back()} />
      </StackScreen>
    );
  }

  const isDraft = isDraftRoutine(routine.id) && !savedDraft;
  const compatibility = routineCompatibility(routine, profile);
  const totalSets = routine.exercises.reduce((sum, item) => sum + item.targetSets, 0);

  const saveDraft = () => {
    FeedbackService.success();
    appActions.upsertRoutine(routine);
    setSavedDraft(true);
  };

  const confirmDelete = () => {
    Alert.alert('Eliminar rutina', `"${routine.title}" se borrará de tus rutinas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          appActions.deleteRoutine(routine.id);
          router.back();
        },
      },
    ]);
  };

  const editOrDuplicate = () => {
    if (routine.isCustom && !isDraft) router.push({ pathname: '/routine-builder', params: { id: routine.id } });
    else router.push({ pathname: '/routine-builder', params: { from: routine.id } });
  };

  return (
    <StackScreen>
      <ModalHeader
        title={isDraft ? 'Vista previa' : 'Rutina'}
        onClose={() => router.back()}
        closeIcon="arrow-back"
        right={
          <>
            <IconButton icon="create-outline" size={38} onPress={editOrDuplicate} accessibilityLabel={routine.isCustom ? 'Editar rutina' : 'Duplicar y editar'} />
            {routine.isCustom && !isDraft && (
              <IconButton icon="trash-outline" size={38} color={theme.colors.danger} onPress={confirmDelete} accessibilityLabel="Eliminar rutina" />
            )}
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <CoverImage source={coverForRoutine(routine)} height={200} style={styles.hero}>
          <AppText variant="title" style={styles.heroTitle}>
            {routine.title}
          </AppText>
        </CoverImage>
        <View style={styles.titleBlock}>
          {!!routine.description && (
            <AppText variant="body" color="textSecondary">
              {routine.description}
            </AppText>
          )}
          <View style={styles.badges}>
            <Badge label={LEVEL_LABELS[routine.level]} tone="accent" />
            <Badge label={routine.targetLocation === 'home' ? 'En casa' : routine.targetLocation === 'gym' ? 'Gimnasio' : 'Cualquier lugar'} />
            {profile.trainingLocation === 'home' && !compatibility.isFullyAvailable && (
              <Badge label={`Te falta equipo para ${compatibility.total - compatibility.available}`} tone="danger" icon="alert-circle-outline" />
            )}
          </View>
        </View>

        <View style={styles.stats}>
          <StatTile label="Duración" value={`~${routine.estimatedMinutes}`} unit="min" icon="time-outline" />
          <StatTile label="Ejercicios" value={routine.exercises.length} icon="list-outline" />
          <StatTile label="Series" value={totalSets} icon="layers-outline" />
        </View>

        <Card padding={0}>
          {routine.exercises.map((item, index) => {
            const exercise = getExercise(item.exerciseId);
            return (
              <View key={`${item.exerciseId}_${index}`}>
                {index > 0 && <Divider inset={theme.spacing.lg + 52 + theme.spacing.md} />}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: item.exerciseId } })}
                  style={({ pressed }) => [styles.exerciseRow, pressed && { backgroundColor: theme.colors.surfaceAlt }]}
                >
                  <ExerciseThumb uri={exercise?.thumbnailUrl} size={52} />
                  <View style={styles.exerciseTexts}>
                    <AppText variant="callout" style={styles.bold} numberOfLines={2}>
                      {exercise?.displayName ?? item.exerciseName ?? item.exerciseId}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {exercise ? `${labelTarget(exercise.target)} · ` : ''}Descanso {item.restSeconds} s
                    </AppText>
                  </View>
                  <View style={styles.prescription}>
                    <AppText variant="callout" color="primary" style={styles.bold}>
                      {item.targetSets}×{item.targetReps}
                    </AppText>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </Card>

        {compatibility.missing.length > 0 && profile.trainingLocation === 'home' && (
          <AppText variant="caption" color="textMuted">
            Necesitan equipo que no marcaste: {compatibility.missing.join(', ')}. Puedes cambiarlos editando la rutina.
          </AppText>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {isDraft && <Button label="Guardar" icon="bookmark-outline" variant="secondary" size="lg" onPress={saveDraft} />}
        {savedDraft && <Button label="Guardada" icon="checkmark" variant="secondary" size="lg" disabled onPress={() => undefined} />}
        <Button label="Empezar" icon="play" size="lg" style={styles.flex} onPress={() => startRoutineWorkout(routine)} />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl,
  },
  hero: {
    marginHorizontal: -theme.spacing.lg,
    marginTop: -theme.spacing.lg,
  },
  heroTitle: {
    color: '#FFFFFF',
  },
  titleBlock: {
    gap: theme.spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: theme.spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  exerciseTexts: {
    flex: 1,
    gap: 2,
  },
  prescription: {
    minWidth: 64,
    alignItems: 'flex-end',
  },
  bold: {
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  flex: {
    flex: 1,
  },
});
