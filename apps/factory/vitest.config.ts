import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    // Compiled copies of the tests are not tests (Vitest 4 no longer skips dist by default).
    exclude: ['**/node_modules/**', '**/dist/**'],
    name: 'factory',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // With KETE_TEST_POSTGRES=container, one Postgres for the whole run (@kete/testing).
    globalSetup: ['@kete/testing/global-setup'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
