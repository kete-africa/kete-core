import { randomBytes } from 'node:crypto';
import { fakeProvider } from '@kete/payments';
import { inArray, sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accessUntil } from '@/features/payments/access';
import {
  BillingError,
  confirmCheckout,
  readBilling,
  receiveNotification,
  startCheckout,
} from '@/features/payments/billing';
import { ForbiddenError, inOrganization, type Actor } from '@/platform/actor';
import { db, getPool } from '@/platform/db';
import { usePaymentProvider } from '@/platform/payments';
import {
  checkouts,
  organization,
  paymentNotifications,
  subscriptions,
  user,
} from '@/platform/schema';

// Spec 006: a payment grants access once, only when the provider confirms the agreed sale, and
// never to another organization.

const run = randomBytes(4).toString('hex');
const orgA = `org_pay_a_${run}`;
const orgB = `org_pay_b_${run}`;
const person = `usr_pay_${run}`;
const productId = `prd_test_${run}`;
const offerId = `ofr_test_${run}`;
const DAY = 24 * 60 * 60 * 1000;

const provider = fakeProvider('whsec_payments_test');
usePaymentProvider(provider);
// The catalog is written by operators with the owner role; the application role only reads it.
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });

function actor(organizationId: string, role: Actor['role']): Actor {
  return { userId: person, email: `${run}@example.test`, name: 'Awa Mensah', organizationId, role };
}
const ownerA = actor(orgA, 'owner');
const payment = { offerId, phoneNumber: '90 00 00 00', countryCode: 'TG' as const };

async function subscription(organizationId: string) {
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(subscriptions));
  return row;
}

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
    { id: orgA, name: 'A', slug: `pay-a-${run}`, createdAt: now },
    { id: orgB, name: 'B', slug: `pay-b-${run}`, createdAt: now },
  ]);
  await owner.query(
    `insert into offers (id, app, name, period_days, grace_days, provider, provider_product_id,
                         price_value, price_currency)
     values ($1, 'nettio', 'Nettio — 30 jours', 30, 3, 'fake', $2, 5000, 'XOF')`,
    [offerId, productId],
  );
  provider.products.set(productId, {
    id: productId,
    name: 'Nettio — 30 jours',
    price: { value: 5000, currency: 'XOF' },
  });
});

afterAll(async () => {
  await db
    .delete(paymentNotifications)
    .where(inArray(paymentNotifications.saleId, [...provider.sales.keys()]));
  await db.delete(organization).where(inArray(organization.id, [orgA, orgB]));
  await db.delete(user).where(inArray(user.id, [person]));
  await owner.query('delete from offers where id = $1', [offerId]);
  await owner.end();
  await getPool().end();
});

describe('catalog', () => {
  it('cannot be changed by the service itself', async () => {
    // No write policy: the application role's update touches no row.
    const updated = await db.execute(sql`update offers set price_value = 1 where id = ${offerId}`);
    expect(updated.rowCount).toBe(0);
    const { offers } = await readBilling(ownerA);
    expect(offers.find((o) => o.id === offerId)?.price).toEqual({ value: 5000, currency: 'XOF' });
  });
});

