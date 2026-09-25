import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { calculateNutritionPlan } from '../../core/utils/nutrition';
import { estimateMinutes, generateRoutine, suggestFocus } from '../../core/utils/programGenerator';
import { getExercise } from '../../data/catalog';
import {
  countCompletedSets,
  formatMinutes,
  formatRelativeDate,
  formatVolume,
  pluralize,
  sessionDate,
  trainedDaysThisWeek,
  weekStreak,
} from '../../core/utils/workout';
import {
  appActions,
  registerDraftRoutine,
  selectActiveWorkout,
  selectCustomRoutines,
  selectHistory,
  selectProfile,
  useAppStore,
} from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, Card, CoverImage, IconButton, ProgressBar, SectionHeader } from '../../components/ui';
import { coverForRoutine } from '../../data/covers';
import { nextProgramRoutine, profileCompletion, programRoutines } from '../../core/utils/program';
import { isGoogleSignInAvailable } from '../../core/services/googleAuth';
import { RoutineCard } from '../routines/RoutineCard';
import { TabScreen } from '../../components/layout/TabScreen';
import { HeaderActions } from '../../components/layout/HeaderActions';
import { MacroSummary } from '../nutrition/MacroSummary';
import { startRoutineWorkout } from '../workout/startWorkout';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const COACH_PROMPTS = [
  'Armame una rutina de 30 minutos',
  '¿Cómo mejoro mi press de banca?',
  '¿Qué como antes de entrenar?',
];

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buenos días';
  if (hour < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

export function HomeScreen() {
  const profile = useAppStore(selectProfile);
  const history = useAppStore(selectHistory);
  const activeWorkout = useAppStore(selectActiveWorkout);
  const customRoutines = useAppStore(selectCustomRoutines);
  const program = useMemo(() => programRoutines(customRoutines), [customRoutines]);
  const nextDay = useMemo(() => nextProgramRoutine(program, history), [program, history]);
  const completion = profileCompletion(profile, program.length > 0, isGoogleSignInAvailable);

  const plan = useMemo(() => calculateNutritionPlan(profile), [profile]);
  const week = useMemo(() => trainedDaysThisWeek(history), [history]);
  const streak = useMemo(() => weekStreak(history), [history]);
  const todayIndex = (new Date().getDay() + 6) % 7;
  const trainedThisWeek = week.filter(Boolean).length;

  const suggestion = useMemo(() => {
    const recentBodyParts = history
      .slice(0, 2)
      .flatMap((session) => session.exercises.map((log) => getExercise(log.exerciseId)?.bodyPart ?? ''));
    return generateRoutine({ focus: suggestFocus(recentBodyParts), profile, title: undefined });
  }, [history, profile]);

  const lastSession = history[0];
  const firstName = profile.name.trim().split(/\s+/)[0];

  // Drafts must exist before any card navigates to them.
  useEffect(() => {
    registerDraftRoutine(suggestion);
  }, [suggestion]);

  const openSuggestion = () => {
    router.push({ pathname: '/routine/[id]', params: { id: suggestion.id } });
  };

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="subhead" color="textMuted">
              {greeting()}
            </AppText>
            <AppText variant="largeTitle" numberOfLines={1}>
              {firstName ? `Hola, ${firstName}` : 'Hola'}
            </AppText>
          </View>
          <HeaderActions />
        </View>

        <View style={styles.body}>
          <Card>
            <View style={styles.rowBetween}>
              <AppText variant="headline">Tu semana</AppText>
              <View style={styles.streak}>
                <Ionicons name="flame" size={16} color={streak > 0 ? theme.colors.primary : theme.colors.textMuted} />
                <AppText variant="subhead" color={streak > 0 ? 'primary' : 'textMuted'} style={styles.bold}>
                  {streak > 0 ? `${streak} ${streak === 1 ? 'semana' : 'semanas'}` : 'Empieza tu racha hoy'}
                </AppText>
              </View>
            </View>
            <View style={styles.week}>
              {WEEKDAYS.map((day, index) => {
                const trained = week[index];
                const isToday = index === todayIndex;
                return (
                  <View key={day} style={styles.day} accessible accessibilityLabel={`${day}${trained ? ', entrenado' : ''}${isToday ? ', hoy' : ''}`}>
                    <AppText variant="caption" color={isToday ? 'text' : 'textMuted'} style={isToday && styles.bold}>
                      {day}
                    </AppText>
                    <View style={[styles.dayDot, trained && styles.dayDotDone, isToday && !trained && styles.dayDotToday]}>
                      {trained && <Ionicons name="checkmark" size={14} color={theme.colors.onPrimary} />}
                    </View>
                  </View>
                );
              })}
            </View>
            <AppText variant="caption" color="textSecondary">
              {trainedThisWeek === 0
                ? 'Aún no entrenaste esta semana. ¡Hoy es buen día!'
                : `${trainedThisWeek} ${trainedThisWeek === 1 ? 'sesión' : 'sesiones'} esta semana. Objetivo: 3–5.`}
            </AppText>
          </Card>

          {!activeWorkout && nextDay && (
            <View>
              <SectionHeader title="Hoy toca" actionLabel="Ver programa" onAction={() => router.navigate('/train')} />
              <RoutineCard routine={nextDay} profile={profile} onStart={startRoutineWorkout} highlight={`Día ${nextDay.programDay} de ${program.length}`} />
            </View>
          )}

          {!activeWorkout && !nextDay && suggestion.exercises.length > 0 && (
            <View>
              <SectionHeader title="Sugerido para hoy" actionLabel="Crear mi programa" onAction={() => router.push('/program')} />
              <Card padding={0} onPress={openSuggestion} accessibilityLabel={`Rutina sugerida ${suggestion.title}`}>
                <CoverImage source={coverForRoutine(suggestion)} height={150}>
                  <AppText variant="title" style={styles.onImage}>
                    {suggestion.title}
                  </AppText>
                  <AppText variant="caption" style={styles.onImageMuted}>
                    {suggestion.exercises.length} ejercicios · ~{estimateMinutes(suggestion.exercises)} min ·{' '}
                    {suggestion.targetLocation === 'home' ? 'En casa' : 'Gimnasio'}
                  </AppText>
                </CoverImage>
                <View style={styles.cardPad}>
                  <Button
                    label="Empezar ahora"
                    icon="play"
                    size="lg"
                    fullWidth
                    onPress={() => {
                      registerDraftRoutine(suggestion);
                      startRoutineWorkout(suggestion);
                    }}
                  />
                </View>
              </Card>
            </View>
          )}

          <Card>
            <View style={styles.coachHead}>
              <View style={styles.coachIcon}>
                <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="headline">Coach IA</AppText>
                <AppText variant="caption" color="textMuted">
                  Conoce tus datos, tu equipo y tu historial
                </AppText>
              </View>
            </View>
            <View style={styles.prompts}>
              {COACH_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  accessibilityRole="button"
                  onPress={() => {
                    FeedbackService.selection();
                    router.push({ pathname: '/coach', params: { prompt } });
                  }}
                  style={({ pressed }) => [styles.prompt, pressed && styles.promptPressed]}
                >
                  <AppText variant="subhead" style={styles.flex} numberOfLines={1}>
                    {prompt}
                  </AppText>
                  <Ionicons name="arrow-up-circle" size={20} color={theme.colors.primary} />
                </Pressable>
              ))}
            </View>
          </Card>

          <Card onPress={() => router.navigate('/nutrition')} accessibilityLabel="Ver nutrición">
            <View style={styles.rowBetween}>
              <AppText variant="headline">Nutrición de hoy</AppText>
              <AppText variant="headline" color="primary" style={styles.tabular}>
                {plan.targetCalories.toLocaleString('es-ES')} kcal
              </AppText>
            </View>
            <View style={styles.macros}>
              <MacroSummary plan={plan} compact />
            </View>
          </Card>

          {completion.percent < 100 && !profile.profileNudgeDismissed && (
            // The close button sits outside the pressable area so screen readers reach both.
            <Card padding={0} style={styles.nudge}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Tu perfil está al ${completion.percent}%. Completar perfil`}
                onPress={() => {
                  FeedbackService.selection();
                  router.push(completion.missing[0]?.key === 'program' ? '/program' : '/profile');
                }}
                style={({ pressed }) => [styles.nudgeMain, pressed && styles.promptPressed]}
              >
                <AppText variant="callout" style={styles.bold}>
                  Tu perfil está al {completion.percent}%
                </AppText>
                <View style={styles.completionBar}>
                  <ProgressBar value={completion.percent / 100} />
                </View>
                <AppText variant="caption" color="textSecondary">
                  Siguiente: {completion.missing[0]?.label}. Cuanto más completo, más preciso tu plan.
                </AppText>
              </Pressable>
              <IconButton
                icon="close"
                size={32}
                iconSize={16}
                onPress={() => appActions.patchProfile({ profileNudgeDismissed: true })}
                accessibilityLabel="Ocultar el aviso del perfil"
                style={styles.nudgeClose}
              />
            </Card>
          )}

          {lastSession && (
            <Card onPress={() => router.navigate('/progress')} accessibilityLabel="Ver progreso">
              <AppText variant="caption" color="textMuted">
                Último entrenamiento · {formatRelativeDate(sessionDate(lastSession))}
              </AppText>
              <AppText variant="headline" numberOfLines={1} style={styles.lastTitle}>
                {lastSession.title}
              </AppText>
              <View style={styles.lastStats}>
                <LastStat icon="time-outline" value={formatMinutes(lastSession.durationSeconds)} />
                <LastStat icon="barbell-outline" value={formatVolume(lastSession.totalVolumeKg)} />
                <LastStat icon="checkmark-done-outline" value={pluralize(countCompletedSets(lastSession.exercises), 'serie')} />
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </TabScreen>
  );
}

function LastStat({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: string }) {
  return (
    <View style={styles.lastStat}>
      <Ionicons name={icon} size={14} color={theme.colors.textMuted} />
      <AppText variant="subhead" color="textSecondary">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: theme.spacing.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: theme.spacing.lg,
  },
  day: {
    alignItems: 'center',
    gap: 6,
  },
  dayDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDotDone: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dayDotToday: {
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
  onImage: {
    color: '#FFFFFF',
  },
  onImageMuted: {
    color: 'rgba(255,255,255,0.78)',
  },
  cardPad: {
    padding: theme.spacing.lg,
  },
  completionBar: {
    marginVertical: theme.spacing.md,
  },
  nudge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  nudgeMain: {
    flex: 1,
    padding: theme.spacing.lg,
    paddingRight: 0,
    borderRadius: theme.radius.lg,
  },
  nudgeClose: {
    marginTop: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  thumbs: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: theme.spacing.lg,
  },
  coachHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  coachIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prompts: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 46,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  promptPressed: {
    backgroundColor: theme.colors.surfacePressed,
  },
  macros: {
    marginTop: theme.spacing.lg,
  },
  lastTitle: {
    marginTop: 2,
  },
  lastStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  lastStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
