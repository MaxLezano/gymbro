import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { generateWeeklyProgram, type WeeklyProgram } from '../../core/utils/programGenerator';
import { appActions, selectAccount, selectProfile, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, IconButton } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';
import { profileFromDraft, useProfileDraft } from './profileDraft';
import {
  ActivitySection,
  BasicsSection,
  DurationSection,
  EquipmentSection,
  ExperienceSection,
  FieldLabel,
  FocusMuscleSection,
  FrequencySection,
  GoalSection,
  GymTypeSection,
  LivePreview,
  RECOMMENDED_DAYS,
} from './ProfileSections';
import { ProgramPreview } from './ProgramPreview';

type StepKey =
  | 'name'
  | 'goal'
  | 'experience'
  | 'basics'
  | 'activity'
  | 'gym'
  | 'equipment'
  | 'days'
  | 'duration'
  | 'focus'
  | 'building'
  | 'ready';

const STEP_COPY: Record<Exclude<StepKey, 'building' | 'ready'>, { title: string; subtitle?: string }> = {
  name: { title: '¿Cómo te llamamos?', subtitle: 'Así personalizamos tu experiencia.' },
  goal: { title: '¿Cuál es tu objetivo principal?', subtitle: 'Ajusta tus calorías, macros y el tipo de entrenamiento.' },
  experience: { title: '¿Cuánta experiencia tienes?' },
  basics: { title: 'Sobre ti', subtitle: 'Para calcular tu metabolismo con precisión. Tus datos no salen de tu teléfono.' },
  activity: { title: '¿Qué tan activo eres?', subtitle: 'Incluye el entrenamiento y tu día a día.' },
  gym: { title: '¿Dónde entrenas?', subtitle: 'Elegimos ejercicios que realmente puedas hacer.' },
  equipment: { title: '¿Qué equipo tienes?', subtitle: 'Puedes cambiarlo cuando quieras desde tu perfil.' },
  days: { title: '¿Cuántos días por semana?', subtitle: 'Mejor constante que perfecto.' },
  duration: { title: '¿Cuánto duran tus sesiones?' },
  focus: { title: '¿Algún músculo que quieras priorizar?', subtitle: 'Tu programa seguirá siendo equilibrado, con volumen extra para ese grupo.' },
};

const BUILD_STEPS = [
  'Calculando tus calorías y macros',
  'Eligiendo ejercicios para tu equipo',
  'Armando tu split semanal',
  'Ajustando series, repeticiones y descansos',
];

// ---------------------------------------------------------------------------
// Building + ready
// ---------------------------------------------------------------------------

