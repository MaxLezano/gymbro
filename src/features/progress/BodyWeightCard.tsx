import React, { useState } from 'react';
import { Alert, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { localDateKey } from '../../core/services/coach/mealPlan';
import { Reminders } from '../../core/services/reminders';
import { FeedbackService } from '../../core/services/feedback';
import { recordWeight, weighInDue, weightChange } from '../../core/utils/weightLog';
import { appActions, selectProfile, useAppStore } from '../../state/appStore';
import { AppText, Button, Card, SectionHeader } from '../../components/ui';
import { WeightChart } from './WeightChart';

const signed = (kg: number) => `${kg > 0 ? '+' : ''}${kg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;

/** Weigh-ins, their trend and an optional Monday reminder. Logging also updates the profile weight. */
export function BodyWeightCard() {
  const profile = useAppStore(selectProfile);
  const log = profile.weightLog ?? [];
  const today = localDateKey();
  const [draft, setDraft] = useState(String(profile.weightKg));
  const change = weightChange(log, 28);
  const due = weighInDue(log, today);

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

  const toggleReminder = async (enabled: boolean) => {
    FeedbackService.selection();
    const ok = await Reminders.setWeighIn(enabled);
    if (!ok) {
      Alert.alert('Notificaciones desactivadas', 'Actívalas en los ajustes del teléfono para recibir el recordatorio.');
      return;
    }
    appActions.patchProfile({ weighInReminder: enabled });
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
        <View style={styles.inputBox}>
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
        <Button label={due ? 'Registrar hoy' : 'Actualizar hoy'} icon="checkmark" size="md" style={styles.flex} onPress={save} />
      </View>

      <View style={styles.reminder}>
        <View style={styles.flex}>
          <AppText variant="callout">Recordarme los lunes</AppText>
          <AppText variant="caption" color="textMuted">
            Aviso a las 8:00 para pesarte en ayunas
          </AppText>
        </View>
        <Switch
          value={!!profile.weighInReminder}
          onValueChange={toggleReminder}
          trackColor={{ true: theme.colors.primary, false: theme.colors.surfacePressed }}
          thumbColor={theme.colors.text}
          accessibilityLabel="Recordatorio semanal para pesarte"
        />
      </View>
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
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceAlt,
  },
  input: {
    minWidth: 56,
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    padding: 0,
  },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  flex: {
    flex: 1,
  },
});
