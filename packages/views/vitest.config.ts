import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'views',
    environment: 'node',
    // The page is built once before the tests read it.
    globalSetup: ['./tests/build.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
