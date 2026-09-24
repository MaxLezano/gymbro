import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { isGoogleSignInAvailable } from '../googleAuth';

/**
 * Optional cloud backup. Without EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY the app runs 100% on device.
 * The session is stored with the AsyncStorage the app already ships, so no
 * extra native module is needed.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

/** Backup needs both Supabase and Google (Google is the only way to sign in to it). */
export const isCloudAvailable = Boolean(supabase) && isGoogleSignInAvailable;

// Refresh tokens only while the app is in the foreground (saves battery).
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export type CloudAuthResult = { status: 'success'; userId: string } | { status: 'error'; message: string };

/** Exchanges a Google ID token for a Supabase session. */
export async function connectCloud(idToken: string | undefined): Promise<CloudAuthResult> {
  if (!supabase) return { status: 'error', message: 'El respaldo en la nube no está configurado en esta versión.' };
  if (!idToken) return { status: 'error', message: 'Google no devolvió un token válido.' };
  try {
    const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: idToken });
    if (error || !data.user) return { status: 'error', message: 'No pudimos conectar con el respaldo. Inténtalo más tarde.' };
    return { status: 'success', userId: data.user.id };
  } catch {
    return { status: 'error', message: 'Sin conexión. Tus datos siguen guardados en este teléfono.' };
  }
}

/** Current Supabase user id from the stored session (no network). */
export async function currentCloudUserId(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export async function disconnectCloud(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Local session is cleared even when offline.
  }
}
