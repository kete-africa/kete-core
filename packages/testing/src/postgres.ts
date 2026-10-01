import { randomBytes } from 'node:crypto';

/** Where the tests' Postgres comes from. */
export interface TestDatabaseUrls {
  /** The owner role: migrations and inspection. */
  ownerUrl: string;
  /** The application role: no superuser, no BYPASSRLS, so row-level security applies. */
  appUrl: string;
  source: 'environment' | 'container';
}

export interface StartedPostgres extends TestDatabaseUrls {
  stop(): Promise<void>;
}

/** The image used for containers: plain Postgres with pgvector, like any client's server could run. */
export const POSTGRES_IMAGE = 'pgvector/pgvector:pg17';

/**
 * Starts a throwaway Postgres in a container (Testcontainers), with an application role created
 * the way every Kete service creates it: a login, no superuser, no BYPASSRLS. It proves the code
 * runs on any Postgres, not only on Neon (doctrine D-029).
 */
export async function startPostgres(): Promise<StartedPostgres> {
  const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withDatabase('kete')
    .withUsername('kete_owner')
    .start();
  const appPassword = randomBytes(12).toString('hex');
  const { default: pg } = await import('pg');
  const owner = new pg.Client({ connectionString: container.getConnectionUri() });
  await owner.connect();
  await owner.query(
    `create role kete_app login password '${appPassword}' nosuperuser nobypassrls nocreatedb nocreaterole`,
  );
  await owner.end();
  const appUrl = new URL(container.getConnectionUri());
  appUrl.username = 'kete_app';
  appUrl.password = appPassword;
  return {
    ownerUrl: container.getConnectionUri(),
    appUrl: appUrl.toString(),
    source: 'container',
    async stop() {
      await container.stop();
    },
  };
}

/** Where the global setup leaves the shared container's URLs for the test workers. */
export const CONTAINER_OWNER_URL = 'KETE_TEST_CONTAINER_OWNER_URL';
export const CONTAINER_APP_URL = 'KETE_TEST_CONTAINER_APP_URL';

let started: Promise<StartedPostgres> | undefined;

/**
 * The tests' Postgres. By default, the Neon "test" branch named by `<PREFIX>_TEST_OWNER_URL` and
 * `<PREFIX>_TEST_APP_URL`; with `KETE_TEST_POSTGRES=container`, a container started once per test
 * process instead.
 */
export async function testDatabaseUrls(prefix = 'KETE'): Promise<TestDatabaseUrls> {
  if (process.env['KETE_TEST_POSTGRES'] === 'container') {
    const shared = [process.env[CONTAINER_OWNER_URL], process.env[CONTAINER_APP_URL]];
    if (shared[0] && shared[1]) {
      return { ownerUrl: shared[0], appUrl: shared[1], source: 'container' };
    }
    started ??= startPostgres();
    const { ownerUrl, appUrl, source } = await started;
    return { ownerUrl, appUrl, source };
  }
  const ownerUrl = process.env[`${prefix}_TEST_OWNER_URL`];
  const appUrl = process.env[`${prefix}_TEST_APP_URL`];
  if (!ownerUrl || !appUrl) {
    throw new Error(
      `${prefix}_TEST_OWNER_URL and ${prefix}_TEST_APP_URL are not set. Integration tests need a ` +
        'real Postgres: set them (see .env.example), or run with KETE_TEST_POSTGRES=container.',
    );
  }
  return { ownerUrl, appUrl, source: 'environment' };
}

/** The role a connection string signs in as. */
export function roleOf(url: string): string {
  return decodeURIComponent(new URL(url).username);
}
