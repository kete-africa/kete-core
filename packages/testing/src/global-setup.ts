import { CONTAINER_APP_URL, CONTAINER_OWNER_URL, startPostgres } from './postgres.js';

/**
 * Vitest `globalSetup` (`@kete/testing/global-setup`): with `KETE_TEST_POSTGRES=container`, starts
 * one Postgres for the whole run, before the test workers, and hands them its URLs. Without it,
 * each worker would start its own container. It does nothing otherwise.
 */
export default async function setup(): Promise<(() => Promise<void>) | undefined> {
  if (process.env['KETE_TEST_POSTGRES'] !== 'container') return undefined;
  const postgres = await startPostgres();
  process.env[CONTAINER_OWNER_URL] = postgres.ownerUrl;
  process.env[CONTAINER_APP_URL] = postgres.appUrl;
  return () => postgres.stop();
}
