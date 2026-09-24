import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { useNow } from '../../core/hooks/useNow';
import { countCompletedSets, countTotalSets, formatDuration } from '../../core/utils/workout';
import { selectActiveWorkout, selectRestTimer, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, ProgressBar } from '../ui';

function RestCountdown({ endsAt }: { endsAt: number }) {
  const now = useNow(500);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return (
    <AppText variant="caption" color={remaining === 0 ? 'success' : 'primary'} style={styles.restText}>
      {remaining === 0 ? 'Descanso terminado' : `Descanso ${formatDuration(remaining)}`}
    </AppText>
  );
}

function ElapsedClock({ startedAt }: { startedAt: number }) {
  const now = useNow();
  return (
    <AppText variant="subhead" color="primary" style={styles.clock}>
      {formatDuration((now - startedAt) / 1000)}
    </AppText>
  );
}

/** Persistent "now playing" style bar shown above the tab bar during a workout. */
export function WorkoutMiniBar() {
  const session = useAppStore(selectActiveWorkout);
  const rest = useAppStore(selectRestTimer);
  if (!session) return null;

  const done = countCompletedSets(session.exercises);
  const total = countTotalSets(session.exercises);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Volver al entrenamiento ${session.title}`}
      onPress={() => {
        FeedbackService.lightTap();
        router.push('/workout');
      }}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.liveDot} />
        <View style={styles.texts}>
          <AppText variant="callout" numberOfLines={1} style={styles.title}>
            {session.title}
          </AppText>
          {rest ? (
            <RestCountdown endsAt={rest.endsAt} />
          ) : (
            <AppText variant="caption" color="textMuted">
              {done} de {total} series
            </AppText>
          )}
        </View>
        <ElapsedClock startedAt={session.startedAt} />
        <Ionicons name="chevron-up" size={20} color={theme.colors.textSecondary} />
      </View>
      <ProgressBar value={total ? done / total : 0} height={3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
    ...theme.shadows.raised,
  },
  pressed: {
    backgroundColor: theme.colors.surfacePressed,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  texts: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
  restText: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  clock: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
