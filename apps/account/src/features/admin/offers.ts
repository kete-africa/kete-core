import { createTokenVerifier, type KeteIdentity } from '@kete/auth';
import { defineCommand, executeCommand, type CommandDefinition } from '@kete/commands';
import { inOrganizationTx, sqlExecutorOf } from '@kete/tenancy/drizzle';
import { asc } from 'drizzle-orm';
import type { JSONWebKeySet } from 'jose';
import { z } from 'zod';
import { auth } from '@/platform/auth';
import { KETE_APPS_AUDIENCE } from '@/platform/claims';
import { db } from '@/platform/db';
import { env } from '@/platform/env';
import { prefixedId } from '@/platform/ids';
import { isOperator, operatorsOrganizationId } from '@/platform/operators';
import { getPaymentProvider } from '@/platform/payments';
import { offers } from '@/platform/schema';

export class AdminError extends Error {
  constructor(
    readonly status: 400 | 401 | 403,
    readonly code: string,
  ) {
    super(code);
    this.name = 'AdminError';
  }
}

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
export async function requireOperator(request: Request): Promise<KeteIdentity> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) throw new AdminError(401, 'unauthenticated');
  let identity: KeteIdentity;
  try {
    identity = await verify(token);
  } catch {
    throw new AdminError(401, 'invalid_token');
  }
  const operators = operatorsOrganizationId();
  const claimsSayOperator =
    operators !== null &&
    identity.organizationId === operators &&
    (identity.role === 'owner' || identity.role === 'admin') &&
    identity.twoFactor;
  if (!claimsSayOperator || !(await isOperator(identity.userId))) {
    throw new AdminError(403, 'not_an_operator');
  }
  return identity;
}

export const offerInput = z.object({
  app: z.enum(['firmo', 'nettio', 'nyatefe', 'cockpit']),
  productId: z.string().min(1).max(128),
  periodDays: z.number().int().min(1).max(366),
  graceDays: z.number().int().min(0).max(30).default(3),
  name: z.string().trim().min(1).max(120).optional(),
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
  input: z.object({ productId: z.string().min(1).max(128) }),
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

/** Who changes the catalog, and the key that makes a retried request harmless. */
export interface OperatorGesture {
  identity: KeteIdentity;
  idempotencyKey: string;
}

function runAsOperator<Input extends z.ZodType, Output>(
  command: CommandDefinition<Input, Output>,
  gesture: OperatorGesture,
  input: z.input<Input>,
): Promise<Output> {
  const organizationId = gesture.identity.organizationId;
  if (!organizationId) throw new AdminError(403, 'not_an_operator');
  return inOrganizationTx(db, organizationId, async (tx) => {
    const { output } = await executeCommand(sqlExecutorOf(tx), command, {
      organizationId,
      actor: { kind: 'person', id: gesture.identity.userId, channel: 'api' },
      idempotencyKey: gesture.idempotencyKey,
      input,
    });
    return output;
  });
}

export function setOffer(input: z.input<typeof offerInput>, gesture: OperatorGesture) {
  return runAsOperator(setOfferCommand, gesture, input);
}

export function disableOffer(productId: string, gesture: OperatorGesture) {
  return runAsOperator(disableOfferCommand, gesture, { productId });
}
