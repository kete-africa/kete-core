import { randomBytes } from 'node:crypto';
import { readJournal } from '@kete/commands';
import { fakeProvider } from '@kete/payments';
import { inOrganizationTx, sqlExecutorOf } from '@kete/tenancy/drizzle';
import { eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AdminError,
  disableOffer,
  readCatalog,
  requireOperator,
  setOffer,
  type OperatorGesture,
} from '@/features/admin/offers';
import { auth } from '@/platform/auth';
import { db, getPool } from '@/platform/db';
import { usePaymentProvider } from '@/platform/payments';
import { member, offers, organization, user } from '@/platform/schema';

// Spec 007, FR-005: only a Kete operator — Kete's organization, owner or admin, two-factor on,
// still so in the database — may change the catalog, and only through the two definer functions.

const run = randomBytes(4).toString('hex');
const operatorsOrg = `org_ops_${run}`;
const otherOrg = `org_other_${run}`;
const operator = `usr_op_${run}`;
const productId = `prd_admin_${run}`;

const provider = fakeProvider('whsec_admin_test');
usePaymentProvider(provider);
provider.products.set(productId, {
  id: productId,
  name: 'Nettio — 30 jours',
  price: { value: 5000, currency: 'XOF' },
});
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });

/** A token signed with the Compte Kete's own keys, with the given Kete claims. */
async function token(claims: Record<string, unknown>): Promise<Request> {
  const api = auth.api as unknown as {
    signJWT(input: { body: { payload: Record<string, unknown> } }): Promise<{ token: string }>;
  };
  const { token: jwt } = await api.signJWT({
    body: {
      payload: {
        sub: operator,
        email: `${run}@example.test`,
        name: 'Operator',
        org: operatorsOrg,
        role: 'owner',
        apps: {},
        two_factor: true,
        ...claims,
      },
    },
  });
  return new Request('http://localhost/api/admin/offers', {
    headers: { authorization: `Bearer ${jwt}` },
  });
}

async function refusal(request: Request | Promise<Request>) {
  const error = await requireOperator(await request).then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(AdminError);
  return (error as AdminError).status;
}

beforeAll(async () => {
  process.env.KETE_OPERATORS_ORGANIZATION_ID = operatorsOrg;
  const now = new Date();
  await db.insert(user).values({
    id: operator,
    name: 'Operator',
    email: `${run}@example.test`,
    emailVerified: false,
    twoFactorEnabled: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: operatorsOrg, name: 'Kete', slug: `ops-${run}`, createdAt: now },
    { id: otherOrg, name: 'Other', slug: `other-${run}`, createdAt: now },
  ]);
  await db.insert(member).values({
    id: `mbr_op_${run}`,
    organizationId: operatorsOrg,
    userId: operator,
    role: 'owner',
    createdAt: now,
  });
});

afterAll(async () => {
  await owner.query('delete from offers where provider_product_id = $1', [productId]);
  await owner.query('delete from kete_commands where organization_id = $1', [operatorsOrg]);
  await db.delete(organization).where(inArray(organization.id, [operatorsOrg, otherOrg]));
  await db.delete(user).where(eq(user.id, operator));
  await owner.end();
  await getPool().end();
});

describe('who may use the admin API', () => {
  it('a Kete operator with two-factor', async () => {
    const identity = await requireOperator(await token({}));
    expect(identity.userId).toBe(operator);
  });

  it('refuses no token, an altered token, and a token from elsewhere (401)', async () => {
    expect(await refusal(new Request('http://localhost/x'))).toBe(401);
    const good = (await token({})).headers.get('authorization') ?? '';
    const altered = new Request('http://localhost/x', {
      headers: { authorization: `${good.slice(0, -4)}AAAA` },
    });
    expect(await refusal(altered)).toBe(401);
  });

  it('refuses another organization, a member, and no second factor (403)', async () => {
    expect(await refusal(token({ org: otherOrg }))).toBe(403);
    expect(await refusal(token({ role: 'member' }))).toBe(403);
    expect(await refusal(token({ two_factor: false }))).toBe(403);
  });

  it('refuses a token that says operator when the database no longer does', async () => {
    await db.update(user).set({ twoFactorEnabled: false }).where(eq(user.id, operator));
    try {
      expect(await refusal(token({}))).toBe(403);
    } finally {
      await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, operator));
    }
  });
});

/** An operator's gesture: the identity the admin API checked, and a fresh idempotency key. */
async function gesture(): Promise<OperatorGesture> {
  return {
    identity: await requireOperator(await token({})),
    idempotencyKey: `admin-test-${randomBytes(8).toString('hex')}`,
  };
}

describe('the catalog', () => {
  it('sets an offer at the provider price, whatever the caller says, then disables it', async () => {
    const saved = await setOffer({ app: 'nettio', productId, periodDays: 30 }, await gesture());
    expect(saved.price).toEqual({ value: 5000, currency: 'XOF' });
    const catalog = await readCatalog();
    expect(catalog.products.map((p) => p.id)).toContain(productId);
    expect(catalog.offers.find((o) => o.productId === productId)).toMatchObject({
      app: 'nettio',
      periodDays: 30,
      graceDays: 3,
      price: { value: 5000, currency: 'XOF' },
      active: true,
    });
    expect(await disableOffer(productId, await gesture())).toEqual({ disabled: 1 });
    const [row] = await db.select().from(offers).where(eq(offers.providerProductId, productId));
    expect(row?.active).toBe(false);
  });

  it('journals each gesture: the operator, the channel, and how to undo it (@kete/commands)', async () => {
    const journal = await inOrganizationTx(db, operatorsOrg, (tx) =>
      readJournal(sqlExecutorOf(tx), { limit: 10 }),
    );
    expect(journal.map((entry) => entry.name)).toEqual(['disable-offer', 'set-offer']);
    expect(journal[1]).toMatchObject({
      actor: { kind: 'person', id: operator },
      channel: 'api',
      reversible: true,
      inverse: 'disable-offer',
      summary: 'Offer nettio, 30 days, at 5000 XOF',
    });
  });

  it('replays a retried gesture instead of repeating it', async () => {
    const retried = await gesture();
    const first = await setOffer({ app: 'nettio', productId, periodDays: 30 }, retried);
    const again = await setOffer({ app: 'nettio', productId, periodDays: 30 }, retried);
    expect(again).toEqual(first);
    await expect(
      setOffer({ app: 'nettio', productId, periodDays: 60 }, retried),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    await disableOffer(productId, await gesture());
  });

  it('refuses what the database refuses: unknown app, absurd period', async () => {
    await expect(
      setOffer({ app: 'unknown' as 'nettio', productId, periodDays: 30 }, await gesture()),
    ).rejects.toThrow();
    await expect(
      setOffer({ app: 'nettio', productId, periodDays: 0 }, await gesture()),
    ).rejects.toThrow();
  });
});
