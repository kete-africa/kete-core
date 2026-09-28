import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from '@playwright/test';

// End-to-end tests run the Compte Kete against the kete-account `test` branch, through the
// application role. KETE_CHROMIUM lets a machine without the bundled browser point at one it has.
const rootEnv = '../../.env';
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const PORT = 3200;
// srvx needs absolute paths on Windows to serve the static files.
const dist = (path: string) => fileURLToPath(new URL(`./dist/${path}`, import.meta.url));
const origin = `http://localhost:${PORT}`;
const databaseUrl = process.env.ACCOUNT_TEST_APP_URL;
// The signing keys on the test branch are encrypted with this secret: every run must share it.
const authSecret = process.env.ACCOUNT_TEST_AUTH_SECRET;
if (!databaseUrl || !authSecret) {
  throw new Error(
    'ACCOUNT_TEST_APP_URL and ACCOUNT_TEST_AUTH_SECRET must be set (see .env.example).',
  );
}

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: origin,
    // French is the default language; the browser's language decides when no choice was made.
    locale: 'fr-FR',
    launchOptions: process.env.KETE_CHROMIUM ? { executablePath: process.env.KETE_CHROMIUM } : {},
  },
  webServer: {
    // The production build, served as in production: no dev-server reload in the middle of a test.
    command: `pnpm exec vite build && pnpm exec srvx serve --entry ${dist('server/server.js')} --static ${dist('client')} --prod --port ${PORT}`,
    port: PORT,
    env: {
      ACCOUNT_DATABASE_URL: databaseUrl,
      BETTER_AUTH_URL: origin,
      BETTER_AUTH_SECRET: authSecret,
    },
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
