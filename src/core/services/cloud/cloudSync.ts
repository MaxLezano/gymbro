import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { Routine, UserProfile, WorkoutSession } from '../../types';
import {
  cleanHistory,
  EMPTY_SYNC_META,
  migrateProfile,
  Storage,
  type Account,
  type BackedUpKind,
  type SyncMeta,
} from '../../../storage';
import { currentCloudUserId, supabase } from './supabaseClient';
import { mergeCollection, mergeProfile, sameJson, trackDeletions, type CollectionDoc, type CollectionKind, type ProfileDoc } from './merge';

/**
 * Local-first cloud backup.
 *
 * The phone stays the source of truth: every change is saved locally first and
 * a debounced sync then pulls the backup, merges it (see ./merge) and uploads
 * whatever changed. Offline is not an error, the next sync catches up.
 */

const TABLE = 'user_data';
const REMOTE_KIND: Record<BackedUpKind, string> = {
  profile: 'profile',
  customRoutines: 'custom_routines',
  history: 'history',
};
const COLLECTIONS: CollectionKind[] = ['customRoutines', 'history'];
const PUSH_DELAY_MS = 4000;
const FOREGROUND_THROTTLE_MS = 60_000;

export interface LocalData {
  profile: UserProfile;
  customRoutines: Routine[];
  history: WorkoutSession[];
}

/** Wiring to the app store (injected to avoid a store <-> sync import cycle). */
interface Bindings {
  read: () => LocalData;
  /** Applies merged data to memory and disk without triggering another upload. */
  apply: (patch: Partial<LocalData>) => void;
}

export type CloudStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'needs_auth';
export interface CloudStatusState {
  status: CloudStatus;
  lastSyncedAt?: number;
}

let bindings: Bindings | null = null;
let account: Account | null = null;
let meta: SyncMeta = EMPTY_SYNC_META;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<void> | null = null;
let lastForegroundSync = 0;
/** Bumped on every local write; a sync that raced with one does not apply its result. */
let writeVersion = 0;

let statusState: CloudStatusState = { status: 'off' };
const statusListeners = new Set<() => void>();
function setStatus(next: CloudStatusState) {
  statusState = next;
  statusListeners.forEach((listener) => listener());
}

const idsOf = (items: { id: string }[]) => items.map((item) => item.id);
const byNewest = (a: WorkoutSession, b: WorkoutSession) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt);

function isSyncable(current: Account | null): current is Account & { cloudUserId: string } {
  return Boolean(supabase && bindings && current?.cloudUserId);
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    CloudSync.syncNow();
  }, PUSH_DELAY_MS);
}

function onLocalWrite(kind: BackedUpKind, value: unknown) {
  if (!account) return;
  writeVersion += 1;
  const now = Date.now();
  const updatedAt = { ...meta.updatedAt, [kind]: now };
  if (kind === 'profile') {
    meta = { ...meta, updatedAt };
  } else {
    const ids = idsOf(value as { id: string }[]);
    meta = {
      ...meta,
      updatedAt,
      deleted: { ...meta.deleted, [kind]: trackDeletions(meta.knownIds[kind], ids, meta.deleted[kind], now) },
      knownIds: { ...meta.knownIds, [kind]: ids },
    };
  }
  Storage.saveSyncMeta(meta);
  if (isSyncable(account)) schedulePush();
}

async function runSync(): Promise<void> {
  const current = account;
  if (!isSyncable(current) || !supabase || !bindings) return;

  const userId = await currentCloudUserId();
  if (userId !== current.cloudUserId) {
    setStatus({ status: 'needs_auth', lastSyncedAt: meta.lastSyncedAt });
    return;
  }

  setStatus({ status: 'syncing', lastSyncedAt: meta.lastSyncedAt });
  const startedVersion = writeVersion;
  try {
    const { data: rows, error } = await supabase.from(TABLE).select('kind, data');
    if (error) throw error;
    if (account?.id !== current.id) return;

    const remoteOf = <T>(kind: BackedUpKind): T | null =>
      ((rows ?? []).find((row: { kind: string }) => row.kind === REMOTE_KIND[kind]) as { data: T } | undefined)?.data ?? null;
    const local = bindings.read();
    const patch: Partial<LocalData> = {};
    const uploads: { kind: string; data: unknown; updated_at: string }[] = [];
    const nextMeta: SyncMeta = { ...meta, updatedAt: { ...meta.updatedAt }, deleted: { ...meta.deleted }, knownIds: { ...meta.knownIds } };
    const upload = (kind: BackedUpKind, data: { updatedAt: number }) =>
      uploads.push({ kind: REMOTE_KIND[kind], data, updated_at: new Date(data.updatedAt).toISOString() });

    // Profile: last write wins. A never-edited default profile is not uploaded.
    const localProfile: ProfileDoc<UserProfile> = { profile: local.profile, updatedAt: meta.updatedAt.profile ?? 0 };
    const remoteProfile = remoteOf<ProfileDoc<UserProfile>>('profile');
    const profile = mergeProfile(localProfile, remoteProfile);
    if (profile !== localProfile) {
      patch.profile = migrateProfile(profile.profile);
    } else if (local.profile.hasCompletedOnboarding) {
      const doc = { ...localProfile, updatedAt: localProfile.updatedAt || 1 };
      if (!remoteProfile || !sameJson(remoteProfile, doc)) upload('profile', doc);
    }
    nextMeta.updatedAt.profile = profile.updatedAt;

    // Collections: union by id with tombstones.
    for (const kind of COLLECTIONS) {
      const localDoc = { items: local[kind] as { id: string }[], deleted: meta.deleted[kind], updatedAt: meta.updatedAt[kind] ?? 0 };
      const remoteDoc = remoteOf<CollectionDoc<{ id: string }>>(kind);
      const merged = mergeCollection(localDoc, remoteDoc);
      if (kind === 'history') merged.items = cleanHistory(merged.items as WorkoutSession[]).sort(byNewest);
      if (!sameJson(merged.items, localDoc.items)) (patch as Record<string, unknown>)[kind] = merged.items;

      const doc = { ...merged, updatedAt: merged.updatedAt || 1 };
      const hasContent = merged.items.length > 0 || Object.keys(merged.deleted).length > 0;
      if (hasContent && (!remoteDoc || !sameJson(remoteDoc, doc))) upload(kind, doc);

      nextMeta.updatedAt[kind] = merged.updatedAt;
      nextMeta.deleted[kind] = merged.deleted;
      nextMeta.knownIds[kind] = idsOf(merged.items);
    }

    if (uploads.length > 0) {
      const { error: uploadError } = await supabase
        .from(TABLE)
        .upsert(uploads.map((row) => ({ ...row, user_id: userId })), { onConflict: 'user_id,kind' });
      if (uploadError) throw uploadError;
    }
    if (account?.id !== current.id) return;

    // The athlete edited something while we were syncing: keep their edit and retry.
    if (writeVersion !== startedVersion) {
      setStatus({ status: 'idle', lastSyncedAt: meta.lastSyncedAt });
      schedulePush();
      return;
    }

    if (Object.keys(patch).length > 0) bindings.apply(patch);
    meta = { ...nextMeta, lastSyncedAt: Date.now() };
    await Storage.saveSyncMeta(meta);
    setStatus({ status: 'idle', lastSyncedAt: meta.lastSyncedAt });
  } catch {
    if (account?.id === current.id) setStatus({ status: 'offline', lastSyncedAt: meta.lastSyncedAt });
  }
}

