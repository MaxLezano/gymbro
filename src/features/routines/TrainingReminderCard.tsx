import React from 'react';
import { StyleSheet } from 'react-native';
import { theme } from '../../core/theme';
import { selectProfile, useAppStore } from '../../state/appStore';
import { Card } from '../../components/ui';
import { ReminderLink } from '../reminders/ReminderLink';

const clock = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/** Status of the training reminders under the weekly program; set up in the Notifications screen. */
export function TrainingReminderCard() {
  const reminder = useAppStore(selectProfile).trainingReminder;
  const on = !!reminder && reminder.days.length > 0;
  const label = on
    ? `Te aviso ${reminder!.days.length} ${reminder!.days.length === 1 ? 'día' : 'días'} por semana a las ${clock(reminder!.hour, reminder!.minute)}`
    : 'Recordarme los días de entrenamiento';
  return (
    <Card style={styles.card}>
      <ReminderLink label={label} active={on} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
});
