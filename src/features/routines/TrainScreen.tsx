import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { AppText, Chip, EmptyState, ScreenHeader, SectionHeader, SegmentedControl } from '../../components/ui';
import { TabScreen } from '../../components/layout/TabScreen';
import { HeaderActions } from '../../components/layout/HeaderActions';
import { registerDraftRoutine, selectAllRoutines, selectHistory, selectProfile, useAppStore } from '../../state/appStore';
import { nextProgramRoutine } from '../../core/utils/program';
import { ProgramPreview } from '../profile/ProgramPreview';
import { FOCUS_LABELS, generateRoutine, type TrainingFocus } from '../../core/utils/programGenerator';
import { routineCompatibility } from '../../core/utils/equipment';
import { FeedbackService } from '../../core/services/feedback';
import { startFreeWorkout, startRoutineWorkout } from '../workout/startWorkout';
import { RoutineCard } from './RoutineCard';
import { TrainingReminderCard } from './TrainingReminderCard';
import { TourTarget } from '../tour/TourTarget';

type Filter = 'for_you' | 'home' | 'gym';

const QUICK_FOCUS: TrainingFocus[] = ['full_body', 'upper', 'lower', 'push', 'pull', 'legs', 'arms', 'core', 'glutes', 'cardio'];

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        FeedbackService.selection();
        onPress();
      }}
      style={({ pressed }) => [styles.quick, pressed && styles.quickPressed]}
    >
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={theme.colors.primary} />
      </View>
      <AppText variant="callout" style={styles.bold} numberOfLines={1}>
        {title}
      </AppText>
      <AppText variant="caption" color="textMuted" numberOfLines={2}>
        {subtitle}
      </AppText>
    </Pressable>
  );
}

export function TrainScreen() {
  const profile = useAppStore(selectProfile);
  const routines = useAppStore(selectAllRoutines);
  const history = useAppStore(selectHistory);
  const [filter, setFilter] = useState<Filter>(profile.trainingLocation === 'gym' ? 'gym' : profile.trainingLocation === 'home' ? 'home' : 'for_you');

  const { mine, suggested, program } = useMemo(() => {
    const program = routines
      .filter((routine) => routine.programId)
      .sort((a, b) => (a.programDay ?? 0) - (b.programDay ?? 0));
    const custom = routines.filter((routine) => routine.isCustom && !routine.programId);
    const seeds = routines.filter((routine) => !routine.isCustom);
    let list = seeds;
    if (filter === 'home') list = seeds.filter((routine) => routine.targetLocation === 'home');
    if (filter === 'gym') list = seeds.filter((routine) => routine.targetLocation === 'gym');
    if (filter === 'for_you') {
      // Best matches first: fully compatible with the athlete's setup, then by level.
      list = [...seeds].sort((a, b) => {
        const ca = routineCompatibility(a, profile);
        const cb = routineCompatibility(b, profile);
        return Number(cb.isFullyAvailable) - Number(ca.isFullyAvailable) || Number(b.level === profile.experience) - Number(a.level === profile.experience);
      });
    }
    return { mine: custom, suggested: list, program };
  }, [routines, filter, profile]);

  const generate = (focus: TrainingFocus) => {
    FeedbackService.mediumTap();
    const routine = generateRoutine({ focus, profile });
    registerDraftRoutine(routine);
    router.push({ pathname: '/routine/[id]', params: { id: routine.id } });
  };

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Entrenar" subtitle="Elige, genera o crea tu sesión" right={<HeaderActions />} />

        <TourTarget id="train.quick" style={styles.quickRow}>
          <QuickAction icon="flash-outline" title="Entreno libre" subtitle="Añade ejercicios sobre la marcha" onPress={startFreeWorkout} />
          <QuickAction icon="create-outline" title="Crear rutina" subtitle="Arma la tuya del catálogo" onPress={() => router.push('/routine-builder')} />
        </TourTarget>

        <TourTarget id="train.generate" style={styles.section}>
          <SectionHeader title="Generar al instante" style={styles.padded} />
          <AppText variant="subhead" color="textMuted" style={[styles.padded, styles.hint]}>
            Rutina adaptada a tu equipo, nivel y objetivo. Toca un foco:
          </AppText>
          <FlatList
            horizontal
            data={QUICK_FOCUS}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.focusRow}
            renderItem={({ item }) => <Chip label={FOCUS_LABELS[item]} icon="sparkles-outline" onPress={() => generate(item)} />}
          />
        </TourTarget>

        <TourTarget id="train.program" style={[styles.section, styles.padded]}>
          <SectionHeader
            title="Tu programa semanal"
            actionLabel={program.length ? 'Rehacer' : undefined}
            onAction={() => router.push('/program')}
          />
          {program.length ? (
            <ProgramPreview
              routines={program}
              nextId={nextProgramRoutine(program, history)?.id}
              onPressDay={(routine) => router.push({ pathname: '/routine/[id]', params: { id: routine.id } })}
            />
          ) : (
            <QuickAction
              icon="calendar-outline"
              title="Crear mi programa"
              subtitle="Un plan semanal según tus días, tu tiempo y tu objetivo"
              onPress={() => router.push('/program')}
            />
          )}
          <TrainingReminderCard />
        </TourTarget>

        {mine.length > 0 && (
          <View style={[styles.section, styles.padded]}>
            <SectionHeader title="Mis rutinas" />
            <View style={styles.list}>
              {mine.map((routine) => (
                <RoutineCard key={routine.id} routine={routine} profile={profile} onStart={startRoutineWorkout} />
              ))}
            </View>
          </View>
        )}

        <View style={[styles.section, styles.padded]}>
          <SectionHeader title="Programas recomendados" />
          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'for_you', label: 'Para ti' },
              { value: 'home', label: 'En casa' },
              { value: 'gym', label: 'Gimnasio' },
            ]}
          />
          <View style={[styles.list, styles.listTop]}>
            {suggested.length === 0 ? (
              <EmptyState icon="barbell-outline" title="Sin rutinas en esta categoría" />
            ) : (
              suggested.map((routine) => (
                <RoutineCard key={routine.id} routine={routine} profile={profile} onStart={startRoutineWorkout} />
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: theme.spacing.xxxl,
  },
  padded: {
    paddingHorizontal: theme.spacing.lg,
  },
  quickRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  quick: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    gap: 4,
  },
  quickPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  bold: {
    fontWeight: '700',
  },
  section: {
    marginTop: theme.spacing.xxl,
  },
  hint: {
    marginTop: -theme.spacing.sm,
  },
  focusRow: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  list: {
    gap: theme.spacing.md,
  },
  listTop: {
    marginTop: theme.spacing.md,
  },
});
