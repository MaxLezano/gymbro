import { useEffect, useState } from 'react';

/**
 * Current timestamp refreshed every `intervalMs`. Keep it in small leaf
 * components (clocks, badges) so a ticking second never re-renders a screen.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
  return now;
}
