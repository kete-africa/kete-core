import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  boolean,
  pgPolicy,
  pgRole,
  pgTable,
  text,
  unique,
  timestamp,
} from 'drizzle-orm/pg-core';
import type { LimitName } from '@kete/auth';
import { organizationIsolation } from '@kete/tenancy/drizzle';
import { organization, user } from '@kete/identity/schema';

// Identity tables (Better Auth) — see docs/decisions/0003: global by nature, reachable only by
// this service's application role.
export * from '@kete/identity/schema';

/** The application role: no BYPASSRLS, created once per Neon project (scripts/bootstrap.sql). */
export const accountApp = pgRole('account_app').existing();

/**
 * A one-time sign-in link an app requested for a person (spec 013). Identity data, global like the
 * other identity tables (decision 0003): who, for which app, where to land, until when, used or not.
 * The secret itself is the magic link's token, stored hashed by Better Auth.
 */
export const appSignInLinks = pgTable('app_sign_in_links', {
  id: text('id').primaryKey(),
  clientId: text('client_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  returnTo: text('return_to').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A file of an organization: what it is and where its content lives, separate from the content
 * itself (decision 0001). Content is served only once `status` is `available`.
 */
export const files = pgTable(
  'files',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    /** Why the file exists; drives who sees it and how long it is kept. */
    purpose: text('purpose').$type<'organization_logo'>().notNull(),
    status: text('status')
      .$type<'pending' | 'available' | 'rejected' | 'deleted'>()
      .notNull()
      .default('pending'),
    /** Where the browser sends the original; emptied once the file is decided. */
    uploadKey: text('upload_key'),
    /** Where the safe, re-encoded content lives once available. */
    contentKey: text('content_key'),
    contentType: text('content_type'),
    sizeBytes: integer('size_bytes'),
    sha256: text('sha256'),
    width: integer('width'),
    height: integer('height'),
    rejectionReason: text('rejection_reason'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  (table) => [
    index('files_organization_idx').on(table.organizationId, table.purpose, table.status),
    // Lets other tables require that a file belongs to the same organization.
    unique('files_organization_id_id_key').on(table.organizationId, table.id),
    organizationIsolation('files_isolation', accountApp),
  ],
).enableRLS();

/**
 * Generic settings of an organization, entered once in Mon espace Kete and read by every Kete app
 * (doctrine D-013). Isolated per organization in the database.
 */
export const organizationSettings = pgTable(
  'organization_settings',
  {
    organizationId: text('organization_id')
      .primaryKey()
      .references(() => organization.id, { onDelete: 'cascade' }),
    companyName: text('company_name'),
    address: text('address'),
    phone: text('phone'),
    email: text('email'),
    /** Legal identifiers, e.g. { rccm: '...', nif: '...' }. */
    legalIds: jsonb('legal_ids').$type<Record<string, string>>().notNull().default({}),
    locale: text('locale').notNull().default('fr'),
    timeZone: text('time_zone').notNull().default('Africa/Lome'),
    currency: text('currency').notNull().default('XOF'),
    /** Preferred notification channels, in order: 'email' | 'whatsapp' | 'telegram'. */
    notificationChannels: jsonb('notification_channels')
      .$type<string[]>()
      .notNull()
      .default(['email']),
    /** The organization's logo, shown by every Kete app. */
    logoFileId: text('logo_file_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by'),
  },
  (table) => [
    // The logo is a file of the same organization, enforced by the database itself. No action on
    // delete: a logo in use cannot be deleted, yet removing the organization removes both.
    foreignKey({
      name: 'organization_settings_logo_file_fk',
      columns: [table.organizationId, table.logoFileId],
      foreignColumns: [files.organizationId, files.id],
    }),
    organizationIsolation('organization_settings_isolation', accountApp),
  ],
).enableRLS();

/**
 * A person's preferences (spec 115; decision 0013): her layer of Kete's settings — language, theme,
 * time zone, quiet hours… — the same in every Kete app. Identity data, global like the other identity
 * tables (decision 0003): a person is one across her organizations.
 */
export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  values: jsonb('values').$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** How an organization's Kete runs (spec 123; phase 11, step B3). */
export type DeploymentMode = 'shared' | 'dedicated' | 'on_premises' | 'autonomous';

/**
 * Where an organization's Kete runs and since when (spec 123): its mode, its region, the apps
 * beside it, and its address once ready. One per organization and product; a request in another
 * mode is kept beside the running one until Kete's fleet makes it.
 */
export const deployments = pgTable(
  'deployments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    product: text('product').notNull(),
    mode: text('mode').$type<DeploymentMode>().notNull(),
    region: text('region').notNull(),
    apps: text('apps').array().notNull().default([]),
    status: text('status').$type<'requested' | 'ready'>().notNull().default('requested'),
    url: text('url'),
    /** Another mode asked while this one runs: Kete's fleet makes it, then it replaces this one. */
    requestedMode: text('requested_mode').$type<DeploymentMode>(),
    requestedBy: text('requested_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('deployments_one_per_product').on(table.organizationId, table.product),
    organizationIsolation('deployments_isolation', accountApp),
  ],
).enableRLS();

/**
 * A standing mandate (spec 150): a person lets one of her agents act for her while she is away —
 * the center's agent, through one app client, in one organization. Given once with her own token,
 * withdrawn by her at any time. Each use asks the Compte Kete again: her claims as they are now,
 * ten minutes at most; withdrawn, or she no longer a member, nothing more is signed.
 */
export const standingMandates = pgTable(
  'standing_mandates',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    /** The center's client that asked for it: only that client may use it. */
    clientId: text('client_id').notNull(),
    agentId: text('agent_id').notNull(),
    agentName: text('agent_name').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    unique('standing_mandates_one_per_agent').on(
      table.organizationId,
      table.userId,
      table.clientId,
      table.agentId,
    ),
    organizationIsolation('standing_mandates_isolation', accountApp),
  ],
).enableRLS();

/** The Kete apps an organization can subscribe to. */
export type KeteApp = 'firmo' | 'nettio' | 'nyatefe' | 'cockpit';

/**
 * Kete's catalog: what can be bought, for how long, through which provider product. Global — the
 * same for every organization. The application role can only read it; operators change it with
 * the owner role (scripts/offers.ts), the provider's price being the reference.
 */
export const offers = pgTable(
  'offers',
  {
    id: text('id').primaryKey(),
    app: text('app').$type<KeteApp>().notNull(),
    name: text('name').notNull(),
    periodDays: integer('period_days').notNull(),
    graceDays: integer('grace_days').notNull().default(3),
    provider: text('provider').notNull(),
    providerProductId: text('provider_product_id').notNull(),
    priceValue: numeric('price_value', { precision: 14, scale: 2, mode: 'number' }).notNull(),
    priceCurrency: text('price_currency').notNull(),
    active: boolean('active').notNull().default(true),
    /** What the offer allows (spec 092): people, AI tokens a month, storage, apps, agents. */
    limits: jsonb('limits').$type<Partial<Record<LimitName, number>>>().notNull().default({}),
    /** Days during which what was done stays readable once the use has ended. */
    readDays: integer('read_days').notNull().default(90),
    /** A trial: free, once per organization and app, never sold. */
    trial: boolean('trial').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('offers_provider_product_key').on(table.provider, table.providerProductId),
    pgPolicy('offers_read', { as: 'permissive', for: 'select', to: accountApp, using: sql`true` }),
  ],
).enableRLS();

/**
 * A payment an organization started. The provider's sale id is known before the customer pays;
 * it is how a notification finds its organization — never the metadata the provider echoes.
 */
export const checkouts = pgTable(
  'checkouts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    offerId: text('offer_id')
      .notNull()
      .references(() => offers.id),
    provider: text('provider').notNull(),
    providerSaleId: text('provider_sale_id').unique(),
    status: text('status')
      .$type<'pending' | 'paid' | 'failed' | 'abandoned'>()
      .notNull()
      .default('pending'),
    /** What the offer cost when the payment started; the sale must match it. */
    expectedValue: numeric('expected_value', { precision: 14, scale: 2, mode: 'number' }).notNull(),
    expectedCurrency: text('expected_currency').notNull(),
    checkoutUrl: text('checkout_url'),
    /** The access this payment granted, once paid. */
    periodEnd: timestamp('period_end', { withTimezone: true }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
  },
  () => [organizationIsolation('checkouts_isolation', accountApp)],
).enableRLS();

/** An organization's access to one app: paid until `paidUntil`, then a grace period. */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organization.id, { onDelete: 'cascade' }),
    app: text('app').$type<KeteApp>().notNull(),
    offerId: text('offer_id')
      .notNull()
      .references(() => offers.id),
    paidUntil: timestamp('paid_until', { withTimezone: true }).notNull(),
    graceUntil: timestamp('grace_until', { withTimezone: true }).notNull(),
    trial: boolean('trial').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('subscriptions_organization_app_key').on(table.organizationId, table.app),
    organizationIsolation('subscriptions_isolation', accountApp),
  ],
).enableRLS();

/**
 * Every provider notification accepted, once: the delivery id is the idempotency key. Holds no
 * organization data; written only after the signature is verified.
 */
export const paymentNotifications = pgTable('payment_notifications', {
  deliveryId: text('delivery_id').primaryKey(),
  provider: text('provider').notNull(),
  event: text('event').notNull(),
  saleId: text('sale_id'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
});
