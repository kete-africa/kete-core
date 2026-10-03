import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/account', 'apps/factory', 'templates/app'],
    // With KETE_TEST_POSTGRES=container, one Postgres for the whole run (@kete/testing).
    globalSetup: ['./packages/testing/src/global-setup.ts'],
  },
});
