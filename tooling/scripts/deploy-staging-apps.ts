import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  coolify,
  neon,
  provisionInstance,
  type ProvisioningPorts,
} from '../../packages/infrastructure/src/index.js';

// Kete Finance, Kete Team and Kete Commitments on staging (phase 11, step E4: « déploie sur Coolify
// d'abord »), through the provisioning port: each its database on the staging Compte Kete's Neon
// project, its app on Kete's Coolify (project Kete, environment staging) from its `dev` branch.
// Their sign-in clients are registered once Kete's operator has an account on staging. Run by
// hand: `pnpm tsx tooling/scripts/deploy-staging-apps.ts <secrets file> [app…]`. No secret is
// printed.

const envOf = (path: string): Record<string, string> =>
  Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1] ?? '', (m[2] ?? '').replace(/^"|"$/g, '')]),
  );
const need = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is missing.`);
  return value;
};

const secrets = envOf(process.argv[2] ?? '../../.secrets/atelier-admin.env');
const started = Date.now();
const say = (line: string) =>
  console.log(`${String(Math.round((Date.now() - started) / 1000)).padStart(5)} s  ${line}`);

const HOST = '13.140.178.49.sslip.io';
const ACCOUNT = `https://compte-kete-staging.${HOST}`;
const ENTERPRISE_API = `https://api-enterprise-kete-staging.${HOST}`;
const STAGING_ACCOUNT_PROJECT = 'patient-grass-55463510';

const ports: ProvisioningPorts = {
  databases: neon({
    apiKey: need(secrets.NEON_API_KEY, 'NEON_API_KEY'),
    projectId: STAGING_ACCOUNT_PROJECT,
    branch: 'main',
  }),
  hosting: coolify({
    url: need(secrets.COOLIFY_URL, 'COOLIFY_URL'),
    token: need(secrets.COOLIFY_API_TOKEN, 'COOLIFY_API_TOKEN'),
    projectId: 'xxat0vlcttwl7rjksgz9x4jt',
    serverId: 'ofg3aw4m0pjgblhmy8htpo54',
    environment: 'staging',
    githubAppId: 'eura7ubqvuv7azqxjwunymjn',
  }),
  probe: async (url) => {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(8000) }).catch(
      () => null,
    );
    return response?.ok === true;
  },
};

const apps = [
  {
    name: 'kete-finance-staging',
    repository: 'kete-africa/kete-finance',
    host: `finance-kete-staging.${HOST}`,
    description: 'Kete Finance — staging',
    env: { COMMITMENTS_API_URL: `https://commitments-kete-staging.${HOST}` },
  },
  {
    name: 'kete-team-staging',
    repository: 'kete-africa/kete-team',
    host: `team-kete-staging.${HOST}`,
    description: 'Kete Team — staging',
    env: {},
  },
  {
    name: 'kete-commitments-staging',
    repository: 'kete-africa/kete-commitments',
    host: `commitments-kete-staging.${HOST}`,
    description: 'Kete Commitments — staging',
    env: {},
  },
];

const wanted = process.argv.slice(3);
let failed = false;
for (const app of apps.filter((a) => wanted.length === 0 || wanted.includes(a.name))) {
  say(`${app.name} at https://${app.host}`);
  await provisionInstance(
    ports,
    {
      name: app.name,
      repository: app.repository,
      domain: app.host,
      description: app.description,
      env: {
        ...app.env,
        PUBLIC_URL: `https://${app.host}`,
        KETE_ACCOUNT_URL: ACCOUNT,
        ENTERPRISE_API_URL: ENTERPRISE_API,
        KETE_ENVIRONMENT: 'staging',
        SESSION_SECRET: randomBytes(32).toString('base64url'),
      },
      buildEnv: { node_auth_token: need(secrets.KETE_PACKAGES_TOKEN, 'KETE_PACKAGES_TOKEN') },
      waitSeconds: 1500,
    },
    { onStep: (step, state) => say(`  ${step}: ${state}`) },
  ).then(
    () => say(`  ${app.name} answers`),
    (error: unknown) => {
      failed = true;
      say(`  failed: ${error instanceof Error ? error.message : String(error)}`);
      const cause = (error as { cause?: unknown }).cause;
      if (cause) say(`    cause: ${cause instanceof Error ? cause.message : String(cause)}`);
    },
  );
}
process.exit(failed ? 1 : 0);
