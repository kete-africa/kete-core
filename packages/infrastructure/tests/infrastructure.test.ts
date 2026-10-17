import { describe, expect, it } from 'vitest';
import {
  coolify,
  destroyInstance,
  hostedStatusOf,
  memoryInfrastructure,
  neon,
  provisionInstance,
  ProvisionError,
  type ProvisioningPorts,
} from '../src/index.js';

// Spec 121: a Kete instance created, deployed and destroyed through the provisioning port alone —
// KYA's own Kete Enterprise — and nothing left half-built when a step fails.

const spec = {
  name: 'kya-enterprise',
  repository: 'kete-africa/kete-enterprise',
  domain: 'kya.kete.software',
  description: 'Kete Enterprise de KYA',
  env: { KETE_ACCOUNT_URL: 'https://compte.kete.software' },
  buildEnv: { NODE_AUTH_TOKEN: 'packages-token' },
};

function portsOf(memory = memoryInfrastructure(), answers = true): ProvisioningPorts {
  return { ...memory, probe: async () => answers };
}

describe('an instance through the port alone', () => {
  it('is created, answers, then is destroyed — each step said', async () => {
    const memory = memoryInfrastructure();
    const steps: string[] = [];
    const instance = await provisionInstance(portsOf(memory), spec, {
      onStep: (step, state) => steps.push(`${step}:${state}`),
    });
    expect(instance).toEqual({
      name: 'kya-enterprise',
      database: 'kya_enterprise',
      hostingId: 'app-1',
      url: 'https://kya.kete.software',
    });
    expect(memory.databases.names.has('kya_enterprise')).toBe(true);
    expect(memory.hosting.apps.get('app-1')).toMatchObject({
      deployed: true,
      env: {
        KETE_ACCOUNT_URL: 'https://compte.kete.software',
        DATABASE_URL: 'postgres://kya_enterprise_app@memory/kya_enterprise',
        NODE_AUTH_TOKEN: 'packages-token',
      },
    });
    expect(steps).toEqual([
      'database:started',
      'database:done',
      'app:started',
      'app:done',
      'environment:started',
      'environment:done',
      'deployment:started',
      'deployment:done',
      'answer:started',
      'answer:done',
    ]);
    // Twice is harmless: the same app, the same database.
    expect((await provisionInstance(portsOf(memory), spec)).hostingId).toBe('app-1');
    await destroyInstance(portsOf(memory), instance);
    expect(memory.databases.names.size).toBe(0);
    expect(memory.hosting.apps.size).toBe(0);
  });

  it('undoes what it made when a step fails, the latest first', async () => {
    const memory = memoryInfrastructure({ fail: { deploy: true } });
    const steps: string[] = [];
    const failed = await provisionInstance(portsOf(memory), spec, {
      onStep: (step, state) => state === 'undone' && steps.push(step),
    }).catch((error: unknown) => error);
    expect(failed).toBeInstanceOf(ProvisionError);
    expect(failed).toMatchObject({ step: 'deployment', leftover: [] });
    expect(steps).toEqual(['app', 'database']);
    expect(memory.databases.names.size).toBe(0);
    expect(memory.hosting.apps.size).toBe(0);
  });

  it('gives up when it never answers, and undoes', async () => {
    const memory = memoryInfrastructure();
    let clock = 0;
    const failed = await provisionInstance(
      portsOf(memory, false),
      { ...spec, waitSeconds: 30 },
      { now: () => clock, sleep: async (ms) => void (clock += ms) },
    ).catch((error: unknown) => error);
    expect(failed).toMatchObject({ step: 'answer' });
    expect(memory.hosting.apps.size).toBe(0);
    await expect(provisionInstance(portsOf(memory), { ...spec, name: 'KYA' })).rejects.toThrow(
      RangeError,
    );
  });
});

/** A provider's API as the test plays it: every call kept, answered from a table. */
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

