import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'rest-timer';
let scheduledId: string | null = null;
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

export const RestNotifications = {
  async schedule(endsAt: number, nextLabel?: string) {
    try {
      setup();
      await this.cancel();
      if (!(await ensurePermission())) return;
      // Measure after the permission dialog: the athlete may take a while to answer it.
      const seconds = Math.round((endsAt - Date.now()) / 1000);
      if (seconds < 2) return;
      scheduledId = await Notifications.scheduleNotificationAsync({
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
  },

  async cancel() {
    const id = scheduledId;
    scheduledId = null;
    if (id) await Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined);
  },
};
