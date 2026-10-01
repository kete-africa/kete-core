import { and, count, eq } from 'drizzle-orm';
import type { IdentityDatabase } from './database.js';
import { account, passkey, user } from './schema.js';

export interface SignInMethods {
  /** Her passkeys and whether she still has a password: what a security page shows. */
  signInMethods(userId: string): Promise<{ passkeys: number; password: boolean }>;
  /**
   * Whether a person always signs in strongly (spec 016): with a second factor after her password,
   * or with a passkey only — her account keeps no password once she chooses so. Every session she
   * opens then comes from that strong sign-in, so the answer holds for the person, not for one
   * session. It is what `two_factor` says in Kete tokens, and what Kete operators need.
   */
  signsInStrongly(userId: string): Promise<boolean>;
  /** Removes her password — only once she has a passkey to sign in with (spec 016). */
  removePassword(userId: string): Promise<'removed' | 'passkey_required'>;
}

export function signInMethodsOf(db: IdentityDatabase): SignInMethods {
  async function signInMethods(userId: string) {
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

  return {
    signInMethods,
    async signsInStrongly(userId) {
      const [row] = await db
        .select({ twoFactor: user.twoFactorEnabled })
        .from(user)
        .where(eq(user.id, userId));
      if (!row) return false;
      if (row.twoFactor === true) return true;
      const methods = await signInMethods(userId);
      return methods.passkeys > 0 && !methods.password;
    },
    async removePassword(userId) {
      const { passkeys } = await signInMethods(userId);
      if (passkeys === 0) return 'passkey_required';
      await db
        .delete(account)
        .where(and(eq(account.userId, userId), eq(account.providerId, 'credential')));
      return 'removed';
    },
  };
}