describe('the hosting adapter', () => {
  it('says an application’s state in the port’s words', () => {
    expect(hostedStatusOf('running:healthy')).toBe('running');
    expect(hostedStatusOf('restarting:unknown')).toBe('starting');
    expect(hostedStatusOf('exited:unhealthy')).toBe('stopped');
    expect(hostedStatusOf('degraded:unhealthy')).toBe('failed');
    expect(hostedStatusOf(undefined)).toBe('unknown');
  });

  it('creates, deploys, reads and destroys an application; gone is harmless', async () => {
    const api = fakeApi((method, path) => {
      if (method === 'GET' && path === '/api/v1/applications') return [200, []];
      if (method === 'POST' && path === '/api/v1/applications/private-github-app')
        return [201, { uuid: 'u1' }];
      if (method === 'GET' && path === '/api/v1/applications/u1/envs') return [200, [{ key: 'A' }]];
      if (method === 'GET' && path === '/api/v1/applications/u1')
        return [200, { status: 'running:healthy' }];
      if (method === 'GET' && path === '/api/v1/applications/gone')
        return [404, { message: 'Not found' }];
      if (method === 'DELETE' && path.startsWith('/api/v1/applications/gone')) return [404, null];
      return [200, {}];
    });
    const hosting = coolify({
      url: 'https://deploy.test/',
      token: 't',
      projectId: 'p',
      serverId: 's',
      environment: 'production',
      githubAppId: 'g',
      fetch: api.http,
    });
    expect(
      await hosting.ensureApp({ name: 'kya', repository: 'r', domain: 'd', description: 'x' }),
    ).toEqual({
      id: 'u1',
    });
    await hosting.setEnv('u1', { A: '1', B: '2' }, { T: '3' });
    await hosting.deploy('u1');
    expect(await hosting.status('u1')).toBe('running');
    expect(await hosting.status('gone')).toBe('unknown');
    await hosting.destroy('u1');
    await hosting.destroy('gone');
    expect(api.calls).toEqual([
      'GET /api/v1/applications',
      'POST /api/v1/applications/private-github-app',
      'PATCH /api/v1/applications/u1',
      'GET /api/v1/applications/u1/envs',
      'PATCH /api/v1/applications/u1/envs',
      'POST /api/v1/applications/u1/envs',
      'POST /api/v1/applications/u1/envs',
      'POST /api/v1/deploy?uuid=u1',
      'GET /api/v1/applications/u1',
      'GET /api/v1/applications/gone',
      'DELETE /api/v1/applications/u1?delete_configurations=true&delete_volumes=true&docker_cleanup=true&delete_connected_networks=true',
      'DELETE /api/v1/applications/gone?delete_configurations=true&delete_volumes=true&docker_cleanup=true&delete_connected_networks=true',
    ]);
  });
});

describe('the database adapter', () => {
  it('creates a database with its owner and its application role, and destroys all three', async () => {
    const sql: string[] = [];
    let appRole = false;
    let busy = 1;
    let created = false;
    const api = fakeApi((method, path) => {
      // Neon still applies the database's removal: the owner's goes on the next try.
      if (method === 'DELETE' && path.endsWith('/roles/kya_owner') && busy-- > 0)
        return [422, { message: 'operation in progress' }];
      if (path === '/api/v2/projects/prj/branches')
        return [200, { branches: [{ id: 'br', name: 'main' }] }];
      if (method === 'GET' && path.endsWith('/roles')) return [200, { roles: [] }];
      if (method === 'POST' && path.endsWith('/databases')) created = true;
      if (method === 'DELETE' && path.endsWith('/databases/kya')) created = false;
      if (method === 'GET' && path.endsWith('/databases'))
        return [200, { databases: created ? [{ name: 'kya' }] : [] }];
      if (path.startsWith('/api/v2/projects/prj/connection_uri'))
        return [200, { uri: 'postgres://kya_owner:pw@db.test/kya' }];
      return [200, {}];
    });
    const databases = neon({
      apiKey: 'k',
      projectId: 'prj',
      branch: 'main',
      fetch: api.http,
      settle: async () => undefined,
      sql: () => ({
        connect: async () => undefined,
        end: async () => undefined,
        async query(text) {
          sql.push(text.replace(/password '[^']+'/, "password '…'"));
          if (text.startsWith('select 1 from pg_roles')) return { rowCount: appRole ? 1 : 0 };
          if (text.startsWith('create role')) appRole = true;
          return { rowCount: 0 };
        },
      }),
    });
    const urls = await databases.create('kya');
    expect(urls.ownerUrl).toBe('postgres://kya_owner:pw@db.test/kya');
    expect(new URL(urls.appUrl).username).toBe('kya_app');
    expect(urls.appUrl).not.toContain(':pw@');
    await databases.destroy('kya');
    expect(sql).toEqual([
      'select 1 from pg_roles where rolname = $1',
      "create role kya_app with login password '…'",
      'grant connect on database kya to kya_app',
      'grant usage on schema public to kya_app',
      'select 1 from pg_roles where rolname = $1',
      'grant kya_app to kya_owner',
      'drop owned by kya_app',
      'drop role kya_app',
    ]);
    expect(api.calls.filter((c) => c.startsWith('POST') || c.startsWith('DELETE'))).toEqual([
      'POST /api/v2/projects/prj/branches/br/roles',
      'POST /api/v2/projects/prj/branches/br/databases',
      'DELETE /api/v2/projects/prj/branches/br/databases/kya',
      'DELETE /api/v2/projects/prj/branches/br/roles/kya_owner',
      'DELETE /api/v2/projects/prj/branches/br/roles/kya_owner',
    ]);
    // Destroying again, once gone, is harmless: nothing is connected to.
    const before = sql.length;
    await databases.destroy('kya');
    expect(sql.length).toBe(before);
    await expect(databases.create('Bad name')).rejects.toThrow(/Not a database name/);
  });
});
