import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../core/theme';
import { useNow } from '../../core/hooks/useNow';
import { formatDuration } from '../../core/utils/workout';
import { AppText, Button, IconButton, ProgressBar } from '../../components/ui';

interface RestTimerProps {
  endsAt: number;
  totalSeconds: number;
  nextLabel?: string;
  onAdjust: (deltaSeconds: number) => void;
  onDismiss: () => void;
}

/**
 * Docked rest countdown. Driven by an absolute end timestamp, so it stays
 * accurate after the screen is minimized or the app was in background.
 * Alarm and auto-dismiss live in WorkoutBackgroundServices (app-wide).
 */
export function RestTimer({ endsAt, totalSeconds, nextLabel, onAdjust, onDismiss }: RestTimerProps) {
  const now = useNow(250);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const finished = remaining === 0;

  return (
    <View style={[styles.container, finished && styles.finished]} accessibilityLiveRegion="polite">
      <View style={styles.row}>
        <View style={styles.texts}>
          <AppText variant="caption" color={finished ? 'success' : 'textMuted'} style={styles.label}>
            {finished ? '¡Descanso terminado!' : 'Descanso'}
          </AppText>
          <AppText variant="metric" style={{ color: finished ? theme.colors.success : theme.colors.text }}>
            {formatDuration(remaining)}
          </AppText>
          {nextLabel && (
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              Siguiente: {nextLabel}
            </AppText>
          )}
        </View>
        {!finished && (
          <View style={styles.controls}>
            <IconButton icon="remove" variant="filled" size={42} onPress={() => onAdjust(-15)} accessibilityLabel="Restar 15 segundos" />
            <IconButton icon="add" variant="filled" size={42} onPress={() => onAdjust(15)} accessibilityLabel="Sumar 15 segundos" />
          </View>
        )}
        <Button label={finished ? 'Listo' : 'Saltar'} variant={finished ? 'primary' : 'secondary'} size="md" onPress={onDismiss} style={styles.center} />
      </View>
      <ProgressBar
        value={totalSeconds > 0 ? remaining / totalSeconds : 0}
        height={4}
        color={finished ? theme.colors.success : theme.colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
    ...theme.shadows.raised,
  },
  finished: {
    borderColor: 'rgba(50, 215, 75, 0.45)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  texts: {
    flex: 1,
  },
  label: {
    fontWeight: '700',
  },
  center: {
    alignSelf: 'center',
  },
  controls: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
});
