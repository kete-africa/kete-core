import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { outboxMigrationSql } from '../../src/outbox/migration.js';
import { receivedEventsMigrationSql } from '../../src/receiver/receive.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Integration tests need a real Postgres (see .env.example).`,
    );
  }
  return value;
}

function roleOf(url: string): string {
  return decodeURIComponent(new URL(url).username);
}

export interface TestDatabase {
  schema: string;
  /** Connected as the owner (migrations, inspection). */
  owner: pg.Pool;
  /** Connected as the application role, without BYPASSRLS. */
  app: pg.Pool;
  drop(): Promise<void>;
}

/** Creates an isolated schema with the outbox and receiver tables, for one test file. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const ownerUrl = required('KETE_TEST_OWNER_URL');
  const appUrl = required('KETE_TEST_APP_URL');
  const schema = `t_${randomBytes(6).toString('hex')}`;

  const pools = [ownerUrl, appUrl].map((connectionString) => {
    // The schema is set at connection start, before any query can run.
    return new pg.Pool({ connectionString, max: 10, options: `-c search_path=${schema}` });
  });
  const [owner, app] = pools as [pg.Pool, pg.Pool];

  await owner.query(`create schema ${schema}`);
  await owner.query(
    outboxMigrationSql({ schema, appRole: roleOf(appUrl), ownerRole: roleOf(ownerUrl) }),
  );
  await owner.query(receivedEventsMigrationSql);

  return {
    schema,
    owner,
    app,
    async drop() {
      await owner.query(`drop schema ${schema} cascade`);
      await Promise.all(pools.map((p) => p.end()));
    },
  };
}

/** Runs `fn` in a transaction of the application role, with the active organization set. */
export async function inOrganization<T>(
  pool: pg.Pool,
  organization: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('kete.organization_id', $1, true)`, [organization]);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
