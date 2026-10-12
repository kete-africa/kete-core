import { defineProject } from 'vitest/config';

export default defineProject({
  // An app's design test runs the DESIGN.md linter several times: slow under a full run.
  test: {
    // Compiled copies of the tests are not tests (Vitest 4 no longer skips dist by default).
    exclude: ['**/node_modules/**', '**/dist/**'],
    name: 'design',
    environment: 'node',
    testTimeout: 30_000,
  },
});
