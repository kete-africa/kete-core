import { readFileSync } from 'node:fs';
import {
  coolify,
  destroyInstance,
  neon,
  provisionInstance,
  type ProvisioningPorts,
} from '../../packages/infrastructure/src/index.js';

// Phase 11's proof of step B1 (spec 121): « une instance de test créée puis détruite par le port
// seul » — on Kete's own Neon (the kete-core project's `test` branch) and Coolify (project Kete,
// environment staging), deploying Support's `dev` branch, then destroying everything. Run by hand,
// on the author's word: `pnpm tsx tooling/scripts/prove-provisioning.ts <secrets file>`. No secret
// is printed.

const envOf = (path: string): Record<string, string> =>
  Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1] ?? '', (m[2] ?? '').replace(/^"|"$/g, '')]),
  );

const secrets = envOf(process.argv[2] ?? '../../.secrets/atelier-admin.env');
const core = envOf('.env');
const need = (value: string | undefined, name: string) => {
  if (!value) throw new Error(`${name} is missing.`);
  return value;
};

const name = `kete-b1-proof-${new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '')}`;
const domain = `${name}.13.140.178.49.sslip.io`;
const started = Date.now();
const at = () => `${String(Math.round((Date.now() - started) / 1000)).padStart(4)} s`;

const ports: ProvisioningPorts = {
  databases: neon({
    apiKey: need(secrets.NEON_API_KEY, 'NEON_API_KEY'),
    projectId: need(core.NEON_PROJECT_ID, 'NEON_PROJECT_ID'),
    branch: 'test',
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

// `--finish <name>`: what a destruction left behind, destroyed through the same port.
if (process.argv[3] === '--finish') {
  const left = need(process.argv[4], 'the instance to finish');
  const database = left.replace(/-/g, '_');
  await ports.databases.destroy(database);
  console.log(`${at()}  database ${database} destroyed`);
  process.exit(0);
}

console.log(`${at()}  instance ${name} at https://${domain}`);
const instance = await provisionInstance(
  ports,
  {
    name,
    repository: 'kete-africa/kete-helpdesk',
    domain,
    description: 'Preuve B1 (kete-core spec 121) : créée puis détruite par le port seul.',
    env: { PUBLIC_URL: `https://${domain}`, KETE_ENVIRONMENT: 'staging' },
    buildEnv: { node_auth_token: need(secrets.KETE_PACKAGES_TOKEN, 'KETE_PACKAGES_TOKEN') },
    waitSeconds: 1200,
  },
  { onStep: (step, state) => console.log(`${at()}  ${step}: ${state}`) },
).catch((error: unknown) => {
  console.log(`${at()}  failed: ${error instanceof Error ? error.message : String(error)}`);
  const cause = (error as { cause?: unknown }).cause;
  if (cause)
    console.log(`        cause: ${cause instanceof Error ? cause.message : String(cause)}`);
  process.exit(1);
});

const health = await fetch(`${instance.url}/health`).then((r) => r.json() as Promise<unknown>);
console.log(`${at()}  answered: ${JSON.stringify(health)}`);
console.log(`${at()}  hosted status: ${await ports.hosting.status(instance.hostingId)}`);

await destroyInstance(ports, instance);
console.log(`${at()}  destroyed`);
console.log(`${at()}  hosted status after: ${await ports.hosting.status(instance.hostingId)}`);
console.log(`${at()}  answers after: ${await ports.probe(instance.url)}`);
