/**
 * `pnpm platform` — the whole Kete platform on this machine, joined: one Compte Kete, and every app
 * signing in through it, seeded in one organization, speaking to each other. Development only.
 *
 *   Compte Kete        http://localhost:3100   (the test operator: apps/account/.env.demo)
 *   Kete Enterprise    http://127.0.0.1:3500   (you are Abla Nyuiadzi, head of after-sales)
 *   Kete Finance       http://127.0.0.1:3410
 *   Kete Team          http://127.0.0.1:3420
 *   Kete Commitments   http://127.0.0.1:3430
 *   Support            http://127.0.0.1:3440
 *   Kete Cockpit       http://127.0.0.1:3300
 *
 * What it does, in order: makes the test operator and its organizations (« Kete », whose owner is
 * an operator; « KYA démo », where every app is seeded) — `apps/account/scripts/demo-operator.ts`;
 * registers each app as a client of the local Compte Kete, once, kept in
 * `apps/account/.env.platform` (ignored by git); starts each app's own `pnpm demo` in its joined
 * mode, and the Compte Kete and the Cockpit in development. Kete Intelligence answers with the real
 * model, says answers aloud and has its computer when `../../.secrets/atelier-admin.env` holds the
 * keys (`OPENAI_API_KEY`, `BOAT_API_KEY`); no secret is printed. Ctrl C stops everything.
 *
 *   pnpm platform [--build]     (--build: build each app's screens again)
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const core = join(import.meta.dirname, '..', '..');
const kete = join(core, '..');
const account = join(core, 'apps', 'account');
const say = (line: string) => console.log(`[platform] ${line}`);

const envOf = (path: string): Record<string, string> =>
  existsSync(path)
    ? Object.fromEntries(
        readFileSync(path, 'utf8')
          .split(/\r?\n/)
          .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
          .filter((m): m is RegExpExecArray => m !== null)
          .map((m) => [m[1] ?? '', (m[2] ?? '').replace(/^"|"$/g, '')]),
      )
    : {};
const secrets = envOf(join(kete, '..', '.secrets', 'atelier-admin.env'));

/**
 * On Windows, Node trusts its own roots only; an antivirus that inspects HTTPS (Kaspersky, Avast…)
 * signs with a root Windows trusts, and every call to the model then fails (« self-signed
 * certificate in certificate chain »). The machine's roots are exported once per start and given to
 * every process through `NODE_EXTRA_CA_CERTS` — public certificates, nothing secret.
 */
function trustWindowsRoots(): void {
  if (process.platform !== 'win32' || process.env.NODE_EXTRA_CA_CERTS) return;
  const file = join(tmpdir(), 'kete-platform-roots.pem');
  const script = [
    String.raw`$roots = Get-ChildItem Cert:\LocalMachine\Root, Cert:\CurrentUser\Root;`,
    "$roots | ForEach-Object { '-----BEGIN CERTIFICATE-----';",
    "[Convert]::ToBase64String($_.RawData, 'InsertLineBreaks'); '-----END CERTIFICATE-----' }",
    `| Set-Content -Encoding ascii '${file}'`,
  ].join(' ');
  const run = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
  if (run.status === 0 && existsSync(file)) process.env.NODE_EXTRA_CA_CERTS = file;
}
trustWindowsRoots();
const ACCOUNT_URL = 'http://localhost:3100';
// The apps answer on 127.0.0.1: the loopback address the Compte Kete accepts for a client's return.
const APP = 'http://127.0.0.1';
// Kete Enterprise's API, off 3600: another project of this machine may hold it.
const ENTERPRISE_API_PORT = 3610;
const tsx = join(core, 'node_modules', '.bin', 'tsx');
const trial = { KETE_ENVIRONMENT: 'development', KETE_OPERATORS_SECOND_FACTOR: 'optional' };

/** Runs a script of the Compte Kete with its settings and returns what it printed last. */
function accountScript(args: string[], extra: Record<string, string> = {}): string {
  const run = spawnSync(`"${tsx}" --env-file=.env --tsconfig tsconfig.json ${args.join(' ')}`, {
    cwd: account,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...trial, ...extra },
  });
  if (run.status !== 0) {
    throw new Error(
      `${args[0]} failed: ${(run.stderr || run.stdout).split('\n').slice(-3).join(' ')}`,
    );
  }
  return run.stdout;
}

