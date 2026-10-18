import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import pg from 'pg';
import {
  backupInstance,
  coolify,
  destroyInstance,
  neon,
  provisionInstance,
  restoreInstance,
  updateInstances,
  type Instance,
  type ProvisioningPorts,
} from '../../packages/infrastructure/src/index.js';

// Phase 11's proof of step B2 (spec 131): « une mise à jour poussée à deux instances, une
// sauvegarde restaurée » — through the provisioning port alone, on Kete's own Neon (the kete-core
// project, a branch per database from `test`) and Coolify (project Kete, environment staging):
// two instances of Support created; a version pushed to both, then another; a backup of one taken,
// its data changed, the backup restored and the data back; then everything destroyed. Run by hand:
// `pnpm tsx tooling/scripts/prove-fleet.ts <secrets file>`. No secret is printed.
// `--finish <name> <name>…` destroys what a run left.

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
const started = Date.now();
const at = () => `${String(Math.round((Date.now() - started) / 1000)).padStart(5)} s`;
const say = (line: string) => console.log(`${at()}  ${line}`);

const coolifyUrl = need(secrets.COOLIFY_URL, 'COOLIFY_URL').replace(/\/$/, '');
const coolifyToken = need(secrets.COOLIFY_API_TOKEN, 'COOLIFY_API_TOKEN');
const ports: ProvisioningPorts = {
  databases: neon({
    apiKey: need(secrets.NEON_API_KEY, 'NEON_API_KEY'),
    projectId: need(core.NEON_PROJECT_ID, 'NEON_PROJECT_ID'),
    branch: 'test',
    branchPerDatabase: true,
  }),
  hosting: coolify({
    url: coolifyUrl,
    token: coolifyToken,
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

if (process.argv[3] === '--finish') {
  for (const left of process.argv.slice(4)) {
    const database = left.replace(/-/g, '_');
    await ports.databases.destroy(database);
    say(`database ${database} and its backups destroyed`);
  }
  process.exit(0);
}

/** The owner's address the instance was given, read from the hosting — never printed. */
async function ownerUrlOf(instance: Instance): Promise<string> {
  const response = await fetch(`${coolifyUrl}/api/v1/applications/${instance.hostingId}/envs`, {
    headers: { authorization: `Bearer ${coolifyToken}` },
  });
  const envs = (await response.json()) as { key: string; value: string; is_preview?: boolean }[];
  return need(
    envs.find((e) => e.key === 'OWNER_DATABASE_URL' && !e.is_preview)?.value,
    'OWNER_DATABASE_URL',
  );
}

async function sql<T>(url: string, work: (client: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}

// Two versions of Support: its `dev` branch now, and the commit before.
const commits = JSON.parse(
  execFileSync('gh', ['api', 'repos/kete-africa/kete-helpdesk/commits?sha=dev&per_page=2'], {
    encoding: 'utf8',
  }),
) as { sha: string }[];
const [head, previous] = commits.map((c) => c.sha);
const versions = [need(previous, 'a previous commit'), need(head, 'the head commit')];

const stamp = new Date().toISOString().slice(5, 16).replace(/[-T:]/g, '');
const names = [`kete-b2-a-${stamp}`, `kete-b2-b-${stamp}`];
const made: Instance[] = [];
let failed = false;
try {
  for (const name of names) {
    const domain = `${name}.13.140.178.49.sslip.io`;
    say(`instance ${name} at https://${domain}`);
    made.push(
      await provisionInstance(
        ports,
        {
          name,
          repository: 'kete-africa/kete-helpdesk',
          domain,
          description:
            'Preuve B2 (kete-core spec 131) : mise à jour et sauvegarde par le port seul.',
          env: { PUBLIC_URL: `https://${domain}`, KETE_ENVIRONMENT: 'staging' },
          buildEnv: { node_auth_token: need(secrets.KETE_PACKAGES_TOKEN, 'KETE_PACKAGES_TOKEN') },
          waitSeconds: 1500,
        },
        { onStep: (step, state) => say(`  ${name} ${step}: ${state}`) },
      ),
    );
  }

  for (const version of versions) {
    say(`update to ${version.slice(0, 7)} pushed to both`);
    const reports = await updateInstances(ports, made, version, {
      waitSeconds: 1500,
      onInstance: (r) =>
        say(
          `  ${r.name}: ${r.outcome} (from ${r.from?.slice(0, 7) ?? 'its branch'})${r.reason ? `, ${r.reason}` : ''}`,
        ),
    });
    for (const instance of made) {
      say(
        `  ${instance.name} runs ${(await ports.hosting.version(instance.hostingId))?.slice(0, 7)}, answers: ${await ports.probe(instance.url)}`,
      );
    }
    if (reports.some((r) => r.outcome !== 'updated'))
      throw new Error('The update did not reach both.');
  }

  const first = made[0] as Instance;
  const owner = await ownerUrlOf(first);
  await sql(owner, async (db) => {
    await db.query(
      `create table proof_b2 (note text not null);
       alter table proof_b2 enable row level security;
       insert into proof_b2 values ('written before the backup');`,
    );
  });
  const backup = await backupInstance(ports, first);
  say(`backup ${backup.name}`);
  await sql(owner, (db) => db.query(`update proof_b2 set note = 'changed after the backup'`));
  say(
    `data now: ${await sql(owner, async (db) => (await db.query<{ note: string }>('select note from proof_b2')).rows[0]?.note)}`,
  );
  const { before } = await restoreInstance(ports, first, backup.id, { waitSeconds: 600 });
  say(`restored; the state before kept as ${before.name}`);
  say(
    `data now: ${await sql(owner, async (db) => (await db.query<{ note: string }>('select note from proof_b2')).rows[0]?.note)}`,
  );
  say(`answers after the restore: ${await ports.probe(first.url)}`);
  say(`backups: ${(await ports.databases.backups(first.database)).map((b) => b.name).join(', ')}`);
} catch (error) {
  failed = true;
  say(`failed: ${error instanceof Error ? error.message : String(error)}`);
  const cause = (error as { cause?: unknown }).cause;
  if (cause) say(`  cause: ${cause instanceof Error ? cause.message : String(cause)}`);
} finally {
  for (const instance of made) {
    await destroyInstance(ports, instance).catch((error: unknown) =>
      say(`  ${instance.name} left: ${error instanceof Error ? error.message : String(error)}`),
    );
    say(`${instance.name} destroyed; answers after: ${await ports.probe(instance.url)}`);
  }
}
process.exit(failed ? 1 : 0);
