import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'sdk',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
