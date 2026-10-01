import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'records',
    environment: 'node',

    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
