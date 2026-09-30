import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { drizzle } from 'drizzle-orm/node-postgres';
import { pgRole, pgTable, serial, text } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertRoleIsolated,
  auditRls,
  checkOrganizationId,
  checkRoleIsolation,
  inOrganization,
  organizationPolicySql,
  RlsBypassError,
} from '../src/index.js';
import { activeOrganization, inOrganizationTx, organizationIsolation } from '../src/drizzle.js';

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(`create table notes (id serial primary key, organization_id text not null, body text);
        create table forgotten (id serial primary key, organization_id text not null);
        create table unguarded (id serial primary key, organization_id text not null);
        alter table unguarded enable row level security;
        create table catalog (id serial primary key, name text);`);
      await owner.query(organizationPolicySql({ schema, table: 'notes', appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

describe('organizationPolicySql', () => {
  it('isolates a table per organization', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'notes',
      organizations: ['org_a', 'org_b'],
      insert: async (client, org) => {
        await client.query(`insert into notes (organization_id, body) values ($1, 'x')`, [org]);
      },
    });
  });

  it('refuses identifiers that are not plain SQL names', () => {
    expect(() => organizationPolicySql({ table: 'notes; drop', appRole: 'app' })).toThrow();
  });
});

describe('inOrganization', () => {
  it('sets the organization for the transaction only', async () => {
    const inside = await inOrganization(db.app, 'org_a', async (client) => {
      const { rows } = await client.query<{ org: string }>(
        `select current_setting('kete.organization_id', true) as org`,
      );
      return rows[0]?.org;
    });
    expect(inside).toBe('org_a');
    const { rows } = await db.app.query<{ n: string }>(`select count(*)::text as n from notes`);
    expect(rows[0]?.n).toBe('0');
  });

  it('rolls back when the work fails', async () => {
    await expect(
      inOrganization(db.app, 'org_a', async (client) => {
        await client.query(`insert into notes (organization_id, body) values ('org_a', 'lost')`);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const count = await inOrganization(db.app, 'org_a', async (client) => {
      const { rows } = await client.query(`select 1 from notes where body = 'lost'`);
      return rows.length;
    });
    expect(count).toBe(0);
  });

  it('refuses an empty or malformed organization', async () => {
    await expect(inOrganization(db.app, '', async () => 1)).rejects.toThrow(TypeError);
    expect(() => checkOrganizationId("org'; --")).toThrow(TypeError);
  });
});

describe('auditRls', () => {
  it('names every table holding organization data without its isolation', async () => {
    const violations = await auditRls(db.owner, { schema: db.schema });
    expect(violations).toEqual([
      { table: 'forgotten', problem: 'row level security disabled' },
      { table: 'unguarded', problem: 'no policy' },
    ]);
  });

  it('skips the tables that are global by decision', async () => {
    const violations = await auditRls(db.owner, {
      schema: db.schema,
      exempt: ['forgotten', 'unguarded'],
    });
    expect(violations).toEqual([]);
  });
});

describe('assertRoleIsolated', () => {
  it('accepts the application role', async () => {
    await expect(assertRoleIsolated(db.app)).resolves.toBeUndefined();
  });

  it('refuses a role that escapes row-level security', async () => {
    const owner = await checkRoleIsolation(db.owner);
    if (owner.superuser || owner.bypassesRls) {
      await expect(assertRoleIsolated(db.owner)).rejects.toThrow(RlsBypassError);
    }
  });
});

describe('Drizzle helpers', () => {
  const app = pgRole(db?.appRole ?? 'app');
  const notes = pgTable('notes', {
    id: serial('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    body: text('body'),
  });

  it('declares the same isolation policy', () => {
    const policy = organizationIsolation('notes_isolation', app);
    expect(policy.name).toBe('notes_isolation');
    expect(policy.for).toBe('all');
    expect(policy.using).toBeDefined();
    expect(activeOrganization).toBeDefined();
  });

  it('runs a Drizzle transaction in one organization', async () => {
    const orm = drizzle(db.app);
    const rows = await inOrganizationTx(orm, 'org_b', async (tx) => {
      await tx.insert(notes).values({ organizationId: 'org_b', body: 'drizzle' });
      return tx.select().from(notes);
    });
    expect(rows.every((row) => row.organizationId === 'org_b')).toBe(true);
    expect(rows.some((row) => row.body === 'drizzle')).toBe(true);
  });
});
