import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    // Compiled copies of the tests are not tests (Vitest 4 no longer skips dist by default).
    exclude: ['**/node_modules/**', '**/dist/**'],
    name: 'agents',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
