import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';

/**
 * Optional "Continuar con Google": fills name and photo from the Google account.
 * The ID token is handed to the cloud backup (Supabase) when it is configured;
 * it is never persisted by the app.
 *
 * Requires an OAuth client in Google Cloud (Android: package com.gymbro.fitnessapp
 * + signing SHA-1, plus a Web client whose id goes in EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).
 * Without it Google answers DEVELOPER_ERROR, so the button stays hidden.
 */
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const isGoogleSignInAvailable = Boolean(WEB_CLIENT_ID);

let configured = false;
function ensureConfigured() {
  if (configured) return;
  GoogleSignin.configure({ webClientId: WEB_CLIENT_ID });
  configured = true;
}

export interface GoogleIdentity {
  name: string;
  email: string;
  photoUrl?: string;
  /** Short-lived Google ID token (only present when a web client id is configured). */
  idToken?: string;
}

export type GoogleSignInResult =
  | { status: 'success'; identity: GoogleIdentity }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  if (!isGoogleSignInAvailable) return { status: 'error', message: 'El acceso con Google no está configurado en esta versión.' };
  try {
    ensureConfigured();
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { status: 'cancelled' };
    const { user } = response.data;
    return {
      status: 'success',
      identity: {
        name: user.givenName ?? user.name ?? '',
        email: user.email,
        photoUrl: user.photo ?? undefined,
        idToken: response.data.idToken ?? undefined,
      },
    };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { status: 'cancelled' };
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { status: 'error', message: 'Necesitas Google Play Services actualizado.' };
      }
    }
    return { status: 'error', message: 'No pudimos conectar con Google. Inténtalo de nuevo.' };
  }
}

export async function signOutFromGoogle(): Promise<void> {
  if (!isGoogleSignInAvailable) return;
  try {
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // Already signed out.
  }
}
