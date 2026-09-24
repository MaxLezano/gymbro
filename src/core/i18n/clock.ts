import { getCalendars } from 'expo-localization';

/**
 * Clock time in the phone's own time zone and 12/24 h preference
 * ("16:36" or "4:36 p. m."), with Spanish day-period labels.
 */
export function formatClock(timestamp: number): string {
  const uses24hourClock = getCalendars()[0]?.uses24hourClock ?? true;
  return new Date(timestamp).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: !uses24hourClock });
}
