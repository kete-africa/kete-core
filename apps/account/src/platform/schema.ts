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
import { organization, user } from './auth-schema';

// Identity tables (Better Auth) — see docs/decisions/0003: global by nature, reachable only by
// this service's application role.
export * from './auth-schema';

/** The application role: no BYPASSRLS, created once per Neon project (scripts/bootstrap.sql). */
export const accountApp = pgRole('account_app').existing();

const activeOrganization = sql`current_setting('kete.organization_id', true)`;

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
    pgPolicy('files_isolation', {
      as: 'permissive',
      for: 'all',
      to: accountApp,
      using: sql`organization_id = ${activeOrganization}`,
      withCheck: sql`organization_id = ${activeOrganization}`,
    }),
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
    pgPolicy('organization_settings_isolation', {
      as: 'permissive',
      for: 'all',
      to: accountApp,
      using: sql`organization_id = ${activeOrganization}`,
      withCheck: sql`organization_id = ${activeOrganization}`,
    }),
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
  () => [
    pgPolicy('checkouts_isolation', {
      as: 'permissive',
      for: 'all',
      to: accountApp,
      using: sql`organization_id = ${activeOrganization}`,
      withCheck: sql`organization_id = ${activeOrganization}`,
    }),
  ],
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
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('subscriptions_organization_app_key').on(table.organizationId, table.app),
    pgPolicy('subscriptions_isolation', {
      as: 'permissive',
      for: 'all',
      to: accountApp,
      using: sql`organization_id = ${activeOrganization}`,
      withCheck: sql`organization_id = ${activeOrganization}`,
    }),
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
