import { useSyncExternalStore } from 'react';
import type { Routine, UserProfile, WorkoutExerciseLog, WorkoutSession } from '../core/types';
import { Accounts, DEFAULT_PROFILE, SEED_ROUTINES, Storage, type Account } from '../storage';
import { RestNotifications } from '../core/services/restNotifications';
import { CloudSync, type LocalData } from '../core/services/cloud/cloudSync';
import { disconnectCloud } from '../core/services/cloud/supabaseClient';
import {
  computeVolume,
  createEmptySession,
  createExerciseLog,
  createSessionFromRoutine,
} from '../core/utils/workout';

export interface AppState {
  hydrated: boolean;
  /** Signed-in account on this device; null shows the login screen. */
  account: Account | null;
  /** Accounts previously used on this device (for the login picker). */
  accounts: Account[];
  profile: UserProfile;
  customRoutines: Routine[];
  history: WorkoutSession[];
  activeWorkout: WorkoutSession | null;
  /** Rest countdown lives here (not in the screen) so it survives minimizing the workout. */
  restTimer: RestTimerState | null;
}

export interface RestTimerState {
  endsAt: number;
  totalSeconds: number;
  nextLabel?: string;
}

let state: AppState = {
  hydrated: false,
  account: null,
  accounts: [],
  profile: DEFAULT_PROFILE,
  customRoutines: [],
  history: [],
  activeWorkout: null,
  restTimer: null,
};

const listeners = new Set<() => void>();