// 1. The test operator and its organizations.
const who = JSON.parse(
  accountScript(['scripts/demo-operator.ts']).trim().split('\n').at(-1) ?? '{}',
) as {
  userId: string;
  kete: string;
  kya: string;
};
const operatorEmail = envOf(join(account, '.env.demo')).DEMO_OPERATOR_EMAIL ?? '';
say(
  `Opérateur de test prêt (identifiants dans apps/account/.env.demo) ; organisation « KYA démo ».`,
);

// 2. Each app, a client of the Compte Kete — registered once.
const clientsFile = join(account, '.env.platform');
const clients = (
  existsSync(clientsFile) ? JSON.parse(readFileSync(clientsFile, 'utf8')) : {}
) as Record<string, { id: string; secret: string }>;
const apps = [
  { key: 'enterprise', name: 'Kete Enterprise (local)', port: 3500, flags: [] as string[] },
  { key: 'finance', name: 'Kete Finance (local)', port: 3410, flags: ['--center'] },
  { key: 'team', name: 'Kete Team (local)', port: 3420, flags: ['--center'] },
  { key: 'commitments', name: 'Kete Commitments (local)', port: 3430, flags: ['--center'] },
  { key: 'support', name: 'Support (local)', port: 3440, flags: ['--center'] },
  { key: 'cockpit', name: 'Kete Cockpit (local)', port: 3300, flags: [] as string[] },
];
for (const app of apps) {
  if (clients[app.key]) continue;
  const out = accountScript(
    [
      'scripts/clients.ts',
      'create',
      '--operator',
      operatorEmail,
      '--name',
      `"${app.name}"`,
      '--redirect',
      `${APP}:${app.port}/auth/callback`,
      ...app.flags,
    ],
    { KETE_OPERATORS_ORGANIZATION_ID: who.kete },
  );
  const made = JSON.parse(out.slice(out.indexOf('{'))) as {
    client_id: string;
    client_secret: string;
  };
  clients[app.key] = { id: made.client_id, secret: made.client_secret };
  writeFileSync(clientsFile, `${JSON.stringify(clients, null, 2)}\n`);
  say(`${app.name} enregistrée auprès du Compte Kete.`);
}
const client = (key: string) => clients[key] ?? { id: '', secret: '' };

// 3. Every process, joined.
const fresh = process.argv.includes('--build') ? [] : ['--fresh'];
const model = secrets.OPENAI_API_KEY
  ? {
      KETE_AI_PROVIDER: 'openai',
      KETE_AI_MODEL: 'gpt-6.1-sol',
      KETE_AI_API_KEY: secrets.OPENAI_API_KEY,
      OPENAI_API_KEY: secrets.OPENAI_API_KEY,
    }
  : {};
const joined = {
  ...trial,
  ...model,
  KETE_DEMO_JOINED: 'on',
  KETE_ACCOUNT_URL: ACCOUNT_URL,
  KETE_DEMO_ORGANIZATION: who.kya,
  KETE_DEMO_ME: who.userId,
  ENTERPRISE_API_URL: `${APP}:${ENTERPRISE_API_PORT}`,
};
const secret = () => randomBytes(32).toString('base64');
const cockpitEnv = envOf(join(kete, 'kete-cockpit', '.env'));

