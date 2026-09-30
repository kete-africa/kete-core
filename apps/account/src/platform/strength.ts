import { and, count, eq } from 'drizzle-orm';
import { db } from './db';
import { account, passkey, user } from './schema';

/** Her passkeys and whether she still has a password: what Mon espace Kete → Sécurité shows. */
export async function signInMethods(
  userId: string,
): Promise<{ passkeys: number; password: boolean }> {
  const [passkeys] = await db
    .select({ n: count() })
    .from(passkey)
    .where(eq(passkey.userId, userId));
  const [passwords] = await db
    .select({ n: count() })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
  return { passkeys: passkeys?.n ?? 0, password: (passwords?.n ?? 0) > 0 };
}

/**
 * Whether a person always signs in strongly (spec 016): with a second factor after her password,
 * or with a passkey only — her account keeps no password once she chooses so. Every session she
 * opens then comes from that strong sign-in, so the answer holds for the person, not for one
 * session. It is what `two_factor` says in Kete tokens, and what Kete operators need.
 */
export async function signsInStrongly(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ twoFactor: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) return false;
  if (row.twoFactor === true) return true;
  const methods = await signInMethods(userId);
  return methods.passkeys > 0 && !methods.password;
}

/** Removes her password — only once she has a passkey to sign in with (spec 016). */
export async function removePassword(userId: string): Promise<'removed' | 'passkey_required'> {
  const { passkeys } = await signInMethods(userId);
  if (passkeys === 0) return 'passkey_required';
  await db
    .delete(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
  return 'removed';
}
