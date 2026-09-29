import { isPaid, PaymentProviderError, sameMoney, type Sale } from '@kete/payments';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { PHONE_COUNTRIES } from './countries';
import {
  canAdminister,
  ForbiddenError,
  inOrganization,
  requireMember,
  type Actor,
} from '@/platform/actor';
import { db } from '@/platform/db';
import { env } from '@/platform/env';
import { accountEvent, record } from '@/platform/events';
import { prefixedId } from '@/platform/ids';
import { getPaymentProvider } from '@/platform/payments';
import {
  checkouts,
  offers,
  paymentNotifications,
  subscriptions,
  type KeteApp,
} from '@/platform/schema';

const DAY_MS = 24 * 60 * 60 * 1000;
const ZERO_DECIMAL_CURRENCIES = new Set(['XOF', 'XAF', 'GNF', 'JPY']);

/** Amounts in events are integers in the currency's smallest unit (cents; F CFA as is). */
function minorUnits(value: number, currency: string): number {
  return Math.round(value * (ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 1 : 100));
}

export { PHONE_COUNTRIES };

export const checkoutInput = z.object({
  offerId: z.string().min(1).max(64),
  phoneNumber: z
    .string()
    .transform((value) => value.replace(/[\s.-]/g, ''))
    .pipe(z.string().regex(/^\d{6,15}$/)),
  countryCode: z.enum(PHONE_COUNTRIES),
});

export class BillingError extends Error {
  constructor(
    readonly code:
      'offer_unavailable' | 'checkout_not_found' | 'provider_unavailable' | 'provider_refused',
  ) {
    super(code);
    this.name = 'BillingError';
  }
}

export interface OfferView {
  id: string;
  app: KeteApp;
  name: string;
  periodDays: number;
  price: { value: number; currency: string };
}

export interface SubscriptionView {
  app: KeteApp;
  state: 'active' | 'grace' | 'expired';
  paidUntil: string;
  graceUntil: string;
}

export interface BillingView {
  offers: OfferView[];
  subscriptions: SubscriptionView[];
  canPay: boolean;
}

function stateOf(paidUntil: Date, graceUntil: Date, now = new Date()): SubscriptionView['state'] {
  if (paidUntil > now) return 'active';
  if (graceUntil > now) return 'grace';
  return 'expired';
}

/** The catalog and the active organization's subscriptions. */
export async function readBilling(actor: Actor | null): Promise<BillingView> {
  const me = requireMember(actor);
  const catalog = await db
    .select()
    .from(offers)
    .where(eq(offers.active, true))
    .orderBy(asc(offers.app), asc(offers.periodDays));
  const rows = await inOrganization(me.organizationId, (tx) => tx.select().from(subscriptions));
  return {
    offers: catalog.map((offer) => ({
      id: offer.id,
      app: offer.app,
      name: offer.name,
      periodDays: offer.periodDays,
      price: { value: offer.priceValue, currency: offer.priceCurrency },
    })),
    subscriptions: rows.map((row) => ({
      app: row.app,
      state: stateOf(row.paidUntil, row.graceUntil),
      paidUntil: row.paidUntil.toISOString(),
      graceUntil: row.graceUntil.toISOString(),
    })),
    canPay: canAdminister(me.role),
  };
}

/**
 * Starts a payment for an offer: records the checkout, then asks the provider for a payment page.
 * The returned address is where the browser goes; nothing is granted until the sale is paid.
 */
