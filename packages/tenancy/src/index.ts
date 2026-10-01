// The public entry point of @kete/tenancy. Anything not exported here is internal.
// Drizzle helpers live in `@kete/tenancy/drizzle`.

export { setOrganization, type SqlExecutor } from '@kete/sdk';
export {
  assertRoleIsolated,
  auditRls,
  checkRoleIsolation,
  RlsBypassError,
  type RlsAuditOptions,
  type RlsViolation,
  type RoleIsolation,
} from './audit.js';
export { ACTIVE_ORGANIZATION_SQL, checkOrganizationId, ORGANIZATION_SETTING } from './setting.js';
export { organizationPolicySql, type OrganizationPolicyOptions } from './sql.js';
export { inOrganization, type ClientPool, type TransactionClient } from './transaction.js';
