import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { localDateKey } from '../../core/services/coach/mealPlan';
import { DEFAULT_WEIGH_IN } from '../../core/services/reminders';
import { ReminderLink } from '../reminders/ReminderLink';
import { FeedbackService } from '../../core/services/feedback';
import { recordWeight, weighInDue, weightChange } from '../../core/utils/weightLog';
import { appActions, selectProfile, useAppStore } from '../../state/appStore';
import { AppText, Button, Card, SectionHeader } from '../../components/ui';
import { WeightChart } from './WeightChart';

const DAY_NAMES: Record<number, string> = { 1: 'domingos', 2: 'lunes', 3: 'martes', 4: 'miércoles', 5: 'jueves', 6: 'viernes', 7: 'sábados' };

const signed = (kg: number) => `${kg > 0 ? '+' : ''}${kg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;

/** Weigh-ins, their trend and an optional Monday reminder. Logging also updates the profile weight. */
export function BodyWeightCard() {
  const profile = useAppStore(selectProfile);
  const log = profile.weightLog ?? [];
  const today = localDateKey();
  // Always one decimal with a comma, as a scale reads ("92,0").
  const format = (kg: number) => kg.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const [draft, setDraft] = useState(() => format(profile.weightKg));
  const nudge = (delta: number) => {
    const current = Number(draft.replace(',', '.'));
    const next = Math.round(((Number.isFinite(current) ? current : profile.weightKg) + delta) * 10) / 10;
    FeedbackService.lightTap();
    setDraft(format(Math.min(300, Math.max(30, next))));
  };
  const change = weightChange(log, 28);
  const due = weighInDue(log, today);
  const schedule = profile.weighInSchedule ?? DEFAULT_WEIGH_IN;
  const reminderLabel = profile.weighInReminder
    ? `Recordatorio: los ${DAY_NAMES[schedule.day]} a las ${String(schedule.hour).padStart(2, '0')}:${String(schedule.minute).padStart(2, '0')}`
    : 'Recordarme pesarme cada semana';

  const save = () => {
    const kg = Number(draft.replace(',', '.'));
    if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
      FeedbackService.warning();
      Alert.alert('Peso no válido', 'Escribe tu peso en kilos, por ejemplo 78,5.');
      return;
    }
    FeedbackService.success();
    // The profile weight drives calories and macros: it follows the latest weigh-in.
    appActions.patchProfile({ weightKg: Math.round(kg * 10) / 10, weightLog: recordWeight(log, today, kg) });
  };

  return (
    <Card>
      <SectionHeader title="Peso corporal" />
      {log.length >= 2 ? (
        <WeightChart entries={log} />
      ) : (
        <AppText variant="subhead" color="textSecondary">
          Pésate una vez por semana, siempre en las mismas condiciones. Con dos registros verás tu evolución aquí.
        </AppText>
      )}
      {change && (
        <View style={styles.change}>
          <Ionicons name={change.kg < 0 ? 'trending-down' : change.kg > 0 ? 'trending-up' : 'remove'} size={16} color={theme.colors.textSecondary} />
          <AppText variant="caption" color="textSecondary">
            {signed(change.kg)} en {change.days} {change.days === 1 ? 'día' : 'días'}
          </AppText>
        </View>
      )}

      <View style={styles.entry}>
        <View style={styles.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="Restar 100 gramos" onPress={() => nudge(-0.1)} hitSlop={6} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
            <Ionicons name="remove" size={18} color={theme.colors.text} />
          </Pressable>
          <View style={styles.valueBox}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              keyboardType="decimal-pad"
              maxLength={5}
              selectTextOnFocus
              style={styles.input}
              accessibilityLabel="Peso de hoy en kilos"
              selectionColor={theme.colors.primary}
            />
            <AppText variant="subhead" color="textMuted">
              kg
            </AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Sumar 100 gramos" onPress={() => nudge(0.1)} hitSlop={6} style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}>
            <Ionicons name="add" size={18} color={theme.colors.text} />
          </Pressable>
        </View>
        <Button label={due ? 'Registrar' : 'Actualizar'} icon="checkmark" variant="tonal" size="sm" onPress={save} />
      </View>

      <ReminderLink label={reminderLabel} active={!!profile.weighInReminder} style={styles.reminder} />
    </Card>
  );
}

const styles = StyleSheet.create({
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: 'hidden',
  },
  stepButton: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    backgroundColor: theme.colors.surfacePressed,
  },
  valueBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 4,
  },
  input: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
    padding: 0,
    minWidth: 44,
  },
  reminder: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  flex: {
    flex: 1,
  },
});