describe('a paid sale', () => {
  let first = '';

  it('starts a checkout with the person and the organization, and grants nothing yet', async () => {
    const { checkoutId, checkoutUrl } = await startCheckout(ownerA, payment);
    first = checkoutId;
    expect(checkoutUrl).toMatch(/^https:\/\/pay\.fake\.test\//);
    const sale = [...provider.sales.values()].at(-1);
    expect(sale?.input).toMatchObject({
      productId,
      customer: {
        email: `${run}@example.test`,
        firstName: 'Awa',
        lastName: 'Mensah',
        phoneNumber: '90000000',
        countryCode: 'TG',
      },
      metadata: { kete_checkout: checkoutId, kete_organization: orgA },
    });
    expect(sale?.input.returnUrl).toContain(`/espace/abonnements?paiement=${checkoutId}`);
    expect(await subscription(orgA)).toBeUndefined();
    expect(await confirmCheckout(ownerA, checkoutId)).toEqual({ status: 'pending' });
  });

  it('opens access for the period once the provider confirms it, from its notification', async () => {
    const [row] = await inOrganization(orgA, (tx) =>
      tx
        .select()
        .from(checkouts)
        .where(inArray(checkouts.id, [first])),
    );
    const saleId = String(row?.providerSaleId);
    provider.settle(saleId, 'completed');
    const { body, headers } = provider.notify(saleId, 'successful.sale');
    const before = Date.now();
    const result = await receiveNotification(body, headers);
    expect(result).toMatchObject({ status: 'applied', outcome: { status: 'paid', app: 'nettio' } });
    const sub = await subscription(orgA);
    expect(sub?.paidUntil.getTime()).toBeGreaterThanOrEqual(before + 30 * DAY - 5000);
    expect(sub && sub.graceUntil.getTime() - sub.paidUntil.getTime()).toBe(3 * DAY);
    expect(Object.keys(await accessUntil(orgA))).toEqual(['nettio']);
  });

  it('is applied once: a replayed notification and a later confirmation change nothing', async () => {
    const before = await subscription(orgA);
    const [row] = await inOrganization(orgA, (tx) =>
      tx
        .select()
        .from(checkouts)
        .where(inArray(checkouts.id, [first])),
    );
    const { body, headers } = provider.notify(String(row?.providerSaleId), 'successful.sale');
    expect(await receiveNotification(body, headers)).toEqual({ status: 'duplicate' });
    const again = provider.notify(
      String(row?.providerSaleId),
      'successful.sale',
      `pd_other_${run}`,
    );
    expect(await receiveNotification(again.body, again.headers)).toMatchObject({
      status: 'applied',
      outcome: { status: 'paid' },
    });
    expect(await confirmCheckout(ownerA, first)).toMatchObject({ status: 'paid' });
    expect((await subscription(orgA))?.paidUntil).toEqual(before?.paidUntil);
  });

  it('extends from the end of the current period when paid early', async () => {
    const before = await subscription(orgA);
    const { checkoutId } = await startCheckout(ownerA, payment);
    const sale = [...provider.sales.values()].at(-1);
    provider.settle(String(sale?.id), 'completed');
    expect(await confirmCheckout(ownerA, checkoutId)).toMatchObject({ status: 'paid' });
    const after = await subscription(orgA);
    expect(after && before && after.paidUntil.getTime() - before.paidUntil.getTime()).toBe(
      30 * DAY,
    );
  });
});

describe('what never grants access', () => {
  it('a forged or anonymous notification', async () => {
    const forged = fakeProvider('whsec_attacker').notify('SALEFORGED', 'successful.sale');
    expect(await receiveNotification(forged.body, forged.headers)).toEqual({ status: 'refused' });
    expect(await receiveNotification('{}', new Headers())).toEqual({ status: 'refused' });
  });

  it('a notification that says "paid" while the provider says otherwise', async () => {
    const orgBOwner = actor(orgB, 'owner');
    const { checkoutId } = await startCheckout(orgBOwner, payment);
    const sale = [...provider.sales.values()].at(-1);
    const { body, headers } = provider.notify(String(sale?.id), 'successful.sale');
    expect(await receiveNotification(body, headers)).toMatchObject({
      outcome: { status: 'pending' },
    });
    provider.settle(String(sale?.id), 'failed');
    expect(await confirmCheckout(orgBOwner, checkoutId)).toEqual({ status: 'failed' });
    expect(await subscription(orgB)).toBeUndefined();
  });

  it('a paid sale for a different amount or product', async () => {
    const orgBOwner = actor(orgB, 'owner');
    const { checkoutId } = await startCheckout(orgBOwner, payment);
    const sale = [...provider.sales.values()].at(-1);
    provider.settle(String(sale?.id), 'completed', { value: 100, currency: 'XOF' });
    expect(await confirmCheckout(orgBOwner, checkoutId)).toEqual({
      status: 'rejected',
      reason: 'amount_mismatch',
    });
    const other = await startCheckout(orgBOwner, payment);
    const otherSale = [...provider.sales.values()].at(-1);
    if (otherSale) otherSale.productId = 'prd_something_else';
    provider.settle(String(otherSale?.id), 'completed');
    expect(await confirmCheckout(orgBOwner, other.checkoutId)).toEqual({
      status: 'rejected',
      reason: 'product_mismatch',
    });
    expect(await subscription(orgB)).toBeUndefined();
  });

  it('an offer the provider refuses: the checkout is closed, the reason is explicit', async () => {
    const product = provider.products.get(productId);
    provider.products.delete(productId);
    try {
      await expect(startCheckout(ownerA, payment)).rejects.toMatchObject({
        code: 'provider_refused',
      });
    } finally {
      if (product) provider.products.set(productId, product);
    }
    const failed = await inOrganization(orgA, (tx) => tx.select().from(checkouts));
    expect(failed.some((row) => row.status === 'failed' && row.providerSaleId === null)).toBe(true);
  });

  it("another organization's payment, and a member's attempt", async () => {
    expect((await readBilling(actor(orgB, 'member'))).subscriptions).toEqual([]);
    expect(await inOrganization(orgB, (tx) => tx.select().from(subscriptions))).toEqual([]);
    const aCheckouts = await inOrganization(orgA, (tx) => tx.select().from(checkouts));
    await expect(confirmCheckout(actor(orgB, 'owner'), String(aCheckouts[0]?.id))).rejects.toThrow(
      BillingError,
    );
    await expect(startCheckout(actor(orgA, 'member'), payment)).rejects.toThrow(ForbiddenError);
    await expect(startCheckout(ownerA, { ...payment, offerId: 'ofr_missing' })).rejects.toThrow(
      BillingError,
    );
    await expect(startCheckout(ownerA, { ...payment, phoneNumber: 'abc' })).rejects.toThrow();
  });
});
