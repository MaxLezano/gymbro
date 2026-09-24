import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { labelBodyPart, labelEquipment, labelTarget } from '../../core/i18n/labels';
import { getExercise } from '../../data/catalog';
import { fitsHomeEquipment } from '../../core/utils/equipment';
import { estimateOneRepMax, findLastPerformance, formatRelativeDate, personalRecords } from '../../core/utils/workout';
import { appActions, selectActiveWorkout, selectHistory, selectProfile, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Badge, Button, Card, EmptyState, ModalHeader, StatTile } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';

export function ExerciseDetailScreen({ exerciseId }: { exerciseId: string }) {
  const exercise = getExercise(exerciseId);
  const profile = useAppStore(selectProfile);
  const history = useAppStore(selectHistory);
  const activeWorkout = useAppStore(selectActiveWorkout);

  const stats = useMemo(() => {
    const last = findLastPerformance(exerciseId, history);
    const record = personalRecords(history).find((item) => item.exerciseId === exerciseId);
    return { last, record };
  }, [exerciseId, history]);

  if (!exercise) {
    return (
      <StackScreen>
        <ModalHeader title="Ejercicio" onClose={() => router.back()} closeIcon="arrow-back" />
        <EmptyState icon="alert-circle-outline" title="No encontramos este ejercicio" />
      </StackScreen>
    );
  }

  const atHome = fitsHomeEquipment(exercise, profile.homeEquipment);
  const alreadyInWorkout = activeWorkout?.exercises.some((log) => log.exerciseId === exercise.id);

  const handlePrimary = () => {
    FeedbackService.success();
    if (activeWorkout) appActions.addExercisesToWorkout([exercise.id]);
    else appActions.startEmptyWorkout([exercise.id], exercise.displayName);
    router.replace('/workout');
  };

  return (
    <StackScreen>
      <ModalHeader title={exercise.displayName} subtitle={labelBodyPart(exercise.bodyPart)} onClose={() => router.back()} closeIcon="arrow-back" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.media}>
          {exercise.gifUrl ? (
            <Image
              source={{ uri: exercise.gifUrl }}
              placeholder={exercise.thumbnailUrl ? { uri: exercise.thumbnailUrl } : undefined}
              style={styles.gif}
              contentFit="contain"
              autoplay
              cachePolicy="memory-disk"
              accessibilityLabel={`Animación de ${exercise.displayName}`}
            />
          ) : (
            <Ionicons name="videocam-off-outline" size={40} color={theme.colors.textMuted} />
          )}
        </View>

        <View style={styles.badges}>
          <Badge label={labelTarget(exercise.target)} tone="accent" icon="body-outline" />
          <Badge label={labelEquipment(exercise.equipment)} icon="barbell-outline" />
          {profile.trainingLocation === 'gym' ? null : atHome ? (
            <Badge label="Puedes hacerlo en casa" tone="success" icon="home-outline" />
          ) : (
            <Badge label="Requiere gimnasio o equipo" icon="business-outline" />
          )}
        </View>

        {exercise.secondaryMuscles.length > 0 && (
          <AppText variant="subhead" color="textSecondary" style={styles.secondary}>
            También trabaja: {exercise.secondaryMuscles.map(labelTarget).join(', ')}
          </AppText>
        )}

        {(stats.last || stats.record) && (
          <View style={styles.statsRow}>
            {stats.last && (
              <StatTile
                label="Última vez"
                value={`${stats.last.weightKg}×${stats.last.reps}`}
                unit="kg"
                icon="time-outline"
              />
            )}
            {stats.record && (
              <StatTile
                label="1RM estimado"
                value={stats.record.bestOneRepMax}
                unit="kg"
                icon="trophy-outline"
                caption={formatRelativeDate(stats.record.achievedAt)}
              />
            )}
          </View>
        )}

        <Card style={styles.steps}>
          <AppText variant="headline" style={styles.stepsTitle}>
            Cómo hacerlo
          </AppText>
          {exercise.instructions.length > 0 ? (
            exercise.instructions.map((step, index) => (
              <View key={index} style={styles.step}>
                <View style={styles.stepNumber}>
                  <AppText variant="caption" color="primary" style={styles.stepNumberText}>
                    {index + 1}
                  </AppText>
                </View>
                <AppText variant="body" color="textSecondary" style={styles.stepText}>
                  {step}
                </AppText>
              </View>
            ))
          ) : (
            <AppText color="textMuted">Sin instrucciones disponibles.</AppText>
          )}
        </Card>

        {stats.last && (
          <AppText variant="caption" color="textMuted" align="center">
            Próximo objetivo: {stats.last.weightKg}×{stats.last.reps + 1} o {stats.last.weightKg + 2.5}×{stats.last.reps} kg
            {' '}(1RM ≈ {estimateOneRepMax(stats.last.weightKg, stats.last.reps)} kg)
          </AppText>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Preguntar"
          icon="sparkles"
          variant="secondary"
          size="lg"
          onPress={() =>
            router.push({ pathname: '/coach', params: { prompt: `Dame consejos de técnica y progresión para ${exercise.displayName}` } })
          }
        />
        <Button
          label={activeWorkout ? (alreadyInWorkout ? 'Añadir otra vez' : 'Añadir al entreno') : 'Entrenar ahora'}
          icon={activeWorkout ? 'add' : 'play'}
          size="lg"
          style={styles.flex}
          onPress={handlePrimary}
        />
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
  media: {
    height: 280,
    borderRadius: theme.radius.lg,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  secondary: {
    marginTop: -theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  steps: {
    gap: theme.spacing.md,
  },
  stepsTitle: {
    marginBottom: theme.spacing.xs,
  },
  step: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  flex: {
    flex: 1,
  },
});
