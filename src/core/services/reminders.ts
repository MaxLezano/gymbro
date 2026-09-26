import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { MAX_WATER_SLOTS, waterHours, type WaterSchedule } from '../utils/waterSchedule';

export { waterHours, type WaterSchedule };

const CHANNEL_ID = 'reminders';
const WEIGH_IN_ID = 'weigh-in';
const trainingId = (weekday: number) => `training-${weekday}`;
const waterId = (slot: number) => `water-${slot}`;
const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** expo-notifications weekdays: 1 = Sunday ... 7 = Saturday. */
export interface TrainingSchedule {
  days: number[];
  hour: number;
  minute: number;
}
export interface WeighInSchedule {
  day: number;
  hour: number;
  minute: number;
}

export const DEFAULT_WEIGH_IN: WeighInSchedule = { day: 2, hour: 8, minute: 0 };
export const DEFAULT_WATER: WaterSchedule = { everyHours: 2, fromHour: 9, toHour: 21 };

/** 'denied': notifications blocked in the phone settings; 'error': the phone refused to schedule. */
export type ReminderResult = 'ok' | 'denied' | 'error';

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Recordatorios',
    description: 'Entrenar, pesarte y tomar agua',
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => undefined);
}

/** Asks only when the athlete turns a reminder on. */
async function allowReminders(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

const cancel = (ids: string[]) => Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));

/** Cancels the old notifications, then schedules the new ones; never throws. */
async function replace(ids: string[], schedule: (() => Promise<void>) | null): Promise<ReminderResult> {
  try {
    await cancel(ids);
    if (!schedule) return 'ok';
    if (!(await allowReminders())) return 'denied';
    await ensureChannel();
    await schedule();
    return 'ok';
  } catch {
    await cancel(ids);
    return 'error';
  }
}

/** Sensible default days for a weekly frequency. */
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
  /** One weekly notification per chosen day; null turns them off. */
  setTraining(schedule: TrainingSchedule | null): Promise<ReminderResult> {
    return replace(
      ALL_WEEKDAYS.map(trainingId),
      schedule && schedule.days.length > 0
        ? async () => {
            for (const weekday of schedule.days) {
              await Notifications.scheduleNotificationAsync({
                identifier: trainingId(weekday),
                content: { title: 'Hoy toca entrenar', body: 'Tu próxima sesión te espera en GymBro.', data: { url: '/train' } },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour: schedule.hour, minute: schedule.minute, channelId: CHANNEL_ID },
              });
            }
          }
        : null
    );
  },

  setWeighIn(schedule: WeighInSchedule | null): Promise<ReminderResult> {
    return replace(
      [WEIGH_IN_ID],
      schedule
        ? async () => {
            await Notifications.scheduleNotificationAsync({
              identifier: WEIGH_IN_ID,
              content: {
                title: 'Hora de pesarte',
                body: 'En ayunas y después del baño: así el gráfico compara igual con igual.',
                data: { url: '/progress' },
              },
              trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: schedule.day, hour: schedule.hour, minute: schedule.minute, channelId: CHANNEL_ID },
            });
          }
        : null
    );
  },

  setWater(schedule: WaterSchedule | null): Promise<ReminderResult> {
    return replace(
      Array.from({ length: MAX_WATER_SLOTS }, (_, slot) => waterId(slot)),
      schedule
        ? async () => {
            const hours = waterHours(schedule);
            for (let slot = 0; slot < hours.length; slot += 1) {
              await Notifications.scheduleNotificationAsync({
                identifier: waterId(slot),
                content: { title: 'Un vaso de agua', body: 'Suma un vaso en GymBro para seguir tu meta del día.', data: { url: '/nutrition' } },
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hours[slot], minute: 0, channelId: CHANNEL_ID },
              });
            }
          }
        : null
    );
  },
};
