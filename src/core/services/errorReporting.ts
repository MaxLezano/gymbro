import * as Sentry from '@sentry/react-native';

/** Project DSN from .env.local; without it reporting stays off (local and dev builds). */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const errorReportingEnabled = !!DSN && !__DEV__;

/**
 * Crash and error reporting for release builds. Sends stack traces and device/app
 * versions only: no names, emails, IPs or workout data (sendDefaultPii off).
 */
export function initErrorReporting(): void {
  if (!errorReportingEnabled) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    // Errors only: performance tracing would burn the free plan quota for little value here.
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
  });
}

/** Wraps the root component so render crashes are captured too (no-op when reporting is off). */
export const withErrorReporting = (component: () => React.ReactNode): React.ComponentType =>
  errorReportingEnabled ? Sentry.wrap(component) : component;
