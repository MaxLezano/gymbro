import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'rest-timer';
let setupDone = false;
let permissionAsked = false;

/**
 * While the app is in the foreground the in-app timer already vibrates and
 * shows "Descanso terminado", so the OS notification only surfaces when the
 * app is minimized or the screen is off.
 */
function setup() {
  if (setupDone) return;
  setupDone = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const inForeground = AppState.currentState === 'active';
      return {
        shouldShowBanner: !inForeground,
        shouldShowList: !inForeground,
        shouldPlaySound: !inForeground,
        shouldSetBadge: false,
      };
    },
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Descanso entre series',
      description: 'Aviso cuando termina el descanso durante un entrenamiento',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 350, 150, 350, 150, 500],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    }).catch(() => undefined);
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  // Ask once, in context (the first time a rest starts), never on app launch.
  if (permissionAsked || !current.canAskAgain) return false;
  permissionAsked = true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Schedule/cancel run one at a time. Without this, a cancel that lands while a
// schedule is still awaiting the permission leaves an orphan alarm behind
// (e.g. deleting the account mid-rest, or tapping +15 s several times).
let queue: Promise<void> = Promise.resolve();
const enqueue = (task: () => Promise<void>) => {
  queue = queue.then(task, task);
  return queue;
};

/** Fixed id: scheduling again replaces the pending rest alarm instead of stacking another one. */
const REST_ID = 'rest-timer';

/** Rest alarms only: reminders (weigh-in, training days) live next to them and must survive. */
const isRest = (request: Notifications.NotificationRequest) =>
  // Older builds scheduled rest alarms with random ids; their payload still points at the workout.
  request.identifier === REST_ID || request.content.data?.url === '/workout';

async function clearAll() {
  const pending = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  await Promise.all(pending.filter(isRest).map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier).catch(() => undefined)));
}

async function dismissShown() {
  const shown = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  await Promise.all(
    shown.filter((notification) => isRest(notification.request)).map((notification) => Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => undefined))
  );
}

export const RestNotifications = {
  schedule(endsAt: number, nextLabel?: string) {
    return enqueue(async () => {
      try {
        setup();
        await clearAll();
        if (!(await ensurePermission())) return;
        // Measure after the permission dialog: the athlete may take a while to answer it.
        const seconds = Math.round((endsAt - Date.now()) / 1000);
        if (seconds < 2) return;
        await Notifications.scheduleNotificationAsync({
          identifier: REST_ID,
          content: {
            title: 'Descanso terminado',
            body: nextLabel ? `A por la siguiente serie: ${nextLabel}` : 'A por la siguiente serie.',
            sound: 'default',
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: { url: '/workout' },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId: CHANNEL_ID },
        });
      } catch {
        // Notifications are a nice-to-have: the in-app timer still works.
      }
    });
  },

  /** Cancels pending rest alarms (including orphans from earlier runs) and hides shown ones. */
  cancel(options?: { dismissShown?: boolean }) {
    return enqueue(async () => {
      await clearAll();
      if (options?.dismissShown) await dismissShown();
    });
  },
};
