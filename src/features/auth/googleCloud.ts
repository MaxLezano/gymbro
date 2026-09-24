import { signInWithGoogle, type GoogleIdentity } from '../../core/services/googleAuth';
import { connectCloud, isCloudAvailable } from '../../core/services/cloud/supabaseClient';

export type GoogleCloudResult =
  | { status: 'success'; identity: GoogleIdentity; cloudUserId?: string; cloudError?: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

/**
 * Google sign-in plus, when the backup is configured, a Supabase session for the
 * same Google account. A cloud failure (offline, misconfigured) never blocks the
 * sign-in: the athlete enters with local data and can reconnect later.
 */
export async function signInWithGoogleAndCloud(): Promise<GoogleCloudResult> {
  const result = await signInWithGoogle();
  if (result.status !== 'success') return result;
  if (!isCloudAvailable) return { status: 'success', identity: result.identity };
  const cloud = await connectCloud(result.identity.idToken);
  return cloud.status === 'success'
    ? { status: 'success', identity: result.identity, cloudUserId: cloud.userId }
    : { status: 'success', identity: result.identity, cloudError: cloud.message };
}
