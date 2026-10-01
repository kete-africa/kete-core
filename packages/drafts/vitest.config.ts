import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'drafts',
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
