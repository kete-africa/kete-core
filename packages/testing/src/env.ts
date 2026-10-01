import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Loads the nearest `.env` above `from` (the repository's, for local runs). CI provides the
 * variables directly, so a missing file is not an error. Values never reach a log.
 */
export function loadRepositoryEnv(from: string = process.cwd()): string | undefined {
  let dir = resolve(from);
  for (;;) {
    const file = resolve(dir, '.env');
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return file;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
