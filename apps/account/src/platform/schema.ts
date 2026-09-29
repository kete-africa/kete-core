import { sql } from 'drizzle-orm';
import {
  foreignKey,
  index,
  integer,
  jsonb,
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
