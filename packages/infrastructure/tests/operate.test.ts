import { describe, expect, it } from 'vitest';
import {
  backupInstance,
  coolify,
  memoryInfrastructure,
  neon,
  provisionInstance,
  restoreInstance,
  updateInstances,
  type ProvisioningPorts,
} from '../src/index.js';

// Spec 131, phase 11 step B2: « une mise à jour poussée à deux instances, une sauvegarde
// restaurée » — through the provisioning port alone; a version that breaks is taken back and the
// rollout stops; a restore keeps the state just before.

const quick = { sleep: async () => undefined, waitSeconds: 1 };

async function twoInstances(options: Parameters<typeof memoryInfrastructure>[0] = {}) {
  const memory = memoryInfrastructure(options);
  const ports: ProvisioningPorts = { ...memory, probe: async (url) => memory.answers(url) };
  const make = (name: string) =>
    provisionInstance(
      ports,
      {
        name,
        repository: 'kete-africa/kete-enterprise',
        domain: `${name}.kete.software`,
        description: name,
      },
      quick,
    );
  return { memory, ports, kya: await make('kya-enterprise'), bleu: await make('bleu-enterprise') };
}

describe('an update pushed to instances', () => {
  it('reaches each one in turn, and says what each ran before', async () => {
    const { memory, ports, kya, bleu } = await twoInstances();
    const said: string[] = [];
    const reports = await updateInstances(ports, [kya, bleu], 'v1.4.0', {
      ...quick,
      onInstance: (report) => said.push(`${report.name} ${report.outcome}`),
    });
    expect(reports).toEqual([
      { name: 'kya-enterprise', from: null, to: 'v1.4.0', outcome: 'updated' },
      { name: 'bleu-enterprise', from: null, to: 'v1.4.0', outcome: 'updated' },
    ]);
    expect(said).toEqual(['kya-enterprise updated', 'bleu-enterprise updated']);
    expect([...memory.hosting.apps.values()].map((app) => app.running)).toEqual([
      'v1.4.0',
      'v1.4.0',
    ]);
  });

  it('takes back a version that fails, and stops the rollout there', async () => {
    const { memory, ports, kya, bleu } = await twoInstances({ broken: ['v1.5.0'] });
    await updateInstances(ports, [kya, bleu], 'v1.4.0', quick);
    const reports = await updateInstances(ports, [kya, bleu], 'v1.5.0', quick);
    expect(reports).toEqual([
      {
        name: 'kya-enterprise',
        from: 'v1.4.0',
        to: 'v1.5.0',
        outcome: 'rolled_back',
        reason: 'the deployment failed',
      },
      { name: 'bleu-enterprise', from: 'v1.4.0', to: 'v1.5.0', outcome: 'skipped' },
    ]);
    expect([...memory.hosting.apps.values()].map((app) => app.running)).toEqual([
      'v1.4.0',
      'v1.4.0',
    ]);
  });

  it('takes back a version that deploys but never answers', async () => {
    const { ports, kya } = await twoInstances({ silent: ['v1.6.0'] });
    let clock = 0;
    const [report] = await updateInstances(ports, [kya], 'v1.6.0', {
      sleep: async () => {
        clock += 10_000;
      },
      now: () => clock,
      waitSeconds: 30,
    });
    expect(report).toMatchObject({ outcome: 'rolled_back', reason: 'it did not answer in time' });
  });
});

describe('a backup restored', () => {
  it('brings the instance back to it, restarted, the state just before kept', async () => {
    const { memory, ports, kya } = await twoInstances();
    memory.databases.contents.set(kya.database, { invoices: ['F-0412'] });
    const backup = await backupInstance(ports, kya);
    memory.databases.contents.set(kya.database, { invoices: [] });
    const { before } = await restoreInstance(ports, kya, backup.id, quick);
    expect(memory.databases.contents.get(kya.database)).toEqual({ invoices: ['F-0412'] });
    expect(memory.hosting.apps.get(kya.hostingId)?.restarts).toBe(1);
    expect(before.name).toMatch(/^kya_enterprise--bk-.*-before$/);
    // The restore is undone by another.
    await restoreInstance(ports, kya, before.id, quick);
    expect(memory.databases.contents.get(kya.database)).toEqual({ invoices: [] });
    expect((await ports.databases.backups(kya.database)).length).toBe(3);
  });
});

