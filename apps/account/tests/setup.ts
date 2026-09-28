import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

// Integration tests run against the kete-account `test` branch, through the application role.
const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const appUrl = process.env.ACCOUNT_TEST_APP_URL;
if (!appUrl) throw new Error('ACCOUNT_TEST_APP_URL is not set (see .env.example).');
process.env.ACCOUNT_DATABASE_URL = appUrl;
process.env.BETTER_AUTH_SECRET ??=
  process.env.ACCOUNT_TEST_AUTH_SECRET ?? 'test-secret-not-used-outside-tests-0123456789';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3100';
