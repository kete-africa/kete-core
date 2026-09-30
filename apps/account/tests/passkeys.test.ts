import { randomBytes } from 'node:crypto';
import { serializeSignedCookie } from 'better-call';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth, keteClaims } from '@/platform/auth';
import { db, getPool } from '@/platform/db';
import { isOperator } from '@/platform/operators';
import { account, member, organization, passkey, user } from '@/platform/schema';
import { removePassword, signInMethods, signsInStrongly } from '@/platform/strength';
import { openOperatorSession } from '../scripts/operator-session';

// Spec 016: a passkey-only account signs in strongly — like two-factor — and so may be a Kete
// operator; a passkey-only account never loses its last passkey; the operator scripts act as a
// strongly signed-in operator without asking a password.

const run = randomBytes(4).toString('hex');
const operatorsOrg = `org_pk_ops_${run}`;
const people = {
  password: `usr_pk_pw_${run}`,
  twoFactor: `usr_pk_2fa_${run}`,
  both: `usr_pk_both_${run}`,
  passkeyOnly: `usr_pk_only_${run}`,
};
const ids = Object.values(people);

async function addPasskey(userId: string, suffix: string) {
  await db.insert(passkey).values({
    id: `pky_${suffix}_${run}`,
    name: 'Bitwarden',
    publicKey: randomBytes(32).toString('base64'),
    userId,
    credentialID: `cred_${suffix}_${run}`,
    counter: 0,
    deviceType: 'multiDevice',
    backedUp: true,
    createdAt: new Date(),
  });
}

async function addPassword(userId: string) {
  const now = new Date();
  await db.insert(account).values({
    id: `acc_${userId}`,
    accountId: userId,
    providerId: 'credential',
    userId,
    password: 'not-a-real-hash',
    createdAt: now,
    updatedAt: now,
  });
}

/** A session of `userId`, as its browser would carry it. */
async function sessionOf(userId: string): Promise<Headers> {
  const context = await auth.$context;
  const session = await context.internalAdapter.createSession(userId);
  const cookie = await serializeSignedCookie(
    context.authCookies.sessionToken.name,
    session.token,
    context.secret,
  );
  return new Headers({ cookie: cookie.split(';')[0] ?? '' });
}

beforeAll(async () => {
  process.env.KETE_OPERATORS_ORGANIZATION_ID = operatorsOrg;
  const now = new Date();
  await db.insert(user).values(
    ids.map((id) => ({
      id,
      name: id,
      email: `${id}@example.test`,
      emailVerified: false,
      twoFactorEnabled: id === people.twoFactor,
      createdAt: now,
      updatedAt: now,
    })),
  );
  await addPassword(people.password);
  await addPassword(people.twoFactor);
  await addPassword(people.both);
  await addPasskey(people.both, 'both');
  await addPasskey(people.passkeyOnly, 'only');
  await db
    .insert(organization)
    .values({ id: operatorsOrg, name: 'Kete', slug: `pk-ops-${run}`, createdAt: now });
  await db.insert(member).values(
    ids.map((userId, index) => ({
      id: `mbr_pk_${index}_${run}`,
      organizationId: operatorsOrg,
      userId,
      role: 'owner',
      createdAt: now,
    })),
  );
});

afterAll(async () => {
  await db.delete(organization).where(eq(organization.id, operatorsOrg));
  await db.delete(user).where(inArray(user.id, ids));
  await getPool().end();
});

describe('who signs in strongly', () => {
  it('a second factor, or passkeys only — a passkey next to a password is not enough', async () => {
    expect(await signsInStrongly(people.password)).toBe(false);
    expect(await signsInStrongly(people.twoFactor)).toBe(true);
    expect(await signsInStrongly(people.both)).toBe(false);
    expect(await signsInStrongly(people.passkeyOnly)).toBe(true);
  });

  it('says so in the Kete claims, and makes Kete owners operators', async () => {
    const claims = await keteClaims(
      { id: people.passkeyOnly, email: 'x@example.test', name: 'x', twoFactorEnabled: false },
      operatorsOrg,
    );
    expect(claims.two_factor).toBe(true);
    expect(await isOperator(people.passkeyOnly)).toBe(true);
    expect(await isOperator(people.both)).toBe(false);
  });
});

describe('dropping the password', () => {
  it('is refused without a passkey, and makes the account passkey-only with one', async () => {
    expect(await removePassword(people.password)).toBe('passkey_required');
    expect((await signInMethods(people.password)).password).toBe(true);
    expect(await removePassword(people.both)).toBe('removed');
    expect(await signInMethods(people.both)).toEqual({ passkeys: 1, password: false });
    expect(await signsInStrongly(people.both)).toBe(true);
  });

  it('never lets a passkey-only account remove its last passkey', async () => {
    const api = auth.api as unknown as {
      deletePasskey(input: { body: { id: string }; headers: Headers }): Promise<unknown>;
    };
    const refused = await api
      .deletePasskey({
        body: { id: `pky_only_${run}` },
        headers: await sessionOf(people.passkeyOnly),
      })
      .then(
        () => 'deleted',
        (error: { status?: string; body?: { message?: string } }) => error.body?.message,
      );
    expect(refused).toBe('last_passkey');
    expect((await signInMethods(people.passkeyOnly)).passkeys).toBe(1);
  });
});

describe('the operator scripts', () => {
  it('act as a strongly signed-in operator, and close their session', async () => {
    const session = await openOperatorSession(`${people.passkeyOnly}@example.test`);
    const signedIn = await auth.api.getSession({ headers: session.headers });
    expect(signedIn?.user.id).toBe(people.passkeyOnly);
    await session.close();
    expect(await auth.api.getSession({ headers: session.headers })).toBeNull();
  });

  it('refuse someone who does not sign in strongly', async () => {
    await expect(openOperatorSession(`${people.password}@example.test`)).rejects.toThrow(
      /Not a Kete operator/,
    );
  });
});
