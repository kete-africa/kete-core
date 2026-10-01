/** The transaction setting every RLS policy of a Kete service reads (constitution V). */
export const ORGANIZATION_SETTING = 'kete.organization_id';

/** The SQL expression of the active organization, for policies written by hand. */
export const ACTIVE_ORGANIZATION_SQL = `current_setting('${ORGANIZATION_SETTING}', true)`;

const organizationId = /^[A-Za-z0-9_-]{1,128}$/;

/** Refuses an empty or malformed organization identifier before it reaches a policy. */
export function checkOrganizationId(value: string): string {
  if (!organizationId.test(value)) {
    throw new TypeError(`Invalid organization identifier: ${JSON.stringify(value)}`);
  }
  return value;
}