function setState(updater: (prev: AppState) => AppState) {
  const next = updater(state);
  if (next === state) return;
  state = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getAppState = () => state;

/**
 * Selector hook. Components only re-render when the selected slice changes
 * (by reference), so ticking a set does not re-render the nutrition tab.
 */
export function useAppStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

const EMPTY_DATA = {
  profile: DEFAULT_PROFILE,
  customRoutines: [] as Routine[],
  history: [] as WorkoutSession[],
  activeWorkout: null as WorkoutSession | null,
  restTimer: null as RestTimerState | null,
};

// Active workout writes are frequent (every keystroke on a set); debounce them.
let workoutSaveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingWorkout: WorkoutSession | null = null;

/** Persist the debounced workout now, before switching account namespaces. */
function flushPendingWrites() {
  if (workoutSaveTimer) {
    clearTimeout(workoutSaveTimer);
    workoutSaveTimer = null;
    if (pendingWorkout) Storage.saveActiveWorkout(pendingWorkout);
  }
  pendingWorkout = null;
}
function persistActiveWorkout(session: WorkoutSession | null) {
  if (workoutSaveTimer) clearTimeout(workoutSaveTimer);
  workoutSaveTimer = null;
  pendingWorkout = null;
  if (!session) {
    Storage.saveActiveWorkout(null);
    return;
  }
  pendingWorkout = session;
  workoutSaveTimer = setTimeout(() => {
    workoutSaveTimer = null;
    pendingWorkout = null;
    Storage.saveActiveWorkout(session);
  }, 400);
}

function updateActive(mutator: (session: WorkoutSession) => WorkoutSession) {
  setState((prev) => {
    if (!prev.activeWorkout) return prev;
    const next = mutator(prev.activeWorkout);
    persistActiveWorkout(next);
    return { ...prev, activeWorkout: next };
  });
}

const replaceExercise = (
  session: WorkoutSession,
  index: number,
  mutator: (log: WorkoutExerciseLog) => WorkoutExerciseLog
): WorkoutSession => {
  const exercises = session.exercises.map((log, i) => (i === index ? mutator(log) : log));
  return { ...session, exercises, totalVolumeKg: computeVolume(exercises) };
};

/** How long sign-in waits for the backup before opening the app with local data. */
const SIGN_IN_SYNC_TIMEOUT_MS = 10_000;

// Data merged from the cloud backup lands here: memory first, then disk (silently,
// so it is not uploaded straight back).
CloudSync.bind({
  read: () => ({ profile: state.profile, customRoutines: state.customRoutines, history: state.history }),
  apply(patch: Partial<LocalData>) {
    setState((prev) => {
      const account =
        patch.profile && prev.account
          ? { ...prev.account, name: patch.profile.name || prev.account.name, photoUrl: patch.profile.photoUrl ?? prev.account.photoUrl }
          : prev.account;
      if (account && account !== prev.account) Accounts.upsert(account);
      return { ...prev, ...patch, account };
    });
    if (patch.profile) Storage.saveProfile(patch.profile, { silent: true });
    if (patch.customRoutines) Storage.saveCustomRoutines(patch.customRoutines, { silent: true });
    if (patch.history) Storage.saveHistory(patch.history, { silent: true });
  },
});

async function leaveCurrentAccount() {
  await CloudSync.flush();
  await CloudSync.attach(null);
  await disconnectCloud();
}

export const appActions = {
  async hydrate() {
    const [accounts, currentId] = await Promise.all([Accounts.list(), Accounts.getCurrentId()]);
    const account = accounts.find((item) => item.id === currentId) ?? null;
    if (!account) {
      setState((prev) => ({ ...prev, ...EMPTY_DATA, accounts, account: null, hydrated: true }));
      return;
    }
    await Accounts.setCurrent(account.id);
    const persisted = await Storage.loadAll();
    await CloudSync.attach(account, persisted);
    setState((prev) => ({ ...prev, ...persisted, restTimer: null, accounts, account, hydrated: true }));
    CloudSync.syncNow();
  },

  /**
   * Opens (or creates) an account's data space and makes it current. With the
   * cloud backup on, it first pulls the backup (bounded wait) so a reinstalled
   * app comes back with the athlete's data.
   */
  async signIn(identity: Omit<Account, 'lastUsedAt'>) {
    flushPendingWrites();
    if (state.account && state.account.id !== identity.id) await leaveCurrentAccount();
    const account: Account = { ...identity, lastUsedAt: Date.now() };
    const accounts = await Accounts.upsert(account);
    await Accounts.setCurrent(account.id);
    const persisted = await Storage.loadAll();
    // First time on a Google account: seed the profile with its name and photo.
    const profile =
      persisted.profile.hasCompletedOnboarding || !identity.email
        ? persisted.profile
        : { ...persisted.profile, name: persisted.profile.name || identity.name, email: identity.email, photoUrl: identity.photoUrl };
    await CloudSync.attach(account, persisted);
    setState((prev) => ({ ...prev, ...persisted, profile, restTimer: null, accounts, account }));
    if (account.cloudUserId) await CloudSync.syncWithin(SIGN_IN_SYNC_TIMEOUT_MS);
    return state.profile;
  },

  /** Leaves the current account; its data stays on the device for next time. */
  async signOut() {
    flushPendingWrites();
    RestNotifications.cancel();
    await leaveCurrentAccount();
    await Accounts.setCurrent(null);
    const accounts = await Accounts.list();
    setState((prev) => ({ ...prev, ...EMPTY_DATA, accounts, account: null }));
  },

  /** Deletes an account and all its data from this device. */
  async deleteAccount(accountId: string, options?: { cloud?: boolean }): Promise<{ ok: true } | { ok: false; message: string }> {
    const isCurrent = state.account?.id === accountId;
    // Cloud first: if it fails, nothing is deleted so the athlete can retry.
    if (options?.cloud && isCurrent) {
      const result = await CloudSync.deleteRemote();
      if (!result.ok) return result;
    }
    if (isCurrent) {
      flushPendingWrites();
      RestNotifications.cancel();
      await CloudSync.attach(null);
      await disconnectCloud();
    }
    const accounts = await Accounts.remove(accountId);
    setState((prev) => (isCurrent ? { ...prev, ...EMPTY_DATA, accounts, account: null } : { ...prev, accounts }));
    return { ok: true };
  },

  /**
   * Turns the cloud backup on for the current account, linking it to Google.
   * This phone's data wins over an older backup (the athlete chose to back it up).
   */
  async enableCloudBackup(identity: { name: string; email: string; photoUrl?: string }, cloudUserId: string) {
    const current = state.account;
    if (!current) return;
    const account: Account = { ...current, kind: 'google', email: identity.email, photoUrl: identity.photoUrl ?? current.photoUrl, cloudUserId, lastUsedAt: Date.now() };
    const accounts = await Accounts.upsert(account);
    const profile = { ...state.profile, name: state.profile.name || identity.name, email: identity.email, photoUrl: account.photoUrl };
    setState((prev) => ({ ...prev, account, accounts, profile }));
    Storage.saveProfile(profile);
    CloudSync.updateAccount(account);
    await CloudSync.markAllFresh();
    await CloudSync.syncNow();
  },

  /** Stops backing up this account. Data already in the cloud is kept. */
  async disableCloudBackup() {
    const current = state.account;
    if (!current?.cloudUserId) return;
    const account: Account = { ...current, cloudUserId: undefined };
    const accounts = await Accounts.upsert(account);
    setState((prev) => ({ ...prev, account, accounts }));
    CloudSync.updateAccount(account);
    await disconnectCloud();
  },

  /** The stored session expired or belongs to someone else: reconnect with Google. */
  async reconnectCloud(cloudUserId: string) {
    const current = state.account;
    if (!current) return false;
    if (current.cloudUserId && current.cloudUserId !== cloudUserId) {
      await disconnectCloud();
      return false;
    }
    const account: Account = { ...current, cloudUserId };
    setState((prev) => ({ ...prev, account }));
    Accounts.upsert(account);
    CloudSync.updateAccount(account);
    await CloudSync.syncNow();
    return true;
  },

  saveProfile(profile: UserProfile) {
    setState((prev) => {
      // Keep the login picker in sync with the profile's name and photo.
      const account = prev.account ? { ...prev.account, name: profile.name || prev.account.name, photoUrl: profile.photoUrl, email: profile.email ?? prev.account.email } : null;
      if (account) Accounts.upsert({ ...account, lastUsedAt: Date.now() });
      return { ...prev, profile, account };
    });
    Storage.saveProfile(profile);
  },

  upsertRoutine(routine: Routine) {
    setState((prev) => {
      const exists = prev.customRoutines.some((item) => item.id === routine.id);
      const customRoutines = exists
        ? prev.customRoutines.map((item) => (item.id === routine.id ? routine : item))
        : [{ ...routine, isCustom: true, createdAt: routine.createdAt ?? Date.now() }, ...prev.customRoutines];
      Storage.saveCustomRoutines(customRoutines);
      return { ...prev, customRoutines };
    });
  },

  /** Replaces the current weekly program; hand-made routines are kept. */
  saveProgram(routines: Routine[]) {
    setState((prev) => {
      const kept = prev.customRoutines.filter((item) => !item.programId);
      const now = Date.now();
      const program = routines.map((routine, index) => ({ ...routine, isCustom: true, createdAt: now + index }));
      const customRoutines = [...program, ...kept];
      Storage.saveCustomRoutines(customRoutines);
      return { ...prev, customRoutines };
    });
  },

  deleteRoutine(routineId: string) {
    setState((prev) => {
      const customRoutines = prev.customRoutines.filter((item) => item.id !== routineId);
      Storage.saveCustomRoutines(customRoutines);
      return { ...prev, customRoutines };
    });
  },

  startRoutine(routine: Routine) {
    const session = createSessionFromRoutine(routine, state.history);
    setState((prev) => ({ ...prev, activeWorkout: session }));
    persistActiveWorkout(session);
  },

  startEmptyWorkout(exerciseIds: string[] = [], title?: string) {
    const session = createEmptySession(title);
    session.exercises = exerciseIds.map((id) => createExerciseLog(id, state.history));
    setState((prev) => ({ ...prev, activeWorkout: session }));
    persistActiveWorkout(session);
  },

  addExercisesToWorkout(exerciseIds: string[]) {
    updateActive((session) => ({
      ...session,
      exercises: [...session.exercises, ...exerciseIds.map((id) => createExerciseLog(id, state.history))],
    }));
  },

  removeExerciseFromWorkout(index: number) {
    updateActive((session) => {
      const exercises = session.exercises.filter((_, i) => i !== index);
      return { ...session, exercises, totalVolumeKg: computeVolume(exercises) };
    });
  },

  moveExercise(index: number, direction: -1 | 1) {
    updateActive((session) => {
      const target = index + direction;
      if (target < 0 || target >= session.exercises.length) return session;
      const exercises = [...session.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...session, exercises };
    });
  },

  updateSet(exerciseIndex: number, setIndex: number, patch: Partial<{ weightKg: number; reps: number; completed: boolean }>) {
    updateActive((session) =>
      replaceExercise(session, exerciseIndex, (log) => {
        const previous = log.sets[setIndex];
        const sets = log.sets.map((set, i) => (i === setIndex ? { ...set, ...patch } : set));
        // Fill-down: editing a load/reps updates following pending sets that still
        // mirrored the old value, so the athlete types it once per exercise.
        for (let i = setIndex + 1; i < sets.length; i++) {
          if (sets[i].completed) continue;
          if (patch.weightKg !== undefined && sets[i].weightKg === previous.weightKg) {
            sets[i] = { ...sets[i], weightKg: patch.weightKg };
          }
          if (patch.reps !== undefined && sets[i].reps === previous.reps) {
            sets[i] = { ...sets[i], reps: patch.reps };
          }
        }
        return { ...log, sets };
      })
    );
  },

  addSet(exerciseIndex: number) {
    updateActive((session) =>
      replaceExercise(session, exerciseIndex, (log) => {
        const last = log.sets[log.sets.length - 1];
        const newSet = {
          id: `${log.exerciseId}_${log.sets.length + 1}_${session.startedAt}_${Math.random().toString(36).slice(2, 7)}`,
          setNumber: log.sets.length + 1,
          type: 'normal' as const,
          weightKg: last?.weightKg ?? 0,
          reps: last?.reps ?? 10,
          completed: false,
        };
        return { ...log, sets: [...log.sets, newSet] };
      })
    );
  },

  removeSet(exerciseIndex: number, setIndex: number) {
    updateActive((session) =>
      replaceExercise(session, exerciseIndex, (log) => ({
        ...log,
        sets: log.sets.filter((_, i) => i !== setIndex).map((set, i) => ({ ...set, setNumber: i + 1 })),
      }))
    );
  },

  /** Rest between sets for one exercise of the current workout. */
  setExerciseRest(exerciseIndex: number, restSeconds: number) {
    updateActive((session) => replaceExercise(session, exerciseIndex, (log) => ({ ...log, restSeconds })));
  },

  renameWorkout(title: string) {
    updateActive((session) => ({ ...session, title }));
  },

  startRest(totalSeconds: number, nextLabel?: string) {
    const restTimer = { endsAt: Date.now() + totalSeconds * 1000, totalSeconds, nextLabel };
    setState((prev) => ({ ...prev, restTimer }));
    RestNotifications.schedule(restTimer.endsAt, nextLabel);
  },

  adjustRest(deltaSeconds: number) {
    const current = state.restTimer;
    if (!current) return;
    const restTimer = {
      ...current,
      endsAt: Math.max(Date.now(), current.endsAt + deltaSeconds * 1000),
      totalSeconds: Math.max(1, current.totalSeconds + deltaSeconds),
    };
    setState((prev) => ({ ...prev, restTimer }));
    RestNotifications.schedule(restTimer.endsAt, restTimer.nextLabel);
  },

  getRestTimer: () => state.restTimer,
  getActiveWorkout: () => state.activeWorkout,

  clearRest() {
    if (!state.restTimer) return;
    setState((prev) => ({ ...prev, restTimer: null }));
    RestNotifications.cancel();
  },

  /** Saves the workout to history. Returns the stored session (or null if nothing was done). */
  finishWorkout(): WorkoutSession | null {
    const session = state.activeWorkout;
    if (!session) return null;
    const exercises = session.exercises
      .map((log) => ({ ...log, sets: log.sets.filter((set) => set.completed) }))
      .filter((log) => log.sets.length > 0);

    const completedAt = Date.now();
    const finished: WorkoutSession = {
      ...session,
      exercises,
      totalVolumeKg: computeVolume(exercises),
      durationSeconds: Math.round((completedAt - session.startedAt) / 1000),
      completedAt,
      status: 'completed',
    };

    setState((prev) => {
      const history = exercises.length > 0 ? [finished, ...prev.history] : prev.history;
      if (exercises.length > 0) Storage.saveHistory(history);
      return { ...prev, history, activeWorkout: null, restTimer: null };
    });
    RestNotifications.cancel();
    persistActiveWorkout(null);
    return exercises.length > 0 ? finished : null;
  },

  discardWorkout() {
    setState((prev) => ({ ...prev, activeWorkout: null, restTimer: null }));
    RestNotifications.cancel();
    persistActiveWorkout(null);
  },

  deleteSession(sessionId: string) {
    setState((prev) => {
      const history = prev.history.filter((item) => item.id !== sessionId);
      Storage.saveHistory(history);
      return { ...prev, history };
    });
  },

};

// Stable selectors (module-level so their identity never changes).
export const selectProfile = (s: AppState) => s.profile;
export const selectHistory = (s: AppState) => s.history;
export const selectActiveWorkout = (s: AppState) => s.activeWorkout;
export const selectRestTimer = (s: AppState) => s.restTimer;
export const selectCustomRoutines = (s: AppState) => s.customRoutines;
export const selectHydrated = (s: AppState) => s.hydrated;
export const selectAccount = (s: AppState) => s.account;
export const selectAccounts = (s: AppState) => s.accounts;

let cachedCustom: Routine[] | null = null;
let cachedAll: Routine[] = SEED_ROUTINES;
export const selectAllRoutines = (s: AppState): Routine[] => {
  if (s.customRoutines !== cachedCustom) {
    cachedCustom = s.customRoutines;
    cachedAll = [...s.customRoutines, ...SEED_ROUTINES];
  }
  return cachedAll;
};

/**
 * Unsaved routines (generated by the program generator or the AI coach) that can
 * be previewed, started or saved without polluting the user's list.
 */
const draftRoutines = new Map<string, Routine>();

export function registerDraftRoutine(routine: Routine): string {
  draftRoutines.set(routine.id, routine);
  return routine.id;
}

export function isDraftRoutine(routineId: string): boolean {
  return draftRoutines.has(routineId) && !state.customRoutines.some((item) => item.id === routineId);
}

export function findRoutine(routineId: string): Routine | undefined {
  return (
    state.customRoutines.find((item) => item.id === routineId) ??
    SEED_ROUTINES.find((item) => item.id === routineId) ??
    draftRoutines.get(routineId)
  );
}
