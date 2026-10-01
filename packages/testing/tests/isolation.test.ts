import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertOrganizationIsolation, createTestSchema, IsolationError } from '../src/index.js';
import type { PoolClient } from 'pg';
import type { TestSchema } from '../src/index.js';

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { appRole }) => {
      await owner.query(`create table isolated (id serial primary key, organization_id text not null);
        alter table isolated enable row level security;
        create policy isolated_isolation on isolated to ${appRole}
          using (organization_id = current_setting('kete.organization_id', true))
          with check (organization_id = current_setting('kete.organization_id', true));
        create table leaky (id serial primary key, organization_id text not null);`);
    },
  });
});

afterAll(async () => {
  await db.drop();
});

const insertInto = (table: string) => async (client: PoolClient, org: string) => {
  await client.query(`insert into ${table} (organization_id) values ($1)`, [org]);
};

describe('assertOrganizationIsolation', () => {
  it('passes for a table isolated by its policy', async () => {
    await expect(
      assertOrganizationIsolation({
        app: db.app,
        table: 'isolated',
        organizations: ['org_a', 'org_b'],
        insert: insertInto('isolated'),
      }),
    ).resolves.toBeUndefined();
  });

  it('says what leaks for a table without row-level security', async () => {
    await expect(
      assertOrganizationIsolation({
        app: db.app,
        table: 'leaky',
        organizations: ['org_a', 'org_b'],
        insert: insertInto('leaky'),
      }),
    ).rejects.toThrow(IsolationError);
  });
});

describe('createTestSchema', () => {
  it('connects the application role, which row-level security applies to', async () => {
    const { rows } = await db.app.query<{ bypass: boolean; superuser: boolean }>(
      `select rolbypassrls as bypass, rolsuper as superuser from pg_roles where rolname = current_user`,
    );
    expect(rows[0]).toEqual({ bypass: false, superuser: false });
  });
});
