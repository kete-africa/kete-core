import { randomBytes } from 'node:crypto';
import { mayRead, refusalOf, type KetePlan } from '@kete/auth';
import { inArray, sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accessUntil, plansOf } from '@/features/payments/access';
import { readBilling, startTrial } from '@/features/payments/billing';
import { type Actor } from '@/platform/actor';
import { db, getPool } from '@/platform/db';
import { organization, user } from '@/platform/schema';

// Spec 092: offers with limits, a trial that ends, reading after the end — carried in the token
// for every app to read.

const run = randomBytes(4).toString('hex');
const orgA = `org_plan_a_${run}`;
const orgB = `org_plan_b_${run}`;
const person = `usr_plan_${run}`;
const paidProduct = `prd_plan_${run}`;
const paidOffer = `ofr_plan_${run}`;
const DAY = 24 * 60 * 60 * 1000;
// The catalog is written by operators with the owner role; the application role only reads it.
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });
let trialOffer = '';

const actor = (organizationId: string, role: Actor['role']): Actor => ({
  userId: person,
  email: `${run}@example.test`,
  name: 'Awa Mensah',
  organizationId,
  role,
});

/** What an app reads of the token: the claim as the Compte Kete writes it, then verified. */
const asToken = async (organizationId: string) => ({
  apps: Object.fromEntries(
    Object.entries(await accessUntil(organizationId)).map(([app, until]) => [app, new Date(until)]),
  ),
  plans: Object.fromEntries(
    Object.entries(await plansOf(organizationId)).map(([app, plan]): [string, KetePlan] => [
      app,
      {
        offer: plan.offer,
        trial: plan.trial,
        until: new Date(plan.until),
        readableUntil: new Date(plan.readable_until),
        limits: plan.limits,
      },
    ]),
  ),
});

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: person,
    name: 'Awa Mensah',
    email: `${run}@example.test`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: orgA, name: 'A', slug: `plan-a-${run}`, createdAt: now },
    { id: orgB, name: 'B', slug: `plan-b-${run}`, createdAt: now },
  ]);
  const { rows } = await owner.query<{ id: string }>(
    `select admin_set_trial($1, 'nyatefe', 'Nyatefe — essai', 14, $2, 30) as id`,
    [`ofr_trial_${run}`, JSON.stringify({ people: 3, agents: 1 })],
  );
  trialOffer = rows[0]?.id ?? '';
  await owner.query(
    `insert into offers (id, app, name, period_days, grace_days, provider, provider_product_id,
                         price_value, price_currency)
     values ($1, 'nyatefe', 'Nyatefe Essentiel', 30, 3, 'fake', $2, 15000, 'XOF')`,
    [paidOffer, paidProduct],
  );
});

afterAll(async () => {
  await db.delete(organization).where(inArray(organization.id, [orgA, orgB]));
  await db.delete(user).where(inArray(user.id, [person]));
  await owner.query('delete from offers where id = $1', [paidOffer]);
  await owner.query('delete from kete_outbox where organization_id = any($1)', [[orgA, orgB]]);
  await owner.end();
  await getPool().end();
});

describe('the terms of an offer', () => {
  it('are set by an operator function, and refused when malformed', async () => {
    const { rows } = await owner.query<{ changed: number }>(
      `select admin_set_offer_terms('fake', $1, $2, 60) as changed`,
      [paidProduct, JSON.stringify({ people: 25, agents: 5, ai_tokens_month: 2_000_000 })],
    );
    expect(rows[0]?.changed).toBe(1);
    for (const limits of [{ seats: 3 }, { people: -1 }, { people: 1.5 }, { people: '3' }]) {
      await expect(
        owner.query(`select admin_set_offer_terms('fake', $1, $2, 60)`, [
          paidProduct,
          JSON.stringify(limits),
        ]),
      ).rejects.toThrow(/invalid limits/);
    }
  });

  it('cannot be changed by the service itself', async () => {
    // No write policy: the application role's update touches no row.
    const updated = await db.execute(sql`update offers set limits = '{}' where id = ${paidOffer}`);
    expect(updated.rowCount).toBe(0);
  });

  it('are shown with each offer; the trial apart from what is sold', async () => {
    const billing = await readBilling(actor(orgA, 'owner'));
    expect(billing.offers.find((offer) => offer.id === paidOffer)).toMatchObject({
      limits: { people: 25, agents: 5, ai_tokens_month: 2_000_000 },
    });
    expect(billing.offers.some((offer) => offer.id === trialOffer)).toBe(false);
    expect(billing.trials.find((offer) => offer.id === trialOffer)).toMatchObject({
      app: 'nyatefe',
      periodDays: 14,
      price: { value: 0 },
      limits: { people: 3, agents: 1 },
    });
  });
});

describe('a trial', () => {
  it('is started by an owner or an administrator, never by a member', async () => {
    await expect(startTrial(actor(orgA, 'member'), trialOffer)).rejects.toThrow('forbidden');
    const started = await startTrial(actor(orgA, 'owner'), trialOffer);
    expect(started.app).toBe('nyatefe');
    expect(new Date(started.until).getTime() - Date.now()).toBeGreaterThan(13.9 * DAY);
  });

  it('is once: the organization cannot start it again, nor see it offered', async () => {
    await expect(startTrial(actor(orgA, 'owner'), trialOffer)).rejects.toMatchObject({
      code: 'trial_used',
    });
    const billing = await readBilling(actor(orgA, 'owner'));
    expect(billing.trials.some((offer) => offer.app === 'nyatefe')).toBe(false);
    expect(billing.subscriptions.find((s) => s.app === 'nyatefe')).toMatchObject({
      trial: true,
      state: 'active',
    });
    // Another organization has its own.
    expect((await readBilling(actor(orgB, 'owner'))).trials.some((o) => o.id === trialOffer)).toBe(
      true,
    );
  });

  it('reaches every app in the token: its limits, refused beyond them', async () => {
    const token = await asToken(orgA);
    expect(token.plans.nyatefe).toMatchObject({
      offer: 'Nyatefe — essai',
      trial: true,
      limits: { people: 3, agents: 1 },
    });
    expect(refusalOf(token, 'nyatefe', { limit: 'people', used: 2 })).toBeNull();
    expect(refusalOf(token, 'nyatefe', { limit: 'people', used: 3 })).toMatchObject({
      reason: 'limit',
      allowed: 3,
    });
    // The other organization has nothing there.
    expect((await asToken(orgB)).plans).toEqual({});
  });

  it('ends by itself: nothing new is done, what was done stays readable for its days', async () => {
    await owner.query(
      `update subscriptions set paid_until = now() - interval '1 day',
                                grace_until = now() - interval '1 day'
        where organization_id = $1`,
      [orgA],
    );
    const ended = await asToken(orgA);
    expect(ended.apps.nyatefe).toBeUndefined();
    expect(refusalOf(ended, 'nyatefe')).toMatchObject({ reason: 'ended' });
    expect(mayRead(ended, 'nyatefe')).toBe(true);

    await owner.query(
      `update subscriptions set paid_until = now() - interval '40 days',
                                grace_until = now() - interval '40 days'
        where organization_id = $1`,
      [orgA],
    );
    const gone = await asToken(orgA);
    expect(gone.plans.nyatefe).toBeUndefined();
    expect(mayRead(gone, 'nyatefe')).toBe(false);
  });
});
