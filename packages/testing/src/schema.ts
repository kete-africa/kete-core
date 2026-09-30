import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { roleOf, testDatabaseUrls, type TestDatabaseUrls } from './postgres.js';

export interface MigrationContext {
  schema: string;
  ownerRole: string;
  appRole: string;
}

export interface TestSchemaOptions {
  /** Default: `testDatabaseUrls()`. */
  urls?: TestDatabaseUrls;
  /** Creates the tables, as the owner, in the new schema (the search path already points at it). */
  migrate?: (owner: pg.Pool, context: MigrationContext) => Promise<void>;
}

export interface TestSchema extends MigrationContext {
  /** Connected as the owner: migrations and inspection. */
  owner: pg.Pool;
  /** Connected as the application role: row-level security applies. */
  app: pg.Pool;
  drop(): Promise<void>;
}

/**
 * Creates an isolated schema for one test file, so test files run in parallel on one database.
 * The application role can use the schema and read or write the tables the owner creates in it;
 * row-level security decides which rows it sees.
 */
export async function createTestSchema(options: TestSchemaOptions = {}): Promise<TestSchema> {
  const urls = options.urls ?? (await testDatabaseUrls());
  const schema = `t_${randomBytes(6).toString('hex')}`;
  const ownerRole = roleOf(urls.ownerUrl);
  const appRole = roleOf(urls.appUrl);
  const pools = [urls.ownerUrl, urls.appUrl].map(
    // The schema is set at connection start, before any query can run.
    (connectionString) =>
      new pg.Pool({ connectionString, max: 10, options: `-c search_path=${schema}` }),
  );
  const [owner, app] = pools as [pg.Pool, pg.Pool];
  await owner.query(`create schema ${schema}`);
  await owner.query(`grant usage on schema ${schema} to ${appRole}`);
  // The same grants as a service's bootstrap: data access to the owner's tables and sequences.
  await owner.query(
    `alter default privileges in schema ${schema}
       grant select, insert, update, delete on tables to ${appRole}`,
  );
  await owner.query(
    `alter default privileges in schema ${schema} grant usage, select on sequences to ${appRole}`,
  );
  const context = { schema, ownerRole, appRole };
  await options.migrate?.(owner, context);
  return {
    ...context,
    owner,
    app,
    async drop() {
      await owner.query(`drop schema ${schema} cascade`);
      await Promise.all(pools.map((pool) => pool.end()));
    },
  };
}
