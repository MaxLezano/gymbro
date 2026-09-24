import { Alert } from 'react-native';
import { router } from 'expo-router';
import type { Routine } from '../../core/types';
import { appActions, getAppState } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';

/** Starts a workout, asking first if another one is already running. */
function guard(start: () => void) {
  const active = getAppState().activeWorkout;
  if (!active) {
    FeedbackService.mediumTap();
    start();
    router.push('/workout');
    return;
  }
  Alert.alert('Ya tienes un entrenamiento en curso', `"${active.title}" sigue abierto.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Continuar el actual', onPress: () => router.push('/workout') },
    {
      text: 'Empezar nuevo',
      style: 'destructive',
      onPress: () => {
        appActions.discardWorkout();
        start();
        router.push('/workout');
      },
    },
  ]);
}

export const startRoutineWorkout = (routine: Routine) => guard(() => appActions.startRoutine(routine));

export const startFreeWorkout = () => guard(() => appActions.startEmptyWorkout([], 'Entrenamiento libre'));