function fakeApi(answer: (method: string, path: string, body: unknown) => [number, unknown]) {
  const calls: string[] = [];
  const http = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname + new URL(url).search;
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}`);
    const [status, body] = answer(method, path, init?.body ? JSON.parse(String(init.body)) : null);
    return new Response(body === null ? '' : JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { calls, http };
}

describe('Neon, a branch per database', () => {
  it('backs a database up as a child branch, restores it, and deletes the family leaf first', async () => {
    type Branch = { id: string; name: string; parent_id?: string | undefined; created_at: string };
    let branches: Branch[] = [{ id: 'br-main', name: 'main', created_at: '2026-10-01T00:00:00Z' }];
    let next = 0;
    const api = fakeApi((method, path, body) => {
      const base = '/api/v2/projects/prj';
      if (path.startsWith(`${base}/operations`))
        return [200, { operations: [{ status: 'finished' }] }];
      if (path === `${base}/branches` && method === 'GET') return [200, { branches }];
      if (path === `${base}/branches` && method === 'POST') {
        const asked = (body as { branch: { parent_id: string; name: string } }).branch;
        const made = {
          id: `br-${++next}`,
          name: asked.name,
          parent_id: asked.parent_id,
          created_at: `2026-10-18T05:0${next}:00Z`,
        };
        branches = [...branches, made];
        return [201, { branch: made }];
      }
      const restore = /\/branches\/([^/]+)\/restore$/.exec(path);
      if (restore) {
        // As Neon does it: the restored branch hangs under its source, the source under the state
        // kept before, and that one where the restored branch was.
        const asked = body as { source_branch_id: string; preserve_under_name: string };
        const own = branches.find((b) => b.id === restore[1]) as Branch;
        const kept = {
          id: `br-${++next}`,
          name: asked.preserve_under_name,
          parent_id: own.parent_id,
          created_at: '2026-10-18T06:00:00Z',
        };
        branches = [
          ...branches.map((b) =>
            b.id === own.id
              ? { ...b, parent_id: asked.source_branch_id }
              : b.id === asked.source_branch_id
                ? { ...b, parent_id: kept.id }
                : b,
          ),
          kept,
        ];
        return [200, { branch: own }];
      }
      const removed = /\/branches\/([^/]+)$/.exec(path);
      if (method === 'DELETE' && removed) {
        if (branches.some((b) => b.parent_id === removed[1])) return [422, { message: 'children' }];
        branches = branches.filter((b) => b.id !== removed[1]);
        return [200, {}];
      }
      if (path.endsWith('/roles') && method === 'GET') return [200, { roles: [] }];
      if (path.endsWith('/databases') && method === 'GET') return [200, { databases: [] }];
      if (path.includes('/connection_uri'))
        return [200, { uri: 'postgres://kya_owner:pw@br.test/kya' }];
      return [200, {}];
    });
    const databases = neon({
      apiKey: 'k',
      projectId: 'prj',
      branch: 'main',
      branchPerDatabase: true,
      fetch: api.http,
      settle: async () => undefined,
      now: () => new Date('2026-10-18T05:30:00.000Z'),
      sql: () => ({
        connect: async () => undefined,
        end: async () => undefined,
        query: async () => ({ rowCount: 0 }),
      }),
    });
    await databases.create('kya');
    const own = branches.find((b) => b.name === 'kya');
    expect(own?.parent_id).toBe('br-main');
    const backup = await databases.backup('kya');
    expect(backup).toMatchObject({ name: 'kya--bk-20261018T053000' });
    expect(branches.find((b) => b.id === backup.id)?.parent_id).toBe(own?.id);
    const { before } = await databases.restore('kya', backup.id);
    expect(before.name).toBe('kya--bk-20261018T053000-before');
    expect((await databases.backups('kya')).map((b) => b.name)).toEqual([
      'kya--bk-20261018T053000-before',
      'kya--bk-20261018T053000',
    ]);
    await expect(databases.restore('kya', 'br-main')).rejects.toThrow(/no backup/);
    await databases.destroy('kya');
    expect(branches.map((b) => b.name)).toEqual(['main']);
    // Without a branch per database, there is nothing to back up alone.
    const shared = neon({ apiKey: 'k', projectId: 'prj', branch: 'main', fetch: api.http });
    await expect(shared.backup('kya')).rejects.toThrow(/branch per database/);
  });
});

describe('Coolify, a version and its deployment', () => {
  it('pins a commit, follows its deployment, restarts', async () => {
    let sha = 'HEAD';
    const api = fakeApi((method, path, body) => {
      if (path === '/api/v1/applications/app-1' && method === 'PATCH') {
        sha = (body as { git_commit_sha: string }).git_commit_sha;
        return [200, {}];
      }
      if (path === '/api/v1/applications/app-1')
        return [200, { git_commit_sha: sha, status: 'running' }];
      if (path.startsWith('/api/v1/deploy?'))
        return [200, { deployments: [{ deployment_uuid: 'dpl-9' }] }];
      if (path === '/api/v1/deployments/dpl-9') return [200, { status: 'finished' }];
      return [200, {}];
    });
    const hosting = coolify({
      url: 'https://coolify.test',
      token: 't',
      projectId: 'p',
      serverId: 's',
      environment: 'production',
      githubAppId: 'g',
      fetch: api.http,
    });
    expect(await hosting.version('app-1')).toBeNull();
    await hosting.pin('app-1', 'a1b2c3d');
    expect(await hosting.version('app-1')).toBe('a1b2c3d');
    expect(await hosting.deploy('app-1')).toBe('dpl-9');
    expect(await hosting.deployment('dpl-9')).toBe('done');
    await hosting.pin('app-1', null);
    expect(sha).toBe('HEAD');
    await hosting.restart('app-1');
    expect(api.calls).toContain('POST /api/v1/applications/app-1/restart');
  });
});
