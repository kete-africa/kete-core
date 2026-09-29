import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'files',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
  },
});
