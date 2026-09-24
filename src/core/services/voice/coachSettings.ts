import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Coach preferences for this phone (shared by every account on it). */
export interface CoachSettings {
  /** Spoken prompts on/off. */
  speak: boolean;
  /** expo-speech voice identifier; undefined = system default for the language. */
  voiceId?: string;
  rate: number;
  /** Lower pitch: makes any voice sound deeper. */
  deep: boolean;
  /** Start the next set automatically when the rest ends. */
  autoStart: boolean;
}

export const SPEECH_RATES = [
  { value: 0.9, label: 'Lenta' },
  { value: 1.05, label: 'Normal' },
  { value: 1.25, label: 'Rápida' },
] as const;

const KEY = '@gymbro_coach_settings';
const DEFAULTS: CoachSettings = { speak: true, rate: 1.05, deep: true, autoStart: false };

let settings: CoachSettings = DEFAULTS;
let loaded = false;
const listeners = new Set<() => void>();

export const CoachSettingsStore = {
  get: () => settings,
  async load() {
    if (loaded) return;
    loaded = true;
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) settings = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<CoachSettings>) };
      listeners.forEach((listener) => listener());
    } catch {
      // Keep defaults.
    }
  },
  update(patch: Partial<CoachSettings>) {
    settings = { ...settings, ...patch };
    listeners.forEach((listener) => listener());
    AsyncStorage.setItem(KEY, JSON.stringify(settings)).catch(() => undefined);
  },
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useCoachSettings(): CoachSettings {
  return useSyncExternalStore(subscribe, CoachSettingsStore.get, CoachSettingsStore.get);
}
