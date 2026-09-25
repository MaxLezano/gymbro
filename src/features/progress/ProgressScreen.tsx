import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { labelBodyPart } from '../../core/i18n/labels';
import {
  countCompletedSets,
  formatMinutes,
  formatRelativeDate,
  formatVolume,
  logDisplayName,
  personalRecords,
  pluralize,
  sessionDate,
  setsByBodyPart,
  weekStreak,
  weeklyVolume,
} from '../../core/utils/workout';
import type { WorkoutSession } from '../../core/types';
import { appActions, selectHistory, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Card, EmptyState, ProgressBar, ScreenHeader, SectionHeader, StatTile } from '../../components/ui';
import { TabScreen } from '../../components/layout/TabScreen';
import { HeaderActions } from '../../components/layout/HeaderActions';
import { BarChart, Sparkline } from './Charts';
import { BodyWeightCard } from './BodyWeightCard';
import { DeloadCard } from './DeloadCard';
import { suggestDeload } from '../../core/utils/deload';

/** Weekly hard-set landmarks per muscle group (Schoenfeld 2017; Israetel MEV-MRV). */
const WEEKLY_SET_TARGET = { min: 10, max: 20 };

function SessionCard({ session }: { session: WorkoutSession }) {
  const [open, setOpen] = useState(false);
  const sets = countCompletedSets(session.exercises);

  const askDelete = () => {
    FeedbackService.mediumTap();
    Alert.alert('Eliminar sesión', `¿Borrar "${session.title}" del historial?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => appActions.deleteSession(session.id) },
    ]);
  };

  return (
    <Card padding={0}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint="Mantén presionado para eliminar"
        onPress={() => {
          FeedbackService.selection();
          setOpen((value) => !value);
        }}
        onLongPress={askDelete}
        style={({ pressed }) => [styles.sessionHeader, pressed && { backgroundColor: theme.colors.surfaceAlt }]}
      >
        <View style={styles.sessionTexts}>
          <AppText variant="callout" style={styles.bold} numberOfLines={1}>
            {session.title}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {formatRelativeDate(sessionDate(session))} · {formatMinutes(session.durationSeconds)} · {pluralize(sets, 'serie')} · {formatVolume(session.totalVolumeKg)}
          </AppText>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.sessionBody}>
          {session.exercises.map((log, index) => (
            <View key={`${log.exerciseId}_${index}`} style={styles.sessionExercise}>
              <AppText variant="subhead" style={styles.bold} numberOfLines={1}>
                {logDisplayName(log)}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {log.sets.filter((set) => set.completed).map((set) => `${set.weightKg > 0 ? `${set.weightKg} kg` : 'PC'} × ${set.reps}`).join('   ')}
              </AppText>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

export function ProgressScreen() {
  const history = useAppStore(selectHistory);
  const [showAll, setShowAll] = useState(false);

  const data = useMemo(() => {
    const weeks = weeklyVolume(history, 8);
    const thisWeek = weeks[weeks.length - 1].weekStart;
    return {
      weeks: weeks.map((week, index) => ({
        label:
          index === weeks.length - 1
            ? 'Actual'
            : new Date(week.weekStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'numeric' }),
        value: week.volumeKg,
        highlight: week.weekStart === thisWeek,
      })),
      sessionsThisWeek: weeks[weeks.length - 1]?.sessions ?? 0,
      muscles: setsByBodyPart(history, thisWeek),
      records: personalRecords(history).slice(0, 6),
      streak: weekStreak(history),
      totalVolume: history.reduce((sum, session) => sum + (session.totalVolumeKg || 0), 0),
    };
  }, [history]);

  const snoozedAt = useAppStore((s) => s.profile.deloadSnoozedAt);
  const deload = useMemo(() => suggestDeload(history, { snoozedAt }), [history, snoozedAt]);

  const visibleSessions = showAll ? history : history.slice(0, 5);

  return (
    <TabScreen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Progreso" subtitle="Tu sobrecarga progresiva, semana a semana" right={<HeaderActions />} />

        {/* Body weight does not depend on workouts: it shows even before the first session. */}
        <View style={[styles.body, styles.weight]}>
          <BodyWeightCard />
        </View>

        {history.length === 0 ? (
          <EmptyState
            icon="stats-chart-outline"
            title="Tu progreso empieza hoy"
            message="Completa tu primer entrenamiento y aquí verás volumen, récords y tendencias."
            actionLabel="Ir a entrenar"
            onAction={() => router.navigate('/train')}
          />
        ) : (
          <View style={styles.body}>
            {deload && <DeloadCard suggestion={deload} />}
            <View style={styles.statsRow}>
              <StatTile label="Racha" value={data.streak} unit={data.streak === 1 ? 'semana' : 'semanas'} icon="flame-outline" />
              <StatTile label="Esta semana" value={data.sessionsThisWeek} unit={data.sessionsThisWeek === 1 ? 'sesión' : 'sesiones'} icon="calendar-outline" />
            </View>
            <View style={styles.statsRow}>
              <StatTile label="Sesiones" value={history.length} icon="checkmark-done-outline" />
              <StatTile label="Volumen total" value={formatVolume(data.totalVolume)} icon="barbell-outline" />
            </View>

            <Card>
              <SectionHeader title="Volumen semanal" />
              <BarChart data={data.weeks} formatValue={formatVolume} />
            </Card>

            <Card>
              <SectionHeader title="Series por grupo muscular" />
              <AppText variant="caption" color="textMuted" style={styles.cardHint}>
                Esta semana. Rango óptimo para hipertrofia: {WEEKLY_SET_TARGET.min}–{WEEKLY_SET_TARGET.max} series.
              </AppText>
              {data.muscles.length === 0 ? (
                <AppText variant="subhead" color="textSecondary">
                  Aún no entrenaste esta semana.
                </AppText>
              ) : (
                <View style={styles.muscles}>
                  {data.muscles.map((item) => {
                    const inRange = item.sets >= WEEKLY_SET_TARGET.min;
                    return (
                      <View key={item.bodyPart} style={styles.muscleRow}>
                        <View style={styles.muscleTop}>
                          <AppText variant="subhead" style={styles.bold}>
                            {labelBodyPart(item.bodyPart)}
                          </AppText>
                          <AppText variant="caption" color={inRange ? 'success' : 'textSecondary'} style={styles.bold}>
                            {pluralize(item.sets, 'serie')}
                          </AppText>
                        </View>
                        <ProgressBar
                          value={item.sets / WEEKLY_SET_TARGET.max}
                          color={inRange ? theme.colors.success : theme.colors.primary}
                        />
                      </View>
                    );
                  })}
                </View>
              )}
            </Card>

            {data.records.length > 0 && (
              <Card padding={0}>
                <View style={styles.cardPadded}>
                  <SectionHeader title="Récords (1RM estimado)" style={styles.noMargin} />
                </View>
                {data.records.map((record) => (
                  <Pressable
                    key={record.exerciseId}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: record.exerciseId } })}
                    style={({ pressed }) => [styles.recordRow, pressed && { backgroundColor: theme.colors.surfaceAlt }]}
                  >
                    <View style={styles.flex}>
                      <AppText variant="callout" style={styles.bold} numberOfLines={1}>
                        {record.exerciseName}
                      </AppText>
                      <AppText variant="caption" color="textMuted">
                        Mejor serie {record.bestWeightKg} kg × {record.bestReps} · {formatRelativeDate(record.achievedAt)}
                      </AppText>
                    </View>
                    <Sparkline values={record.trend.map((point) => point.oneRepMax)} />
                    <AppText variant="headline" color="primary" style={styles.recordValue}>
                      {record.bestOneRepMax}
                      <AppText variant="caption" color="textMuted">
                        {' '}kg
                      </AppText>
                    </AppText>
                  </Pressable>
                ))}
              </Card>
            )}

            <View>
              <SectionHeader
                title="Historial"
                actionLabel={history.length > 5 ? (showAll ? 'Ver menos' : `Ver todo (${history.length})`) : undefined}
                onAction={() => setShowAll((value) => !value)}
              />
              <View style={styles.sessions}>
                {visibleSessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: theme.spacing.xxxl,
  },
  body: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  weight: {
    marginBottom: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  cardHint: {
    marginTop: -theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  muscles: {
    gap: theme.spacing.md,
  },
  muscleRow: {
    gap: 6,
  },
  muscleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardPadded: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  noMargin: {
    marginBottom: 0,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  recordValue: {
    minWidth: 64,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  sessions: {
    gap: theme.spacing.sm,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
  },
  sessionTexts: {
    flex: 1,
    gap: 2,
  },
  sessionBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sessionExercise: {
    gap: 2,
  },
  bold: {
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
});
