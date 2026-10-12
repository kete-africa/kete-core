import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    // Compiled copies of the tests are not tests (Vitest 4 no longer skips dist by default).
    exclude: ['**/node_modules/**', '**/dist/**'],
    name: 'center',
    environment: 'node',
  },
});
