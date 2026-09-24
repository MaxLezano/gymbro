import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Routine, UserProfile, WorkoutSession } from '../core/types';

const KEYS = {
  profile: '@gymbro_user_profile',
  customRoutines: '@gymbro_custom_routines',
  history: '@gymbro_workout_history',
  activeWorkout: '@gymbro_active_workout',
  coachChat: '@gymbro_coach_chat',
  syncMeta: '@gymbro_sync_meta',
} as const;

export const SEED_ROUTINES: Routine[] = [
  {
    id: 'seed-home-fullbody-db',
    cover: 'full_body',
    title: 'Full body con mancuernas',
    description: 'Los patrones básicos en una sesión: sentadilla, empuje, tirón y bisagra.',
    targetLocation: 'home',
    level: 'beginner',
    estimatedMinutes: 45,
    exercises: [
      { exerciseId: '1760', targetSets: 3, targetReps: '10-12', restSeconds: 90 },
      { exerciseId: '0289', targetSets: 3, targetReps: '8-12', restSeconds: 90 },
      { exerciseId: '0293', targetSets: 3, targetReps: '10-12', restSeconds: 75 },
      { exerciseId: '1459', targetSets: 3, targetReps: '10-12', restSeconds: 90 },
      { exerciseId: '0405', targetSets: 3, targetReps: '10-12', restSeconds: 75 },
      { exerciseId: '0872', targetSets: 3, targetReps: '12-15', restSeconds: 45 },
    ],
  },
  {
    id: 'seed-home-calisthenics',
    cover: 'home',
    title: 'Calistenia esencial',
    description: 'Sin material. Control, técnica y repeticiones limpias.',
    targetLocation: 'home',
    level: 'beginner',
    estimatedMinutes: 30,
    exercises: [
      { exerciseId: '0662', targetSets: 3, targetReps: '8-15', restSeconds: 60 },
      { exerciseId: '1460', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
      { exerciseId: '0129', targetSets: 3, targetReps: '8-12', restSeconds: 60 },
      { exerciseId: '3013', targetSets: 3, targetReps: '12-15', restSeconds: 45 },
      { exerciseId: '0276', targetSets: 3, targetReps: '10-12', restSeconds: 45 },
    ],
  },
  {
    id: 'seed-home-pullup-bar',
    cover: 'pull',
    title: 'Espalda con barra de dominadas',
    description: 'Tracción vertical y horizontal para una espalda ancha y fuerte.',
    targetLocation: 'home',
    level: 'intermediate',
    estimatedMinutes: 40,
    exercises: [
      { exerciseId: '0652', targetSets: 4, targetReps: '5-8', restSeconds: 120 },
      { exerciseId: '1326', targetSets: 3, targetReps: '6-10', restSeconds: 90 },
      { exerciseId: '0499', targetSets: 3, targetReps: '10-12', restSeconds: 75 },
      { exerciseId: '0472', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
    ],
  },
  {
    id: 'seed-home-hiit',
    cover: 'hiit',
    title: 'HIIT en casa',
    description: 'Circuito metabólico corto para quemar calorías sin material.',
    targetLocation: 'home',
    level: 'beginner',
    estimatedMinutes: 25,
    exercises: [
      { exerciseId: '0630', targetSets: 4, targetReps: '20', restSeconds: 30 },
      { exerciseId: '1160', targetSets: 4, targetReps: '10', restSeconds: 30 },
      { exerciseId: '0514', targetSets: 4, targetReps: '12-15', restSeconds: 30 },
      { exerciseId: '0003', targetSets: 3, targetReps: '20', restSeconds: 30 },
    ],
  },
  {
    id: 'seed-gym-push',
    cover: 'push',
    title: 'Push: pecho, hombro y tríceps',
    description: 'Empuje pesado con barra, mancuernas y polea.',
    targetLocation: 'gym',
    level: 'intermediate',
    estimatedMinutes: 60,
    exercises: [
      { exerciseId: '0025', targetSets: 4, targetReps: '6-8', restSeconds: 150 },
      { exerciseId: '0314', targetSets: 3, targetReps: '8-10', restSeconds: 90 },
      { exerciseId: '0091', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: '0192', targetSets: 3, targetReps: '12-15', restSeconds: 60 },
      { exerciseId: '0241', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
    ],
  },
  {
    id: 'seed-gym-pull',
    cover: 'pull',
    title: 'Pull: espalda y bíceps',
    description: 'Jalones, remos y curl para densidad y amplitud.',
    targetLocation: 'gym',
    level: 'intermediate',
    estimatedMinutes: 55,
    exercises: [
      { exerciseId: '2330', targetSets: 4, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: '0861', targetSets: 3, targetReps: '8-12', restSeconds: 90 },
      { exerciseId: '0027', targetSets: 3, targetReps: '6-10', restSeconds: 120 },
      { exerciseId: '0378', targetSets: 3, targetReps: '12-15', restSeconds: 60 },
      { exerciseId: '0031', targetSets: 3, targetReps: '8-12', restSeconds: 60 },
    ],
  },
  {
    id: 'seed-gym-legs',
    cover: 'legs',
    title: 'Piernas completas',
    description: 'Cuádriceps, femorales y gemelos con básicos y máquinas.',
    targetLocation: 'gym',
    level: 'intermediate',
    estimatedMinutes: 65,
    exercises: [
      { exerciseId: '0043', targetSets: 4, targetReps: '5-8', restSeconds: 180 },
      { exerciseId: '0085', targetSets: 3, targetReps: '8-10', restSeconds: 120 },
      { exerciseId: '0739', targetSets: 3, targetReps: '10-12', restSeconds: 90 },
      { exerciseId: '0586', targetSets: 3, targetReps: '10-12', restSeconds: 60 },
      { exerciseId: '0088', targetSets: 4, targetReps: '12-15', restSeconds: 45 },
    ],
  },
];

export const DEFAULT_PROFILE: UserProfile = {
  id: 'local_user',
  name: '',
  gender: 'male',
  age: 28,
  weightKg: 75,
  heightCm: 175,
  activityLevel: 'moderate',
  fitnessGoal: 'muscle_gain',
  trainingLocation: 'gym',
  experience: 'beginner',
  homeEquipment: ['body_weight'],
  hasCompletedOnboarding: false,
};

async function readJson<T>(key: string | null, fallback: T): Promise<T> {
  if (!key) return fallback;
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key: string | null, value: unknown): Promise<void> {
  if (!key) return;
  try {
    if (value === null || value === undefined) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: keep the in-memory state, never crash the UI.
  }
}

/** Accepts profiles written by older app versions (or the cloud) and fills new fields. */
export function migrateProfile(stored: Partial<UserProfile>): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    ...stored,
    name: stored.name ?? '',
    experience: stored.experience ?? 'intermediate',
    homeEquipment: stored.homeEquipment?.length ? stored.homeEquipment : DEFAULT_PROFILE.homeEquipment,
  };
}

/**
 * Keeps only real work (completed sets, non-empty sessions) so stats, streaks
 * and records stay honest, whatever the source (disk or cloud backup).
 */
export function cleanHistory(history: WorkoutSession[]): WorkoutSession[] {
  return history
    .map((session) => ({
      ...session,
      exercises: (session.exercises ?? [])
        .map((log) => ({ ...log, sets: (log.sets ?? []).filter((set) => set.completed) }))
        .filter((log) => log.sets.length > 0),
    }))
    .filter((session) => session.exercises.length > 0);
}

export interface PersistedState {
  profile: UserProfile;
  customRoutines: Routine[];
  history: WorkoutSession[];
  activeWorkout: WorkoutSession | null;
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

/**
 * An account is an isolated data space on this device (profile, routines,
 * history, active workout, coach chat). The phone is always the source of
 * truth; accounts with `cloudUserId` also keep a merged backup in Supabase.
 */
export interface Account {
  id: string;
  kind: 'google' | 'local';
  name: string;
  email?: string;
  photoUrl?: string;
  /** Supabase user id when the cloud backup is on for this account. */
  cloudUserId?: string;
  lastUsedAt: number;
}

const ACCOUNT_KEYS = {
  registry: '@gymbro_accounts',
  current: '@gymbro_current_account',
} as const;

const DATA_KEYS = Object.values(KEYS);

let namespace: string | null = null;
/** Every per-account key is suffixed with the account id. */
// Signed out: reads return defaults and writes are dropped (e.g. a debounced save
// that fires right after logout must not leak into another account).
const keyFor = (key: string): string | null => (namespace ? `${key}:${namespace}` : null);

export const Accounts = {
  async list(): Promise<Account[]> {
    const accounts = await readJson<Account[]>(ACCOUNT_KEYS.registry, []);
    return Array.isArray(accounts) ? [...accounts].sort((a, b) => b.lastUsedAt - a.lastUsedAt) : [];
  },

  async getCurrentId(): Promise<string | null> {
    return readJson<string | null>(ACCOUNT_KEYS.current, null);
  },

  async upsert(account: Account): Promise<Account[]> {
    const accounts = (await this.list()).filter((item) => item.id !== account.id);
    const next = [account, ...accounts];
    await writeJson(ACCOUNT_KEYS.registry, next);
    return next;
  },

  async setCurrent(accountId: string | null): Promise<void> {
    namespace = accountId;
    await writeJson(ACCOUNT_KEYS.current, accountId);
  },

  /** Removes an account and all its data from this device. */
  async remove(accountId: string): Promise<Account[]> {
    try {
      await AsyncStorage.multiRemove(DATA_KEYS.map((key) => `${key}:${accountId}`));
    } catch {
      // ignore
    }
    const next = (await this.list()).filter((item) => item.id !== accountId);
    await writeJson(ACCOUNT_KEYS.registry, next);
    if ((await this.getCurrentId()) === accountId) await this.setCurrent(null);
    return next;
  },
};

// ---------------------------------------------------------------------------
// Per-account data
// ---------------------------------------------------------------------------

/** Data kinds that are backed up to the cloud. */
export type BackedUpKind = 'profile' | 'customRoutines' | 'history';

/** Per-account bookkeeping for the cloud backup. */
export interface SyncMeta {
  /** Last change time per kind (local edit or adopted remote copy). 0 = never written. */
  updatedAt: Partial<Record<BackedUpKind, number>>;
  /** Tombstones for deleted routines and sessions. */
  deleted: { customRoutines: Record<string, number>; history: Record<string, number> };
  /** Ids present after the last write, to detect deletions. */
  knownIds: { customRoutines: string[]; history: string[] };
  lastSyncedAt?: number;
}

export const EMPTY_SYNC_META: SyncMeta = {
  updatedAt: {},
  deleted: { customRoutines: {}, history: {} },
  knownIds: { customRoutines: [], history: [] },
};

type WriteListener = (kind: BackedUpKind, value: unknown) => void;
let writeListener: WriteListener | null = null;

/**
 * Saves a backed-up kind. `silent` skips the listener: used when applying data
 * that came from the cloud, so it is not uploaded straight back.
 */
function saveBackedUp<T>(key: string, kind: BackedUpKind) {
  return async (value: T, options?: { silent?: boolean }) => {
    const target = keyFor(key);
    // Notify before awaiting so the listener still sees this account's namespace.
    if (target && !options?.silent) writeListener?.(kind, value);
    await writeJson(target, value);
  };
}

export const Storage = {
  async loadAll(): Promise<PersistedState> {
    const [profile, customRoutines, history, activeWorkout] = await Promise.all([
      readJson<Partial<UserProfile> | null>(keyFor(KEYS.profile), null),
      readJson<Routine[]>(keyFor(KEYS.customRoutines), []),
      readJson<WorkoutSession[]>(keyFor(KEYS.history), []),
      readJson<WorkoutSession | null>(keyFor(KEYS.activeWorkout), null),
    ]);
    return {
      profile: profile ? migrateProfile(profile) : DEFAULT_PROFILE,
      customRoutines: Array.isArray(customRoutines) ? customRoutines : [],
      history: Array.isArray(history) ? cleanHistory(history) : [],
      activeWorkout: activeWorkout?.status === 'in_progress' ? activeWorkout : null,
    };
  },
  saveProfile: saveBackedUp<UserProfile>(KEYS.profile, 'profile'),
  saveCustomRoutines: saveBackedUp<Routine[]>(KEYS.customRoutines, 'customRoutines'),
  saveHistory: saveBackedUp<WorkoutSession[]>(KEYS.history, 'history'),
  saveActiveWorkout: (session: WorkoutSession | null) => writeJson(keyFor(KEYS.activeWorkout), session),
  loadCoachChat: <T>() => readJson<T[]>(keyFor(KEYS.coachChat), []),
  saveCoachChat: (messages: unknown[]) => writeJson(keyFor(KEYS.coachChat), messages),
  async loadSyncMeta(): Promise<SyncMeta> {
    const meta = await readJson<Partial<SyncMeta> | null>(keyFor(KEYS.syncMeta), null);
    return {
      updatedAt: meta?.updatedAt ?? {},
      deleted: { customRoutines: meta?.deleted?.customRoutines ?? {}, history: meta?.deleted?.history ?? {} },
      knownIds: { customRoutines: meta?.knownIds?.customRoutines ?? [], history: meta?.knownIds?.history ?? [] },
      lastSyncedAt: meta?.lastSyncedAt,
    };
  },
  saveSyncMeta: (meta: SyncMeta) => writeJson(keyFor(KEYS.syncMeta), meta),
  /** One listener (the cloud sync) hears about every local write of a backed-up kind. */
  setWriteListener(listener: WriteListener | null) {
    writeListener = listener;
  },
};
