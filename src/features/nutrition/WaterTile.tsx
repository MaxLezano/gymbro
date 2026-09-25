import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { localDateKey } from '../../core/services/coach/mealPlan';
import { addWater, GLASS_ML, logFor } from '../../core/utils/dailyLog';
import { FeedbackService } from '../../core/services/feedback';
import { appActions, selectProfile, useAppStore } from '../../state/appStore';
import { AppText } from '../../components/ui';

const liters = (ml: number) => (ml / 1000).toLocaleString('es-ES', { maximumFractionDigits: 2 });

/** Daily water goal with a one-tap glass counter; the count starts at zero every day. */
export function WaterTile({ goalLiters }: { goalLiters: number }) {
  const profile = useAppStore(selectProfile);
  const log = logFor(profile, localDateKey());
  const goalMl = goalLiters * 1000;
  const done = log.waterMl >= goalMl;

  const change = (ml: number) => {
    const next = addWater(log, ml);
    if (next.waterMl === log.waterMl) return;
    if (ml > 0 && next.waterMl >= goalMl && log.waterMl < goalMl) FeedbackService.success();
    else FeedbackService.lightTap();
    appActions.patchProfile({ todayLog: next });
  };

  return (
    <View style={styles.tile}>
      <View style={styles.labelRow}>
        <Ionicons name={done ? 'water' : 'water-outline'} size={14} color={theme.colors.info} />
        <AppText variant="caption" color="textMuted">
          Agua
        </AppText>
      </View>
      <View style={styles.valueRow} accessible accessibilityLabel={`Agua: ${liters(log.waterMl)} de ${liters(goalMl)} litros`}>
        <AppText variant="title" style={styles.tabular}>
          {liters(log.waterMl)}
        </AppText>
        <AppText variant="subhead" color="textMuted">
          / {liters(goalMl)} L
        </AppText>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, Math.round((log.waterMl / goalMl) * 100))}%` }]} />
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quitar un vaso"
          disabled={log.waterMl === 0}
          hitSlop={6}
          onPress={() => change(-GLASS_ML)}
          style={({ pressed }) => [styles.minus, pressed && styles.pressed, log.waterMl === 0 && styles.disabled]}
        >
          <Ionicons name="remove" size={18} color={theme.colors.textSecondary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sumar un vaso de 250 mililitros"
          onPress={() => change(GLASS_ML)}
          style={({ pressed }) => [styles.plus, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={16} color={theme.colors.info} />
          <AppText variant="caption" style={styles.plusLabel}>
            Vaso
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfacePressed,
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: theme.colors.info,
  },
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  minus: {
    width: 36,
    height: 32,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  plus: {
    flex: 1,
    height: 32,
    borderRadius: theme.radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.surfaceAlt,
  },
  plusLabel: {
    color: theme.colors.info,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
