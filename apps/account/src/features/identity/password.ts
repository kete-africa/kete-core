import { APIError } from 'better-auth/api';
import { auth, signInMethods } from '@/platform/auth';

/** How recent a sign-in must be to change how the account signs in (spec 016). */
export const FRESH_SIGN_IN_MS = 5 * 60 * 1000;

export type AddPasswordOutcome = 'added' | 'sign_in_again' | 'has_password' | 'invalid_password';

/**
 * A passkey-only account takes a password again (spec 016), through Better Auth's own server-only
 * `setPassword`: only for her, just after signing in with her passkey, never over an existing one.
 * Her account then no longer counts as signing in strongly until she adds a second factor.
 */
export async function addPasswordFor(
  headers: Headers,
  newPassword: string,
): Promise<AddPasswordOutcome> {
  const session = await auth.api.getSession({ headers });
  if (!session) return 'sign_in_again';
  if (Date.now() - new Date(session.session.createdAt).getTime() > FRESH_SIGN_IN_MS) {
    return 'sign_in_again';
  }
  if ((await signInMethods(session.user.id)).password) return 'has_password';
  try {
    await auth.api.setPassword({ body: { newPassword }, headers });
  } catch (error) {
    if (error instanceof APIError) return 'invalid_password';
    throw error;
  }
  return 'added';
}
