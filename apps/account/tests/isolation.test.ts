import { randomBytes } from 'node:crypto';
import { inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readSettings, saveSettings } from '@/features/settings/settings';
import { ForbiddenError, inOrganization, type Actor } from '@/platform/actor';
import { db, getPool } from '@/platform/db';
import { organization, organizationSettings, user } from '@/platform/schema';

// SC-002: two organizations never see nor change each other's settings — enforced by the database
// (row-level security on the application role), and again by the service.

const run = randomBytes(4).toString('hex');
const orgA = `org_test_a_${run}`;
const orgB = `org_test_b_${run}`;
const userA = `usr_test_a_${run}`;

const settings = {
  locale: 'fr' as const,
  timeZone: 'Africa/Lome',
  currency: 'XOF',
  notificationChannels: ['email' as const],
};

function actor(organizationId: string | null, role: Actor['role']): Actor {
  return { userId: userA, email: `${run}@example.test`, name: 'Test', organizationId, role };
}

beforeAll(async () => {
  const now = new Date();
  await db.insert(user).values({
    id: userA,
    name: 'Test',
    email: `${run}@example.test`,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(organization).values([
    { id: orgA, name: 'A', slug: `a-${run}`, createdAt: now },
    { id: orgB, name: 'B', slug: `b-${run}`, createdAt: now },
  ]);
});

afterAll(async () => {
  await db.delete(organization).where(inArray(organization.id, [orgA, orgB]));
  await db.delete(user).where(inArray(user.id, [userA]));
  await getPool().end();
});

describe('organization settings isolation (database)', () => {
  it('runs as a role that row-level security applies to', async () => {
    const { rows } = await getPool().query<{ bypass: boolean; enabled: boolean }>(
      `select rolbypassrls as bypass,
              (select relrowsecurity from pg_class where relname = 'organization_settings') as enabled
         from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ bypass: false, enabled: true });
  });

  it('shows an organization only its own row', async () => {
    await inOrganization(orgA, (tx) =>
      tx.insert(organizationSettings).values({ organizationId: orgA, companyName: 'A SARL' }),
    );
    const seenByA = await inOrganization(orgA, (tx) => tx.select().from(organizationSettings));
    const seenByB = await inOrganization(orgB, (tx) => tx.select().from(organizationSettings));
    expect(seenByA.map((row) => row.companyName)).toEqual(['A SARL']);
    expect(seenByB).toEqual([]);
  });

  it('shows nothing when no organization is set', async () => {
    const rows = await db.select().from(organizationSettings);
    expect(rows.filter((row) => row.organizationId === orgA)).toEqual([]);
  });

  it("refuses to write another organization's row", async () => {
    await expect(
      inOrganization(orgB, (tx) =>
        tx.insert(organizationSettings).values({ organizationId: orgA, companyName: 'forged' }),
      ),
    ).rejects.toThrow();
    const updated = await inOrganization(orgB, (tx) =>
      tx
        .update(organizationSettings)
        .set({ companyName: 'forged' })
        .where(sql`organization_id = ${orgA}`)
        .returning(),
    );
    expect(updated).toEqual([]);
    const deleted = await inOrganization(orgB, (tx) =>
      tx
        .delete(organizationSettings)
        .where(sql`organization_id = ${orgA}`)
        .returning(),
    );
    expect(deleted).toEqual([]);
    const [row] = await inOrganization(orgA, (tx) => tx.select().from(organizationSettings));
    expect(row?.companyName).toBe('A SARL');
  });
});

describe('organization settings (service)', () => {
  it('saves for the active organization only, and reads them back', async () => {
    await saveSettings(actor(orgB, 'admin'), {
      ...settings,
      companyName: 'B SA',
      rccm: 'TG-LOM-01',
    });
    const b = await readSettings(actor(orgB, 'member'));
    const a = await readSettings(actor(orgA, 'owner'));
    expect(b).toMatchObject({ companyName: 'B SA', rccm: 'TG-LOM-01', canEdit: false });
    expect(a).toMatchObject({ companyName: 'A SARL', rccm: '', canEdit: true });
  });

  it('refuses a member, a person without organization, and nobody', async () => {
    await expect(saveSettings(actor(orgA, 'member'), settings)).rejects.toThrow(ForbiddenError);
    await expect(saveSettings(actor(null, null), settings)).rejects.toThrow(ForbiddenError);
    await expect(saveSettings(null, settings)).rejects.toThrow(ForbiddenError);
    await expect(readSettings(null)).rejects.toThrow(ForbiddenError);
  });

  it('refuses invalid values', async () => {
    await expect(
      saveSettings(actor(orgA, 'owner'), { ...settings, currency: 'franc' }),
    ).rejects.toThrow();
    await expect(
      saveSettings(actor(orgA, 'owner'), { ...settings, notificationChannels: [] }),
    ).rejects.toThrow();
  });
});
