import { useSyncExternalStore } from 'react';
import type { View } from 'react-native';
import { appActions } from '../../state/appStore';
import { TOUR_STEPS } from './steps';

export interface TourState {
  active: boolean;
  index: number;
  /** Direction of the last move, so a missing target is skipped the same way. */
  direction: 1 | -1;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

let state: TourState = { active: false, index: 0, direction: 1 };
const listeners = new Set<() => void>();
const targets = new Map<string, { current: View | null }>();

function setState(next: TourState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function go(index: number, direction: 1 | -1) {
  if (index < 0) return;
  if (index >= TOUR_STEPS.length) {
    Tour.finish();
    return;
  }
  setState({ active: true, index, direction });
}

export const Tour = {
  start() {
    if (!state.active) setState({ active: true, index: 0, direction: 1 });
  },
  next: () => go(state.index + 1, 1),
  prev: () => go(state.index - 1, -1),
  /** The current step has nothing to show: keep moving the same way. */
  skipMissing: () => go(state.index + state.direction, state.direction),
  /** Finished or skipped: never auto-start again (synced with the profile). */
  finish() {
    setState({ active: false, index: 0, direction: 1 });
    appActions.patchProfile({ tourSeenAt: Date.now() });
  },
};

export function useTour(): TourState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state
  );
}

export function registerTarget(id: string, ref: { current: View | null }) {
  targets.set(id, ref);
  return () => {
    if (targets.get(id) === ref) targets.delete(id);
  };
}

/** Window rect of a registered target, or null when it is missing or not laid out. */
export function measureTarget(id: string): Promise<Rect | null> {
  const view = targets.get(id)?.current;
  if (!view) return Promise.resolve(null);
  return new Promise((resolve) => {
    view.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 ? { x, y, width, height } : null));
  });
}
