import { resolve } from 'node:path';

// Local runs read the repository's .env; CI provides the variables directly.
try {
  process.loadEnvFile(resolve(import.meta.dirname, '../../../.env'));
} catch {
  // No .env file: the variables come from the environment.
}
