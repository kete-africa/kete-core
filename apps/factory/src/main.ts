import { readFileSync } from 'node:fs';
import { serve } from '@hono/node-server';
import { createJobs, defineJob } from '@kete/jobs';
import { boatProvider } from '@kete/sandbox';
import pg from 'pg';
import { compteKete } from './adapters/account.js';
import { claudeCode, codex } from './adapters/agents.js';
import { neon } from './adapters/databases.js';
import { githubApp } from './adapters/github.js';
import { coolify } from './adapters/hosting.js';
import { reportTo } from './adapters/report.js';
import type { Ports } from './ports.js';
import { ENTERPRISE_PRODUCT, factoryServer } from './server.js';
import { factoryMigrationSql, requestStore } from './store.js';
import { work } from './worker.js';

// The factory's process (spec 048): its migration, its door, its worker. Every secret comes from
// the environment of its hosting; none is written anywhere.

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set (see apps/factory/.env.example).`);
  return value;
}
const fileOrValue = (name: string) =>
  process.env[name] ?? readFileSync(required(`${name}_PATH`), 'utf8');

const ownerUrl = required('OWNER_DATABASE_URL');
const appUrl = required('DATABASE_URL');
const owner = new pg.Pool({ connectionString: ownerUrl, max: 2 });
await owner.query(
  factoryMigrationSql({
    schema: 'public',
    appRole: decodeURIComponent(new URL(appUrl).username),
  }),
);
await owner.end();

const pool = new pg.Pool({ connectionString: appUrl, max: 5 });
const store = requestStore(pool);
const key = {
  kid: required('FACTORY_ENTERPRISE_KID'),
  secret: required('FACTORY_ENTERPRISE_SECRET'),
};

const agent =
  (process.env.FACTORY_AGENT ?? 'codex') === 'claude'
    ? claudeCode({ apiKey: required('FACTORY_ANTHROPIC_API_KEY') })
    : codex({ authJson: fileOrValue('FACTORY_CODEX_AUTH_JSON') });

const ports: Ports = {
  code: githubApp({
    appId: required('FACTORY_GITHUB_APP_ID'),
    installationId: required('FACTORY_GITHUB_INSTALLATION_ID'),
    privateKey: fileOrValue('FACTORY_GITHUB_PRIVATE_KEY'),
    owner: required('FACTORY_REPOSITORY_OWNER'),
  }),
  databases: neon({
    apiKey: required('FACTORY_NEON_API_KEY'),
    projectId: required('FACTORY_NEON_PROJECT'),
    branch: required('FACTORY_NEON_BRANCH'),
  }),
  identity: compteKete({
    url: required('FACTORY_ACCOUNT_URL'),
    clientId: required('FACTORY_ACCOUNT_CLIENT_ID'),
    clientSecret: required('FACTORY_ACCOUNT_CLIENT_SECRET'),
  }),
  hosting: coolify({
    url: required('FACTORY_COOLIFY_URL'),
    token: required('FACTORY_COOLIFY_TOKEN'),
    projectId: required('FACTORY_COOLIFY_PROJECT'),
    serverId: required('FACTORY_COOLIFY_SERVER'),
    environment: required('FACTORY_COOLIFY_ENVIRONMENT'),
    githubAppId: required('FACTORY_COOLIFY_GITHUB_APP'),
  }),
  sandboxes: boatProvider({ apiKey: required('FACTORY_SANDBOX_API_KEY') }),
  agent,
  report: reportTo(key),
  config: {
    appsDomain: required('FACTORY_APPS_DOMAIN'),
    packagesToken: required('KETE_PACKAGES_TOKEN'),
    accountUrl: required('FACTORY_ACCOUNT_URL'),
    enterpriseApiUrl: required('FACTORY_ENTERPRISE_API_URL'),
    environment: process.env.FACTORY_ENVIRONMENT === 'production' ? 'production' : 'staging',
    operatorsOrganizationId: required('KETE_OPERATORS_ORGANIZATION_ID'),
    repositoryOwner: required('FACTORY_REPOSITORY_OWNER'),
  },
};

const BUILD = 'build-app';
const jobs = createJobs({
  connectionString: ownerUrl,
  jobs: [
    defineJob<{ requestId: string; organizationId: string }>({
      name: BUILD,
      retryLimit: 2,
      handle: (data) =>
        work(data, store, ports, async (requestId, organizationId, seconds) => {
          await jobs.send(
            BUILD,
            { requestId, organizationId },
            { startAfter: new Date(Date.now() + seconds * 1000) },
          );
        }),
    }),
  ],
});
await jobs.start();

const app = factoryServer({
  store,
  keys: new Map([[ENTERPRISE_PRODUCT, [key]]]),
  enqueue: async (requestId, organizationId) => {
    await jobs.send(BUILD, { requestId, organizationId }, { singletonKey: requestId });
  },
});
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000), hostname: '0.0.0.0' });
console.log('[factory] listening');
