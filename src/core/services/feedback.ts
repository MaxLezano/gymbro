import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';

// Haptics return promises; swallow rejections (devices without a vibrator motor).
const safe = (promise: Promise<unknown>) => {
  promise.catch(() => undefined);
};

export const FeedbackService = {
  selection() {
    safe(Haptics.selectionAsync());
  },
  lightTap() {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
  mediumTap() {
    safe(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
  },
  success() {
    safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  warning() {
    safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  /** Rest timer finished: strong, recognizable pattern even with the phone in a pocket. */
  timerAlarm() {
    safe(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
    Vibration.vibrate([0, 350, 150, 350, 150, 500]);
  },
};
