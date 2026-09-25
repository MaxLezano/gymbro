/** Consecutive basic (offline) replies before the header admits the AI is down. */
export const OFFLINE_REPLIES_FOR_DEGRADED = 2;

/**
 * Stable header status for the coach: one basic reply is a hiccup, so the AI
 * label stays; only a run of them (newest last) switches to the degraded state.
 * Out-of-scope refusals and replies without a source do not count either way.
 */
export function coachAiDegraded(sources: readonly (string | undefined)[]): boolean {
  let offlineRun = 0;
  for (let i = sources.length - 1; i >= 0; i -= 1) {
    const source = sources[i];
    if (source === 'offline') offlineRun += 1;
    else if (source === 'online') break;
  }
  return offlineRun >= OFFLINE_REPLIES_FOR_DEGRADED;
}