export async function startCheckout(
  actor: Actor | null,
  input: z.input<typeof checkoutInput>,
): Promise<{ checkoutId: string; checkoutUrl: string }> {
  const me = requireMember(actor);
  if (!canAdminister(me.role)) throw new ForbiddenError('forbidden');
  const value = checkoutInput.parse(input);
  const provider = getPaymentProvider();
  const [offer] = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.id, value.offerId),
        eq(offers.active, true),
        eq(offers.provider, provider.name),
      ),
    );
  if (!offer) throw new BillingError('offer_unavailable');

  const checkoutId = prefixedId('checkout');
  await inOrganization(me.organizationId, (tx) =>
    tx.insert(checkouts).values({
      id: checkoutId,
      organizationId: me.organizationId,
      offerId: offer.id,
      provider: provider.name,
      expectedValue: offer.priceValue,
      expectedCurrency: offer.priceCurrency,
      createdBy: me.userId,
    }),
  );

  const [firstName, ...rest] = me.name.trim().split(/\s+/);
  let started;
  try {
    started = await provider.startCheckout({
      productId: offer.providerProductId,
      customer: {
        email: me.email,
        firstName: firstName || me.email,
        lastName: rest.join(' ') || firstName || me.email,
        phoneNumber: value.phoneNumber,
        countryCode: value.countryCode,
      },
      returnUrl: `${env.publicUrl}/espace/abonnements?paiement=${checkoutId}`,
      metadata: { kete_checkout: checkoutId, kete_organization: me.organizationId },
    });
  } catch (error) {
    // The reason stays in the server log (no personal data in it); the person gets a plain message.
    console.warn(
      `[payments] checkout not started: ${error instanceof Error ? error.message : 'unknown'}`,
    );
    await inOrganization(me.organizationId, (tx) =>
      tx
        .update(checkouts)
        .set({ status: 'failed', decidedAt: new Date() })
        .where(eq(checkouts.id, checkoutId)),
    );
    throw new BillingError(
      error instanceof PaymentProviderError && error.code === 'unreachable'
        ? 'provider_unavailable'
        : 'provider_refused',
    );
  }
  await inOrganization(me.organizationId, (tx) =>
    tx
      .update(checkouts)
      .set({ providerSaleId: started.saleId, checkoutUrl: started.checkoutUrl })
      .where(eq(checkouts.id, checkoutId)),
  );
  return { checkoutId, checkoutUrl: started.checkoutUrl };
}

export type ReconcileOutcome =
  | { status: 'paid'; app: KeteApp; paidUntil: string }
  | { status: 'pending' }
  | { status: 'failed' | 'abandoned' }
  | { status: 'rejected'; reason: 'product_mismatch' | 'amount_mismatch' };

/**
 * Applies what the provider says about a sale to the checkout that started it — once. Access is
 * granted only for a paid sale of the expected product at the expected price; a second call, a
 * replayed notification or a concurrent one changes nothing.
 */
