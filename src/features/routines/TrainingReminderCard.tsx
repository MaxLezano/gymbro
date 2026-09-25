import React from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { theme } from '../../core/theme';
import { defaultTrainingDays, Reminders } from '../../core/services/reminders';
import { FeedbackService } from '../../core/services/feedback';
import { appActions, selectProfile, useAppStore } from '../../state/appStore';
import { AppText, Card, Chip } from '../../components/ui';

/** Monday first, as a Spanish week reads; values are expo weekdays (1 = Sunday). */
const WEEK: { day: number; label: string; name: string }[] = [
  { day: 2, label: 'L', name: 'lunes' },
  { day: 3, label: 'M', name: 'martes' },
  { day: 4, label: 'X', name: 'miércoles' },
  { day: 5, label: 'J', name: 'jueves' },
  { day: 6, label: 'V', name: 'viernes' },
  { day: 7, label: 'S', name: 'sábado' },
  { day: 1, label: 'D', name: 'domingo' },
];
const HOURS = [7, 9, 12, 17, 19, 21];

/** Weekly training reminders on the days the athlete picks, at one time of day. */
export function TrainingReminderCard() {
  const profile = useAppStore(selectProfile);
  const reminder = profile.trainingReminder;
  const enabled = !!reminder && reminder.days.length > 0;
  const days = reminder?.days ?? defaultTrainingDays(profile.daysPerWeek ?? 3);
  const hour = reminder?.hour ?? 19;

  const apply = async (nextDays: number[], nextHour: number) => {
    const ok = await Reminders.setTraining(nextDays, nextHour, 0);
    if (!ok) {
      Alert.alert('Notificaciones desactivadas', 'Actívalas en los ajustes del teléfono para recibir los recordatorios.');
      return;
    }
    appActions.patchProfile({ trainingReminder: { days: nextDays, hour: nextHour, minute: 0 } });
  };

  const toggle = (on: boolean) => {
    FeedbackService.selection();
    apply(on ? days : [], hour);
  };

  const toggleDay = (day: number) => {
    FeedbackService.selection();
    const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day];
    apply(next, hour);
  };

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="callout">Recordarme entrenar</AppText>
          <AppText variant="caption" color="textMuted">
            {enabled ? `${days.length} ${days.length === 1 ? 'día' : 'días'} por semana a las ${hour}:00` : 'Un aviso los días que eliges'}
          </AppText>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ true: theme.colors.primary, false: theme.colors.surfacePressed }}
          thumbColor={theme.colors.text}
          accessibilityLabel="Recordatorios de entrenamiento"
        />
      </View>
      {enabled && (
        <View style={styles.options}>
          <View style={styles.days}>
            {WEEK.map((item) => {
              const on = days.includes(item.day);
              return (
                <Pressable
                  key={item.day}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={item.name}
                  onPress={() => toggleDay(item.day)}
                  style={[styles.day, on && styles.dayOn]}
                >
                  <AppText variant="callout" style={[styles.dayLabel, on && styles.dayLabelOn]}>
                    {item.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.hours}>
            {HOURS.map((item) => (
              <Chip key={item} size="sm" label={`${item}:00`} selected={item === hour} onPress={() => apply(days, item)} />
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  flex: {
    flex: 1,
  },
  options: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  dayOn: {
    backgroundColor: theme.colors.primary,
  },
  dayLabel: {
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  dayLabelOn: {
    color: theme.colors.onPrimary,
  },
  hours: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
});
