import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'jobs',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
