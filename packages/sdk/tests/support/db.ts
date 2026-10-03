import { createTestSchema, type TestSchema } from '@kete/testing';
import type pg from 'pg';
import { outboxMigrationSql } from '../../src/outbox/migration.js';
import { setOrganization } from '../../src/outbox/sql.js';
import { receivedEventsMigrationSql } from '../../src/receiver/receive.js';

export type TestDatabase = TestSchema;

/** Creates an isolated schema with the outbox and receiver tables, for one test file. */
export function createTestDatabase(): Promise<TestDatabase> {
  return createTestSchema({
    migrate: async (owner, { schema, appRole, ownerRole }) => {
      await owner.query(outboxMigrationSql({ schema, appRole, ownerRole }));
      // A second outbox, for an app's center (spec 049).
      await owner.query(
        outboxMigrationSql({ schema, appRole, ownerRole, name: 'kete_center_outbox' }),
      );
      await owner.query(receivedEventsMigrationSql);
    },
  });
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
    await setOrganization(client, organization);
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