function Building({ onDone }: { onDone: () => void }) {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const timers = BUILD_STEPS.map((_, i) => setTimeout(() => setDone(i + 1), 550 * (i + 1)));
    const finish = setTimeout(onDone, 550 * BUILD_STEPS.length + 500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(finish);
    };
  }, [onDone]);

  return (
    <View style={styles.building}>
      <View style={styles.buildingIcon}>
        <Ionicons name="sparkles" size={30} color={theme.colors.primary} />
      </View>
      <AppText variant="title" align="center">
        Armando tu plan
      </AppText>
      <View style={styles.buildList}>
        {BUILD_STEPS.map((label, i) => {
          const complete = i < done;
          return (
            <View key={label} style={styles.buildRow}>
              <Ionicons
                name={complete ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={complete ? theme.colors.success : theme.colors.textDisabled}
              />
              <AppText variant="callout" color={complete ? 'text' : 'textMuted'}>
                {label}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function OnboardingScreen() {
  const profile = useAppStore(selectProfile);
  const account = useAppStore(selectAccount);
  const { draft, update, merge, errors, preview } = useProfileDraft(profile);
  const [step, setStep] = useState(0);
  const [program, setProgram] = useState<WeeklyProgram | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const advance = useCallback(() => setStep((value) => value + 1), []);

  const steps: StepKey[] = useMemo(
    () => [
      'name',
      'goal',
      'experience',
      'basics',
      'activity',
      'gym',
      ...(draft.trainingLocation === 'home' ? (['equipment'] as StepKey[]) : []),
      'days',
      'duration',
      'focus',
      'building',
      'ready',
    ],
    [draft.trainingLocation]
  );
  const current = steps[Math.min(step, steps.length - 1)];
  const questionCount = steps.length - 2;

  const basicsValid = !errors.age && !errors.weightKg && !errors.heightCm;
  const canContinue = current !== 'basics' || basicsValid;

  const go = (delta: number) => {
    FeedbackService.selection();
    const next = Math.max(0, Math.min(steps.length - 1, step + delta));
    if (steps[next] === 'building') setProgram(generateWeeklyProgram(profileFromDraft(profile, draft)));
    // Preselect the evidence-based frequency the first time the athlete reaches it.
    if (steps[next] === 'days' && !profile.daysPerWeek) update('daysPerWeek', RECOMMENDED_DAYS[draft.experience]);
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  // Leaving from the first question abandons a brand-new profile.
  const cancel = async () => {
    if (account && !profile.hasCompletedOnboarding) await appActions.deleteAccount(account.id);
    else await appActions.signOut();
    router.replace('/login');
  };

  const finish = () => {
    FeedbackService.success();
    const next = { ...profileFromDraft(profile, draft), hasCompletedOnboarding: true };
    appActions.saveProfile(next);
    if (program) appActions.saveProgram(program.routines);
    router.replace('/');
  };

  if (current === 'building') {
    return (
      <StackScreen>
        <Building onDone={advance} />
      </StackScreen>
    );
  }

  const copy = current === 'ready' ? null : STEP_COPY[current];

  return (
    <StackScreen>
      {current !== 'ready' && (
        <View style={styles.top}>
          <IconButton
            icon="arrow-back"
            variant="filled"
            size={38}
            onPress={() => (step === 0 ? cancel() : go(-1))}
            accessibilityLabel="Paso anterior"
          />
          <View style={styles.segments} accessibilityLabel={`Paso ${step + 1} de ${questionCount}`}>
            {Array.from({ length: questionCount }, (_, i) => (
              <View key={i} style={[styles.segment, i <= step && styles.segmentOn]} />
            ))}
          </View>
        </View>
      )}

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {copy && (
            <View style={styles.stepHeader}>
              <AppText variant="largeTitle">{copy.title}</AppText>
              {copy.subtitle && (
                <AppText variant="body" color="textSecondary">
                  {copy.subtitle}
                </AppText>
              )}
            </View>
          )}

          {current === 'name' && (
            <View style={styles.section}>
              <FieldLabel>Nombre</FieldLabel>
              <TextInput
                value={draft.name}
                onChangeText={(text) => update('name', text)}
                placeholder="Tu nombre"
                placeholderTextColor={theme.colors.textDisabled}
                autoFocus
                maxLength={32}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => go(1)}
                selectionColor={theme.colors.primary}
                style={styles.nameInput}
              />
            </View>
          )}
          {current === 'goal' && <GoalSection draft={draft} update={update} />}
          {current === 'experience' && <ExperienceSection draft={draft} update={update} />}
          {current === 'basics' && <BasicsSection draft={draft} update={update} errors={errors} showName={false} />}
          {current === 'activity' && <ActivitySection draft={draft} update={update} />}
          {current === 'gym' && <GymTypeSection draft={draft} merge={merge} />}
          {current === 'equipment' && <EquipmentSection draft={draft} update={update} />}
          {current === 'days' && <FrequencySection draft={draft} update={update} />}
          {current === 'duration' && <DurationSection draft={draft} update={update} />}
          {current === 'focus' && <FocusMuscleSection draft={draft} update={update} />}

          {current === 'ready' && program && (
            <View style={styles.ready}>
              <View style={styles.stepHeader}>
                <AppText variant="overline" color="primary">
                  {draft.name.trim() ? `Listo, ${draft.name.trim().split(/\s+/)[0]}` : 'Listo'}
                </AppText>
                <AppText variant="largeTitle">Tu programa está listo</AppText>
                <AppText variant="body" color="textSecondary">
                  {program.daysPerWeek} {program.daysPerWeek === 1 ? 'día' : 'días'} por semana, sesiones de ~{draft.sessionMinutes} min. Puedes editar cada día cuando quieras.
                </AppText>
              </View>
              <ProgramPreview routines={program.routines} />
              <LivePreview preview={preview} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {current === 'ready' ? (
          <Button label="Empezar a entrenar" iconRight="arrow-forward" size="lg" fullWidth onPress={finish} />
        ) : (
          <Button
            label={current === 'focus' ? 'Crear mi programa' : 'Continuar'}
            iconRight={current === 'focus' ? 'sparkles' : 'arrow-forward'}
            size="lg"
            fullWidth
            disabled={!canContinue}
            onPress={() => go(1)}
          />
        )}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfacePressed,
  },
  segmentOn: {
    backgroundColor: theme.colors.primary,
  },
  scroll: {
    flexGrow: 1,
    padding: theme.spacing.xl,
    gap: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxxl,
  },
  stepHeader: {
    gap: theme.spacing.sm,
  },
  section: {
    gap: theme.spacing.sm,
  },
  nameInput: {
    height: 56,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '600',
  },
  ready: {
    gap: theme.spacing.xl,
  },
  building: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  buildingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buildList: {
    alignSelf: 'stretch',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  buildRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
});
