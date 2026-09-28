import { sql } from 'drizzle-orm';
import { jsonb, pgPolicy, pgRole, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organization } from './auth-schema';

// Identity tables (Better Auth) — see docs/decisions/0003: global by nature, reachable only by
// this service's application role.
export * from './auth-schema';

/** The application role: no BYPASSRLS, created once per Neon project (scripts/bootstrap.sql). */
export const accountApp = pgRole('account_app').existing();

const activeOrganization = sql`current_setting('kete.organization_id', true)`;

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
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text('updated_by'),
  },
  () => [
    pgPolicy('organization_settings_isolation', {
      as: 'permissive',
      for: 'all',
      to: accountApp,
      using: sql`organization_id = ${activeOrganization}`,
      withCheck: sql`organization_id = ${activeOrganization}`,
    }),
  ],
).enableRLS();
