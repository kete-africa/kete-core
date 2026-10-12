import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    // Compiled copies of the tests are not tests (Vitest 4 no longer skips dist by default).
    exclude: ['**/node_modules/**', '**/dist/**'],
    name: 'views',
    environment: 'node',
    // The page is built once before the tests read it.
    globalSetup: ['./tests/build.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
