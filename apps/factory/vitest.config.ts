import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'factory',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // With KETE_TEST_POSTGRES=container, one Postgres for the whole run (@kete/testing).
    globalSetup: ['@kete/testing/global-setup'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
