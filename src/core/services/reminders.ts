import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'reminders';
const WEIGH_IN_ID = 'weigh-in';

/** expo-notifications weekdays: 1 = Sunday ... 7 = Saturday. */
const MONDAY = 2;

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recordatorios',
    description: 'Pesarte cada semana y los días de entrenamiento',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => undefined);
}

/** Asks only when the athlete turns a reminder on; false when notifications are blocked. */
export async function allowReminders(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export const Reminders = {
  /** Monday 8:00, every week. Scheduling again replaces it (fixed id). */
  async setWeighIn(enabled: boolean): Promise<boolean> {
    await Notifications.cancelScheduledNotificationAsync(WEIGH_IN_ID).catch(() => undefined);
    if (!enabled) return true;
    if (!(await allowReminders())) return false;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: WEIGH_IN_ID,
      content: {
        title: 'Hora de pesarte',
        body: 'En ayunas y después del baño: así el gráfico compara igual con igual.',
        data: { url: '/progress' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: MONDAY, hour: 8, minute: 0, channelId: CHANNEL_ID },
    });
    return true;
  },
};