const processes: {
  name: string;
  cwd: string;
  command: string;
  env: Record<string, string>;
  ready: string;
}[] = [
  {
    name: 'compte',
    cwd: core,
    command: 'pnpm --filter @kete/account dev',
    ready: `${ACCOUNT_URL}/health`,
    env: {
      ...trial,
      KETE_TEST_MAILBOX: 'on',
      KETE_OPERATORS_ORGANIZATION_ID: who.kete,
      KETE_ENTERPRISE_URL: `${APP}:3500`,
      KETE_TOOL_FINANCE_URL: `${APP}:3410`,
      KETE_TOOL_TEAM_URL: `${APP}:3420`,
      KETE_TOOL_COMMITMENTS_URL: `${APP}:3430`,
      KETE_TOOL_SUPPORT_URL: `${APP}:3440`,
      KETE_TOOL_COCKPIT_URL: `${APP}:3300`,
    },
  },
  {
    name: 'enterprise',
    cwd: join(kete, 'kete-enterprise'),
    command: `pnpm demo ${fresh.join(' ')}`,
    ready: `${APP}:3500/`,
    env: {
      ...joined,
      KETE_CLIENT_ID: client('enterprise').id,
      KETE_CLIENT_SECRET: client('enterprise').secret,
      KETE_SECRETS_KEY: secret(),
      KETE_DEMO_API_PORT: String(ENTERPRISE_API_PORT),
      // The apps beside the center, registered in its registry as each answers.
      KETE_DEMO_APPS: [3410, 3420, 3430, 3440].map((port) => `${APP}:${port}`).join(','),
      ...(secrets.OPENAI_API_KEY
        ? {
            KETE_DEMO_MODEL: 'real',
            KETE_SPEECH_PROVIDER: 'openai',
            KETE_SPEECH_MODEL: 'gpt-4o-mini-tts',
          }
        : {}),
      ...(secrets.BOAT_API_KEY ? { KETE_SANDBOX_API_KEY: secrets.BOAT_API_KEY } : {}),
    },
  },
  ...(['finance', 'team', 'commitments', 'support'] as const).map((key) => ({
    name: key,
    cwd: join(kete, key === 'support' ? 'kete-helpdesk' : `kete-${key}`),
    command: `pnpm demo ${fresh.join(' ')}`,
    ready: `${APP}:${apps.find((a) => a.key === key)?.port}/health`,
    env: {
      ...joined,
      KETE_CLIENT_ID: client(key).id,
      KETE_CLIENT_SECRET: client(key).secret,
      SESSION_SECRET: secret(),
      KETE_SECRETS_KEY: secret(),
      ...(key === 'finance' ? { COMMITMENTS_API_URL: `${APP}:3430` } : {}),
      ...(key === 'support' ? { FINANCE_URL: `${APP}:3410` } : {}),
    },
  })),
  {
    name: 'cockpit',
    cwd: join(kete, 'kete-cockpit'),
    command: 'pnpm dev --host 127.0.0.1',
    ready: `${APP}:3300/health`,
    env: {
      ...trial,
      KETE_ACCOUNT_URL: ACCOUNT_URL,
      COCKPIT_URL: `${APP}:3300`,
      COCKPIT_CLIENT_ID: client('cockpit').id,
      COCKPIT_CLIENT_SECRET: client('cockpit').secret,
      COCKPIT_SESSION_SECRET: secret(),
      COCKPIT_ENCRYPTION_KEY: secret(),
      COCKPIT_DATABASE_URL: cockpitEnv.COCKPIT_TEST_APP_URL ?? '',
      COCKPIT_PROBE_INTERVAL_SECONDS: '60',
      KETE_OPERATORS_ORGANIZATION_ID: who.kete,
    },
  },
];

const running: ChildProcess[] = [];
for (const one of processes) {
  const child = spawn(one.command, {
    cwd: one.cwd,
    shell: true,
    env: { ...process.env, ...one.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.push(child);
  const relay = (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      // Only what says something: each app's own words and its failures.
      if (
        /\[demo\]|error|Error|failed|listening|ready/i.test(line) &&
        !/SSL modes|DeprecationWarning/.test(line)
      ) {
        console.log(`[${one.name}] ${line.trim()}`);
      }
    }
  };
  child.stdout?.on('data', relay);
  child.stderr?.on('data', relay);
}

let stopping = false;
function stop(): void {
  if (stopping) return;
  stopping = true;
  say('Arrêt de la plateforme…');
  for (const child of running) {
    if (child.pid) spawnSync(`taskkill /pid ${child.pid} /T /F`, { shell: true, stdio: 'ignore' });
  }
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// 4. Ready when each answers.
for (const one of processes) {
  let up = false;
  for (let attempt = 0; attempt < 240 && !up; attempt += 1) {
    up = await fetch(one.ready, { redirect: 'manual' })
      .then((answer) => answer.status < 500)
      .catch(() => false);
    if (!up) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  say(`${one.name} ${up ? 'répond' : 'ne répond pas'} (${one.ready.replace(/\/health$/, '')}).`);
}
say(
  'Prête. Entrez par le Compte Kete : http://localhost:3100 — choisissez « KYA démo », puis Mes outils.',
);
