import { createTestSchema } from '@kete/testing';
import { describe, expect, it } from 'vitest';
import { factoryMigrationSql } from '../src/store.js';

// The factory migrates at each start (spec 048): a second start finds everything in place and
// changes nothing — it once failed on staging, its policy already there.

describe('the factory’s migration', () => {
  it('runs again without failing, its rows still isolated', async () => {
    const db = await createTestSchema({
      migrate: async (owner, context) => {
        await owner.query(factoryMigrationSql(context));
        await owner.query(factoryMigrationSql(context));
      },
    });
    try {
      const { rows } = await db.owner.query<{ policies: string }>(
        `select count(*)::text as policies from pg_policies where tablename = 'factory_requests'
           and schemaname = $1`,
        [db.schema],
      );
      expect(rows[0]?.policies).toBe('1');
    } finally {
      await db.drop();
    }
  });
});
