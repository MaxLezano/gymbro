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

const trainingId = (weekday: number) => `training-${weekday}`;
const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** Sensible default days for a weekly frequency (expo weekdays: 1 = Sunday). */
export function defaultTrainingDays(daysPerWeek: number): number[] {
  const byCount: Record<number, number[]> = {
    1: [2],
    2: [2, 5],
    3: [2, 4, 6],
    4: [2, 3, 5, 6],
    5: [2, 3, 4, 5, 6],
    6: [2, 3, 4, 5, 6, 7],
  };
  return byCount[Math.max(1, Math.min(6, Math.round(daysPerWeek)))];
}

export const Reminders = {
  /** One weekly notification per chosen day; an empty list turns them all off. */
  async setTraining(weekdays: number[], hour: number, minute: number): Promise<boolean> {
    await Promise.all(ALL_WEEKDAYS.map((day) => Notifications.cancelScheduledNotificationAsync(trainingId(day)).catch(() => undefined)));
    if (weekdays.length === 0) return true;
    if (!(await allowReminders())) return false;
    await ensureChannel();
    for (const weekday of weekdays) {
      await Notifications.scheduleNotificationAsync({
        identifier: trainingId(weekday),
        content: { title: 'Hoy toca entrenar', body: 'Tu próxima sesión te espera en GymBro.', data: { url: '/train' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, channelId: CHANNEL_ID },
      });
    }
    return true;
  },

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
