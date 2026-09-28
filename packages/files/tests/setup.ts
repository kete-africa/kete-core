import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

// The storage tests run against the Neon object storage of the kete-account `test` branch.
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
