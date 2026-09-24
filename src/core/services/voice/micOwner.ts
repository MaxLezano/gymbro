/**
 * The phone has one speech recognizer and its events reach every listener.
 * Whoever owns the mic is the only one that reacts to them (e.g. dictating
 * "terminé" in the chat must not log a set in the workout).
 */
export type MicUser = 'commands' | 'dictation';

let owner: MicUser | null = null;
const listeners = new Set<(owner: MicUser | null) => void>();

export const MicOwner = {
  get: () => owner,
  claim(user: MicUser) {
    owner = user;
    listeners.forEach((listener) => listener(owner));
  },
  release(user: MicUser) {
    if (owner !== user) return;
    owner = null;
    listeners.forEach((listener) => listener(owner));
  },
  subscribe(listener: (owner: MicUser | null) => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
