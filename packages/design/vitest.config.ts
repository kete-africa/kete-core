import { defineProject } from 'vitest/config';

export default defineProject({
  // An app's design test runs the DESIGN.md linter several times: slow under a full run.
  test: { name: 'design', environment: 'node', testTimeout: 30_000 },
});