function withTimeout(promise: Promise<void>, ms: number): Promise<void> {
  return Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

export const CloudSync = {
  /** Connects the sync to the app store. Call once at startup. */
  bind(next: Bindings) {
    bindings = next;
    Storage.setWriteListener(onLocalWrite);
    AppState.addEventListener('change', (appState) => {
      if (appState !== 'active' || Date.now() - lastForegroundSync < FOREGROUND_THROTTLE_MS) return;
      lastForegroundSync = Date.now();
      CloudSync.syncNow();
    });
  },

  /**
   * Switches the sync to the signed-in account (null when signed out).
   * Must run after the account's storage namespace is active.
   */
  async attach(next: Account | null, data?: LocalData) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    account = next;
    if (!next) {
      meta = EMPTY_SYNC_META;
      setStatus({ status: 'off' });
      return;
    }
    const loaded = await Storage.loadSyncMeta();
    if (account?.id !== next.id) return;
    // What is on disk now is the baseline for detecting future deletions.
    meta = data
      ? { ...loaded, knownIds: { customRoutines: idsOf(data.customRoutines), history: idsOf(data.history) } }
      : loaded;
    setStatus(isSyncable(next) ? { status: 'idle', lastSyncedAt: meta.lastSyncedAt } : { status: 'off' });
  },

  /** Same account, new identity details (e.g. backup turned on or off). Keeps sync state. */
  updateAccount(next: Account) {
    if (account?.id !== next.id) return;
    account = next;
    setStatus(isSyncable(next) ? { status: 'idle', lastSyncedAt: meta.lastSyncedAt } : { status: 'off' });
  },

  /** The athlete chose to back up this profile: local data wins over an older backup. */
  async markAllFresh() {
    const now = Date.now();
    meta = { ...meta, updatedAt: { profile: now, customRoutines: now, history: now } };
    await Storage.saveSyncMeta(meta);
  },

  /** Pull, merge and push now. Concurrent calls share one run. */
  syncNow(): Promise<void> {
    if (!isSyncable(account)) return Promise.resolve();
    if (!inflight) {
      inflight = runSync().finally(() => {
        inflight = null;
      });
    }
    return inflight;
  },

  /** Sync, but never make the UI wait longer than `ms` (offline, slow network). */
  syncWithin(ms: number) {
    return withTimeout(CloudSync.syncNow(), ms);
  },

  /** Uploads pending changes before leaving an account (best effort). */
  async flush(ms = 3000) {
    if (!pushTimer) return;
    clearTimeout(pushTimer);
    pushTimer = null;
    await CloudSync.syncWithin(ms);
  },

  /**
   * Deletes this account's backup from the cloud. Pending uploads are dropped
   * first so a late sync cannot recreate it. Needs a connection and a valid session.
   */
  async deleteRemote(): Promise<{ ok: true } | { ok: false; message: string }> {
    const current = account;
    if (!supabase || !current?.cloudUserId) return { ok: true };
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    await inflight?.catch(() => undefined);
    if ((await currentCloudUserId()) !== current.cloudUserId) {
      return { ok: false, message: 'Tu sesión de Google venció. Reconecta el respaldo desde tu perfil e inténtalo de nuevo.' };
    }
    try {
      const { error } = await supabase.from(TABLE).delete().eq('user_id', current.cloudUserId);
      if (error) throw error;
      return { ok: true };
    } catch {
      return { ok: false, message: 'No pudimos borrar la copia en la nube. Revisa tu conexión e inténtalo de nuevo.' };
    }
  },

  getStatus: () => statusState,
};

const subscribe = (listener: () => void) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

export function useCloudStatus(): CloudStatusState {
  return useSyncExternalStore(subscribe, CloudSync.getStatus, CloudSync.getStatus);
}
