import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import type { ExperienceLevel, Routine, RoutineExercise } from '../../core/types';
import { getExercise } from '../../data/catalog';
import { estimateMinutes } from '../../core/utils/programGenerator';
import { createId, formatRest } from '../../core/utils/workout';
import { appActions, findRoutine, selectProfile, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, Chip, EmptyState, IconButton, ModalHeader, SegmentedControl } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { pickerBridge } from '../exercises/pickerBridge';

const REST_OPTIONS = [45, 60, 90, 120, 180];

function initialRoutine(editId?: string, fromId?: string, location: Routine['targetLocation'] = 'gym'): Routine {
  const existing = editId ? findRoutine(editId) : undefined;
  if (existing) return existing;
  const source = fromId ? findRoutine(fromId) : undefined;
  if (source) {
    return {
      ...source,
      id: createId('routine'),
      title: source.title,
      isCustom: true,
      createdAt: undefined,
      exercises: source.exercises.map((item) => ({ ...item })),
    };
  }
  return {
    id: createId('routine'),
    title: '',
    description: '',
    targetLocation: location,
    level: 'intermediate',
    estimatedMinutes: 0,
    exercises: [],
    isCustom: true,
  };
}

function Stepper({ value, onChange, min = 1, max = 10, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  return (
    <View style={styles.stepper}>
      <IconButton icon="remove" size={32} variant="filled" disabled={value <= min} onPress={() => onChange(value - 1)} accessibilityLabel={`Menos ${label}`} />
      <AppText variant="callout" style={styles.stepperValue} accessibilityLabel={`${value} ${label}`}>
        {value}
      </AppText>
      <IconButton icon="add" size={32} variant="filled" disabled={value >= max} onPress={() => onChange(value + 1)} accessibilityLabel={`Más ${label}`} />
    </View>
  );
}

export function RoutineBuilderScreen({ editId, fromId }: { editId?: string; fromId?: string }) {
  const profile = useAppStore(selectProfile);
  const [draft, setDraft] = useState<Routine>(() =>
    initialRoutine(editId, fromId, profile.trainingLocation === 'home' ? 'home' : 'gym')
  );
  const isEditing = !!editId && !!findRoutine(editId)?.isCustom;

  const updateItem = (index: number, patch: Partial<RoutineExercise>) =>
    setDraft((prev) => ({ ...prev, exercises: prev.exercises.map((item, i) => (i === index ? { ...item, ...patch } : item)) }));

  const moveItem = (index: number, direction: -1 | 1) =>
    setDraft((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.exercises.length) return prev;
      const exercises = [...prev.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...prev, exercises };
    });

  const removeItem = (index: number) =>
    setDraft((prev) => ({ ...prev, exercises: prev.exercises.filter((_, i) => i !== index) }));

  const openPicker = () => {
    pickerBridge.expect((ids) =>
      setDraft((prev) => ({
        ...prev,
        exercises: [
          ...prev.exercises,
          ...ids.map((id) => ({ exerciseId: id, exerciseName: getExercise(id)?.displayName, targetSets: 3, targetReps: '8-12', restSeconds: 90 })),
        ],
      }))
    );
    router.push({ pathname: '/exercise-picker', params: { mode: 'builder' } });
  };

  const save = () => {
    const title = draft.title.trim();
    if (!title) {
      FeedbackService.warning();
      Alert.alert('Falta el nombre', 'Ponle un nombre a tu rutina para encontrarla fácil.');
      return;
    }
    if (draft.exercises.length === 0) {
      FeedbackService.warning();
      Alert.alert('Rutina vacía', 'Añade al menos un ejercicio.');
      return;
    }
    FeedbackService.success();
    appActions.upsertRoutine({ ...draft, title, estimatedMinutes: estimateMinutes(draft.exercises), isCustom: true });
    router.back();
  };

  return (
    <StackScreen>
      <ModalHeader
        title={isEditing ? 'Editar rutina' : 'Nueva rutina'}
        onClose={() => router.back()}
        right={<Button label="Guardar" size="sm" onPress={save} />}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <AppText variant="overline" color="textMuted">
              Nombre
            </AppText>
            <TextInput
              value={draft.title}
              onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))}
              placeholder="Ej: Torso fuerza"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.titleInput}
              maxLength={48}
              selectionColor={theme.colors.primary}
            />
          </View>

          <View style={styles.field}>
            <AppText variant="overline" color="textMuted">
              Nivel
            </AppText>
            <SegmentedControl<ExperienceLevel>
              value={draft.level}
              onChange={(level) => setDraft((prev) => ({ ...prev, level }))}
              options={[
                { value: 'beginner', label: 'Principiante' },
                { value: 'intermediate', label: 'Intermedio' },
                { value: 'advanced', label: 'Avanzado' },
              ]}
            />
          </View>

          <View style={styles.listHeader}>
            <AppText variant="headline">Ejercicios</AppText>
            <AppText variant="caption" color="textMuted">
              {draft.exercises.length > 0 ? `~${estimateMinutes(draft.exercises)} min` : ''}
            </AppText>
          </View>

          {draft.exercises.length === 0 && (
            <EmptyState icon="barbell-outline" title="Sin ejercicios todavía" message="Busca en el catálogo de más de 1.300 movimientos." />
          )}

          {draft.exercises.map((item, index) => {
            const exercise = getExercise(item.exerciseId);
            return (
              <View key={`${item.exerciseId}_${index}`} style={styles.item}>
                <View style={styles.itemHeader}>
                  <ExerciseThumb uri={exercise?.thumbnailUrl} size={44} />
                  <AppText variant="callout" style={styles.itemName} numberOfLines={2}>
                    {exercise?.displayName ?? item.exerciseName}
                  </AppText>
                  <IconButton icon="arrow-up" size={32} disabled={index === 0} onPress={() => moveItem(index, -1)} accessibilityLabel="Subir" />
                  <IconButton
                    icon="arrow-down"
                    size={32}
                    disabled={index === draft.exercises.length - 1}
                    onPress={() => moveItem(index, 1)}
                    accessibilityLabel="Bajar"
                  />
                  <IconButton icon="close" size={32} color={theme.colors.danger} onPress={() => removeItem(index)} accessibilityLabel="Quitar" />
                </View>

                <View style={styles.itemControls}>
                  <View style={styles.control}>
                    <AppText variant="caption" color="textMuted">
                      Series
                    </AppText>
                    <Stepper value={item.targetSets} onChange={(targetSets) => updateItem(index, { targetSets })} label="series" />
                  </View>
                  <View style={styles.control}>
                    <AppText variant="caption" color="textMuted">
                      Reps
                    </AppText>
                    <TextInput
                      value={item.targetReps}
                      onChangeText={(targetReps) => updateItem(index, { targetReps: targetReps.replace(/[^0-9\-– ]/g, '') })}
                      style={styles.repsInput}
                      maxLength={7}
                      keyboardType="numbers-and-punctuation"
                      selectionColor={theme.colors.primary}
                      accessibilityLabel="Repeticiones objetivo"
                    />
                  </View>
                </View>

                <View style={styles.restRow}>
                  <AppText variant="caption" color="textMuted">
                    Descanso
                  </AppText>
                  <View style={styles.restChips}>
                    {REST_OPTIONS.map((seconds) => (
                      <Chip
                        key={seconds}
                        size="sm"
                        label={formatRest(seconds)}
                        selected={item.restSeconds === seconds}
                        onPress={() => updateItem(index, { restSeconds: seconds })}
                      />
                    ))}
                  </View>
                </View>
              </View>
            );
          })}

          <Button label="Añadir ejercicios" icon="add" variant="tonal" size="lg" fullWidth onPress={openPicker} />
        </ScrollView>
      </KeyboardAvoidingView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xxxl * 2,
  },
  field: {
    gap: theme.spacing.sm,
  },
  titleInput: {
    height: 52,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  item: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  itemName: {
    flex: 1,
    fontWeight: '700',
    marginLeft: theme.spacing.xs,
  },
  itemControls: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  control: {
    gap: 6,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  repsInput: {
    height: 36,
    minWidth: 84,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 0,
  },
  restRow: {
    gap: 6,
  },
  restChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
