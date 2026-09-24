/**
 * Pure merge rules for the cloud backup (no I/O, fully testable).
 *
 * - Profile: last write wins, by `updatedAt`.
 * - Collections (routines, history): union by id, so two phones never lose each
 *   other's work. Deletions travel as tombstones (`deleted[id] = time`) so a
 *   removed item is not resurrected by the other side. When both sides hold the
 *   same id, the newer document's copy (and order) wins.
 */

export type SyncKind = 'profile' | 'customRoutines' | 'history';
export type CollectionKind = Exclude<SyncKind, 'profile'>;

export interface ProfileDoc<P> {
  profile: P;
  updatedAt: number;
}

export interface CollectionDoc<T> {
  items: T[];
  deleted: Record<string, number>;
  updatedAt: number;
}

/** Tombstones older than this are dropped; a phone offline for longer may resurrect items. */
export const TOMBSTONE_TTL_MS = 180 * 24 * 60 * 60 * 1000;

export function mergeProfile<P>(local: ProfileDoc<P>, remote: ProfileDoc<P> | null): ProfileDoc<P> {
  if (!remote) return local;
  return remote.updatedAt > local.updatedAt ? remote : local;
}

export function mergeCollection<T extends { id: string }>(
  local: CollectionDoc<T>,
  remote: CollectionDoc<T> | null,
  now = Date.now()
): CollectionDoc<T> {
  if (!remote) return { ...local, deleted: pruneTombstones(local.deleted, now) };

  const deleted: Record<string, number> = { ...remote.deleted };
  for (const [id, at] of Object.entries(local.deleted)) deleted[id] = Math.max(at, deleted[id] ?? 0);

  const [newer, older] = local.updatedAt >= remote.updatedAt ? [local, remote] : [remote, local];
  const seen = new Set<string>();
  const items: T[] = [];
  for (const item of [...newer.items, ...older.items]) {
    if (seen.has(item.id) || deleted[item.id]) continue;
    seen.add(item.id);
    items.push(item);
  }
  return { items, deleted: pruneTombstones(deleted, now), updatedAt: Math.max(local.updatedAt, remote.updatedAt) };
}

export function pruneTombstones(deleted: Record<string, number>, now = Date.now()): Record<string, number> {
  const kept: Record<string, number> = {};
  for (const [id, at] of Object.entries(deleted)) if (now - at < TOMBSTONE_TTL_MS) kept[id] = at;
  return kept;
}

/**
 * Tombstones for a local write: ids that were known before and are gone now.
 * Re-adding an id clears its tombstone.
 */
export function trackDeletions(
  previousIds: readonly string[],
  nextIds: readonly string[],
  deleted: Record<string, number>,
  now = Date.now()
): Record<string, number> {
  const next = new Set(nextIds);
  const result = { ...deleted };
  for (const id of previousIds) if (!next.has(id)) result[id] = now;
  for (const id of nextIds) delete result[id];
  return result;
}

/** Structural equality for JSON-like data (used to skip no-op writes and uploads). */
export const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
