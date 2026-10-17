import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import { neon } from '../../../packages/infrastructure/src/index.js';

// The Compte Kete's test database, made through the provisioning port (spec 121) on the
// kete-core project's `test` branch — where CI's compute already runs — with the roles its
// migrations name (`account_owner`, `account_app`), bootstrapped once. Its two addresses go to the
// file given, never to the screen: `pnpm tsx scripts/test-database.ts <secrets> <out>` (from apps/account).

const envOf = (path: string): Record<string, string> =>
  Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1] ?? '', (m[2] ?? '').replace(/^"|"$/g, '')]),
  );

const secrets = envOf(process.argv[2] ?? '../../../../.secrets/atelier-admin.env');
const core = envOf('../../.env');
const out = process.argv[3];
if (!out || !secrets.NEON_API_KEY || !core.NEON_PROJECT_ID) {
  throw new Error('A secrets file, an output file, NEON_API_KEY and NEON_PROJECT_ID are needed.');
}

const databases = neon({
  apiKey: secrets.NEON_API_KEY,
  projectId: core.NEON_PROJECT_ID,
  branch: 'test',
});
const { ownerUrl, appUrl } = await databases.create('account');

const owner = new pg.Client({ connectionString: ownerUrl });
await owner.connect();
try {
  await owner.query(readFileSync('db/bootstrap.sql', 'utf8'));
} finally {
  await owner.end();
}

writeFileSync(out, `ACCOUNT_TEST_OWNER_URL=${ownerUrl}\nACCOUNT_TEST_APP_URL=${appUrl}\n`, {
  mode: 0o600,
});
console.log(`database « account » ready on the test branch; its addresses are in ${out}`);
