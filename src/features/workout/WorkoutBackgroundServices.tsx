import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { FeedbackService } from '../../core/services/feedback';
import { appActions, selectRestTimer, useAppStore } from '../../state/appStore';

const KEEP_AWAKE_TAG = 'active-workout';
const CLEAR_AFTER_ALARM_MS = 5000;

/**
 * App-wide workout side effects, mounted once in the root layout so they work
 * on any screen (workout minimized, another tab open...):
 * - keeps the screen on while a workout is in progress;
 * - fires the rest alarm when the countdown ends (the OS notification covers
 *   the app being in background; this covers it being in foreground).
 */
export function WorkoutBackgroundServices() {
  const hasActiveWorkout = useAppStore((state) => state.activeWorkout !== null);
  const restTimer = useAppStore(selectRestTimer);

  useEffect(() => {
    if (!hasActiveWorkout) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [hasActiveWorkout]);

  // Tapping "Descanso terminado" takes the athlete straight back to the workout.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = lastResponse?.notification.request.content.data?.url;
    if (typeof url === 'string' && appActions.getActiveWorkout()) router.push(url as '/workout');
  }, [lastResponse]);

  const endsAt = restTimer?.endsAt;
  useEffect(() => {
    if (!endsAt) return;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;
    const alarmTimer = setTimeout(() => {
      // JS timers freeze in background; if we wake up late the OS notification
      // already alerted, so don't buzz again on return.
      if (Date.now() - endsAt < 3000) FeedbackService.timerAlarm();
      clearTimer = setTimeout(() => {
        // Only clear if the athlete did not start a new rest meanwhile.
        const current = appActions.getRestTimer();
        if (current?.endsAt === endsAt) appActions.clearRest();
      }, CLEAR_AFTER_ALARM_MS);
    }, Math.max(0, endsAt - Date.now()));
    return () => {
      clearTimeout(alarmTimer);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [endsAt]);

  return null;
}
