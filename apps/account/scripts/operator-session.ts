/**
 * The operator scripts act as a named Kete operator, without asking her password or her code:
 * they run with the Compte Kete's own secrets (its database and its auth secret), so whoever runs
 * them already holds the service. What they check instead is that the named person IS an operator
 * — owner or admin of Kete's organization, signing in strongly (second factor or passkeys only,
 * spec 016). A passkey cannot be used from a terminal; this keeps passkey-only operators able to
 * run them.
 *
 * The session opened for the script is closed when it ends. A one-time sign-in link is never used
 * here: verifying one strips the password of an account whose e-mail is unproven.
 */
import { serializeSignedCookie } from 'better-call';
import { eq } from 'drizzle-orm';
import { auth } from '../src/platform/auth';
import { db } from '../src/platform/db';
import { isOperator } from '../src/platform/operators';
import { user } from '../src/platform/schema';

export interface OperatorSession {
  headers: Headers;
  close(): Promise<void>;
}

export async function openOperatorSession(email: string): Promise<OperatorSession> {
  const [person] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.trim().toLowerCase()));
  if (!person || !(await isOperator(person.id))) {
    throw new Error(
      'Not a Kete operator: owner or admin of Kete, with two-factor on or a passkey-only account ' +
        '(Mon espace Kete → Sécurité).',
    );
  }
  const context = await auth.$context;
  const session = await context.internalAdapter.createSession(person.id);
  const cookie = await serializeSignedCookie(
    context.authCookies.sessionToken.name,
    session.token,
    context.secret,
  );
  return {
    headers: new Headers({ cookie: cookie.split(';')[0] ?? '' }),
    close: () => context.internalAdapter.deleteSession(session.token),
  };
}