async function reconcile(organizationId: string, sale: Sale): Promise<ReconcileOutcome> {
  return inOrganization(organizationId, async (tx) => {
    const [checkout] = await tx
      .select()
      .from(checkouts)
      .where(eq(checkouts.providerSaleId, sale.id))
      .for('update');
    if (!checkout) throw new BillingError('checkout_not_found');
    const [offer] = await tx.select().from(offers).where(eq(offers.id, checkout.offerId));
    if (!offer) throw new BillingError('checkout_not_found');

    if (checkout.status === 'paid') {
      return {
        status: 'paid',
        app: offer.app,
        paidUntil: String(checkout.periodEnd?.toISOString()),
      };
    }
    if (checkout.status !== 'pending') return { status: checkout.status };

    if (!isPaid(sale)) {
      if (sale.status === 'failed' || sale.status === 'abandoned') {
        await tx
          .update(checkouts)
          .set({ status: sale.status, decidedAt: new Date() })
          .where(eq(checkouts.id, checkout.id));
        return { status: sale.status };
      }
      return { status: 'pending' };
    }
    // Paid — but for what was agreed? Anything else is kept for an operator, never granted.
    if (sale.productId !== offer.providerProductId) {
      return { status: 'rejected', reason: 'product_mismatch' };
    }
    if (
      !sameMoney(sale.amount, {
        value: checkout.expectedValue,
        currency: checkout.expectedCurrency,
      })
    ) {
      return { status: 'rejected', reason: 'amount_mismatch' };
    }

    const now = new Date();
    const [current] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.app, offer.app))
      .for('update');
    // Paying before the end extends it; paying later starts from today.
    const start = current && current.paidUntil > now ? current.paidUntil : now;
    const paidUntil = new Date(start.getTime() + offer.periodDays * DAY_MS);
    const graceUntil = new Date(paidUntil.getTime() + offer.graceDays * DAY_MS);
    await tx
      .insert(subscriptions)
      .values({
        id: prefixedId('subscription'),
        organizationId,
        app: offer.app,
        offerId: offer.id,
        paidUntil,
        graceUntil,
      })
      .onConflictDoUpdate({
        target: [subscriptions.organizationId, subscriptions.app],
        set: { offerId: offer.id, paidUntil, graceUntil, updatedAt: now },
      });
    await tx
      .update(checkouts)
      .set({ status: 'paid', periodEnd: paidUntil, decidedAt: now })
      .where(eq(checkouts.id, checkout.id));
    // Same transaction: access and its announcement to Kete Cockpit commit together.
    await record(
      tx,
      accountEvent('payment.succeeded', organizationId, {
        amount: minorUnits(checkout.expectedValue, checkout.expectedCurrency),
        currency: checkout.expectedCurrency.toUpperCase(),
        reference: sale.id,
      }),
    );
    return { status: 'paid', app: offer.app, paidUntil: paidUntil.toISOString() };
  });
}

/** The person came back from the payment page: re-read the sale and apply it. */
export async function confirmCheckout(
  actor: Actor | null,
  checkoutId: string,
): Promise<ReconcileOutcome> {
  const me = requireMember(actor);
  const [checkout] = await inOrganization(me.organizationId, (tx) =>
    tx.select().from(checkouts).where(eq(checkouts.id, checkoutId)),
  );
  if (!checkout?.providerSaleId) throw new BillingError('checkout_not_found');
  const sale = await getPaymentProvider().getSale(checkout.providerSaleId);
  return reconcile(me.organizationId, sale);
}

export type NotificationOutcome =
  | { status: 'refused' }
  | { status: 'duplicate' }
  | { status: 'ignored' }
  | { status: 'applied'; outcome: ReconcileOutcome };

/**
 * A provider notification: authenticated from its raw body, accepted once per delivery, then only
 * used as a hint — the sale is re-read from the provider before anything changes.
 */
export async function receiveNotification(
  rawBody: string,
  headers: Headers,
): Promise<NotificationOutcome> {
  const provider = getPaymentProvider();
  const notification = await provider.verifyNotification(rawBody, headers);
  if (!notification) return { status: 'refused' };
  const [seen] = await db
    .select({ deliveryId: paymentNotifications.deliveryId })
    .from(paymentNotifications)
    .where(eq(paymentNotifications.deliveryId, notification.deliveryId));
  if (seen) return { status: 'duplicate' };

  let result: NotificationOutcome = { status: 'ignored' };
  if (notification.saleId) {
    const { rows } = await db.execute<{ organization_id: string | null }>(
      sql`select payments_checkout_organization(${notification.saleId}) as organization_id`,
    );
    const organizationId = rows[0]?.organization_id;
    // A sale Kete did not start (another product of the store) is only recorded.
    if (organizationId) {
      const sale = await provider.getSale(notification.saleId);
      result = { status: 'applied', outcome: await reconcile(organizationId, sale) };
    }
  }
  // Recorded only once handled: a failure above lets the provider retry. Two deliveries racing
  // are harmless — reconcile decides a checkout once.
  await db
    .insert(paymentNotifications)
    .values({
      deliveryId: notification.deliveryId,
      provider: provider.name,
      event: notification.event,
      saleId: notification.saleId,
    })
    .onConflictDoNothing();
  return result;
}
