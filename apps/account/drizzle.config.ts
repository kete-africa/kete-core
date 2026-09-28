import { defineConfig } from 'drizzle-kit';

// Migrations are generated from src/platform/schema.ts and applied with the owner role.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/platform/schema.ts',
  out: './db/migrations',
  entities: { roles: { provider: 'neon' } },
  dbCredentials: { url: process.env.ACCOUNT_OWNER_URL ?? '' },
});
