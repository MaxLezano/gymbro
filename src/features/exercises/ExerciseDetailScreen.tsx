import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { labelBodyPart, labelEquipment, labelTarget } from '../../core/i18n/labels';
import { getExercise } from '../../data/catalog';
import { fitsHomeEquipment } from '../../core/utils/equipment';
import { findLastPerformance, formatRelativeDate, formatRest, parseRepRange, personalRecords, suggestLoad, type LoadSuggestion } from '../../core/utils/workout';
import { appActions, selectActiveWorkout, selectHistory, selectProfile, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Badge, Button, Card, Divider, EmptyState, ModalHeader, StatTile } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';

/** What the routine asks for (present when opened from a routine or a workout). */
export interface Prescription {
  sets: number;
  reps: string;
  restSeconds?: number;
}

const LOAD_BADGE: Record<LoadSuggestion['kind'], { label: string; tone: 'accent' | 'success' | 'neutral' } | null> = {
  up: { label: 'Sube', tone: 'success' },
  down: { label: 'Baja', tone: 'accent' },
  repeat: { label: 'Mantén', tone: 'neutral' },
  estimate: { label: 'Estimado', tone: 'neutral' },
  bodyweight: null,
  first: null,
};

/** "6-10" -> "6 a 10" (sentence) / "6-10" (tile) */
function repsLabel(reps: string) {
  const { min, max } = parseRepRange(reps);
  return min === max ? `${min}` : `${min} a ${max}`;
}
function repsShort(reps: string) {
  const { min, max } = parseRepRange(reps);
  return min === max ? `${min}` : `${min}-${max}`;
}

function PrescriptionCard({ prescription, suggestion }: { prescription?: Prescription; suggestion: LoadSuggestion }) {
  const badge = LOAD_BADGE[suggestion.kind];
  const weight = suggestion.weightKg != null ? `${suggestion.weightKg} kg` : suggestion.kind === 'bodyweight' ? 'Peso corporal' : 'A tu elección';
  return (
    <Card style={styles.plan}>
      {prescription && (
        <>
          <View style={styles.planTitle}>
            <Ionicons name="flag-outline" size={18} color={theme.colors.primary} />
            <AppText variant="headline">Tu objetivo</AppText>
          </View>
          <AppText variant="body" color="textSecondary">
            Haz {prescription.sets} {prescription.sets === 1 ? 'serie' : 'series'} de {repsLabel(prescription.reps)} repeticiones
            {prescription.restSeconds ? `. Descansa ${formatRest(prescription.restSeconds)} entre series.` : '.'}
          </AppText>
          <View style={styles.planTiles}>
            <StatTile label="Series" value={prescription.sets} icon="layers-outline" style={styles.flex} />
            <StatTile label="Reps" value={repsShort(prescription.reps)} icon="repeat-outline" style={styles.flex} />
            {prescription.restSeconds ? <StatTile label="Descanso" value={formatRest(prescription.restSeconds)} icon="timer-outline" style={styles.flex} /> : null}
          </View>
          <Divider />
        </>
      )}
      <View style={styles.loadRow}>
        <View style={styles.flex}>
          <AppText variant="caption" color="textMuted">
            Peso sugerido
          </AppText>
          <AppText variant="title" style={styles.loadValue}>
            {weight}
          </AppText>
        </View>
        {badge && <Badge label={badge.label} tone={badge.tone} />}
      </View>
      <AppText variant="subhead" color="textSecondary">
        {suggestion.reason}
      </AppText>
      {prescription && (
        <AppText variant="caption" color="textMuted">
          Una repetición es un movimiento completo; una serie, varias repeticiones seguidas sin parar.
        </AppText>
      )}
    </Card>
  );
}

export function ExerciseDetailScreen({ exerciseId, prescription }: { exerciseId: string; prescription?: Prescription }) {
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
  const suggestion = suggestLoad({
    equipment: exercise.equipment,
    targetReps: prescription?.reps,
    last: stats.last,
    oneRepMax: stats.record?.bestOneRepMax,
  });
  // Outside a routine only show the load card when there is history to base it on.
  const showPlan = !!prescription || !!stats.last || !!stats.record;
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
              cachePolicy="disk"
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

        {showPlan && <PrescriptionCard prescription={prescription} suggestion={suggestion} />}

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
  plan: {
    gap: theme.spacing.md,
  },
  planTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  planTiles: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  loadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  loadValue: {
    fontWeight: '800',
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
