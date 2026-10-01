import { assertRoleIsolated, auditRls } from '@kete/tenancy';
import { afterAll, describe, expect, it } from 'vitest';
import { getPool } from '@/platform/db';

// Constitution V, checked on the migrated database: every table holding organization data has
// row-level security and a policy, and the service's role cannot bypass them (@kete/tenancy).
// Better Auth's membership tables carry an organization but are global by decision 0003.
const globalByDecision0003 = ['member', 'invitation'];

afterAll(async () => {
  await getPool().end();
});

describe('row-level security audit', () => {
  it('leaves no table of organization data without its isolation', async () => {
    const violations = await auditRls(getPool(), { exempt: globalByDecision0003 });
    expect(violations).toEqual([]);
  });

  it('connects the service with a role that row-level security applies to', async () => {
    await expect(assertRoleIsolated(getPool())).resolves.toBeUndefined();
  });
});
