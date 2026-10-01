import { createOperatorGuard, runOperatorGesture, type OperatorGesture } from '@kete/admin';
import { createTokenVerifier, type KeteIdentity } from '@kete/auth';
import { defineCommand, type CommandDefinition } from '@kete/commands';
import { KETE_APPS_AUDIENCE } from '@kete/identity';
import type { SqlExecutor } from '@kete/tenancy';
import { inOrganizationTx, sqlExecutorOf } from '@kete/tenancy/drizzle';
import { asc } from 'drizzle-orm';
import type { JSONWebKeySet } from 'jose';
import type { z } from 'zod';
import { auth } from '@/platform/auth';
import { db } from '@/platform/db';
import { env } from '@/platform/env';
import { prefixedId } from '@/platform/ids';
import { isOperator, operatorsOrganizationId } from '@/platform/operators';
import { getPaymentProvider } from '@/platform/payments';
import { offers } from '@/platform/schema';
import { disableOfferInput, offerInput } from './inputs';

export { AdminError, type OperatorGesture } from '@kete/admin';

/**
 * Verifies a token this Compte Kete issued, against its own published keys — read each time, so
 * a key rotation needs no restart (a local read, no network call to itself).
 */
async function verify(token: string): Promise<KeteIdentity> {
  const jwks = await (auth.api as unknown as { getJwks(): Promise<JSONWebKeySet> }).getJwks();
  return createTokenVerifier({ issuer: env.publicUrl, audience: KETE_APPS_AUDIENCE, jwks })(token);
}

/**
 * The caller of the admin API: a Kete operator's token (spec 007, FR-005) — Kete's organization,
 * owner or admin, two-factor — and still an operator in the database now (a token lives 15 min).
 */
export const { requireOperator } = createOperatorGuard({
  verify,
  operatorsOrganizationId,
  stillOperator: isOperator,
});

/** Products the store sells (for choosing), and the current catalog. */
export async function readCatalog() {
  const provider = getPaymentProvider();
  const [products, rows] = await Promise.all([
    provider.listProducts(),
    db.select().from(offers).orderBy(asc(offers.app), asc(offers.periodDays)),
  ]);
  return {
    provider: provider.name,
    products,
    offers: rows.map((row) => ({
      id: row.id,
      app: row.app,
      name: row.name,
      periodDays: row.periodDays,
      graceDays: row.graceDays,
      productId: row.providerProductId,
      price: { value: row.priceValue, currency: row.priceCurrency },
      active: row.active,
    })),
  };
}

/**
 * Makes a provider product an offer; its price is read from the provider, never from the caller.
 * A named command (@kete/commands): journaled with the operator, the channel and whether it can be
 * undone — disabling the offer undoes it.
 */
const setOfferCommand = defineCommand({
  name: 'set-offer',
  input: offerInput,
  reversibility: { reversible: true, inverse: 'disable-offer' },
  async handler(value, { db: tx }) {
    const provider = getPaymentProvider();
    const product = await provider.getProduct(value.productId);
    const { rows } = await tx.query<{ id: string }>(
      `select admin_set_offer($1, $2, $3, $4, $5, $6, $7, $8, $9) as id`,
      [
        prefixedId('offer'),
        value.app,
        value.name ?? product.name,
        value.periodDays,
        value.graceDays,
        provider.name,
        product.id,
        product.price.value,
        product.price.currency,
      ],
    );
    return { id: rows[0]?.id ?? null, price: product.price };
  },
  summarize: (value, output) =>
    `Offer ${value.app}, ${value.periodDays} days, at ${output.price.value} ${output.price.currency}`,
});

const disableOfferCommand = defineCommand({
  name: 'disable-offer',
  input: disableOfferInput,
  reversibility: { reversible: true, inverse: 'set-offer' },
  async handler({ productId }, { db: tx }) {
    const provider = getPaymentProvider();
    const { rows } = await tx.query<{ disabled: number }>(
      `select admin_disable_offer($1, $2) as disabled`,
      [provider.name, productId],
    );
    return { disabled: Number(rows[0]?.disabled ?? 0) };
  },
  summarize: ({ productId }, output) => `Offer ${productId} disabled (${output.disabled})`,
});

/** An operator gesture on the catalog: a journaled command, in Kete's own organization. */
async function runAsOperator<Input extends z.ZodType, Output>(
  command: CommandDefinition<Input, Output>,
  gesture: OperatorGesture,
  input: z.input<Input>,
): Promise<Output> {
  const transaction = <T>(organizationId: string, work: (db: SqlExecutor) => Promise<T>) =>
    inOrganizationTx(db, organizationId, (tx) => work(sqlExecutorOf(tx)));
  return (await runOperatorGesture(transaction, command, gesture, input)).output;
}

export function setOffer(input: z.input<typeof offerInput>, gesture: OperatorGesture) {
  return runAsOperator(setOfferCommand, gesture, input);
}

export function disableOffer(productId: string, gesture: OperatorGesture) {
  return runAsOperator(disableOfferCommand, gesture, { productId });
}
