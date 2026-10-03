import { memoryProvider } from '@kete/sandbox';
import { describe, expect, it } from 'vitest';
import { agentPrompt, advance, requestDocument } from '../src/pipeline.js';
import type { Ports } from '../src/ports.js';
import type { AppRequest, Progress, RequestStatus } from '../src/request.js';
import { work } from '../src/worker.js';

// Spec 048: from an approved request to a running app and a pull request, each step once.

const request: AppRequest = {
  requestId: 'apr_0001-fieldwork',
  organizationId: 'org_kya-demo',
  requester: { userId: 'usr_abla', name: 'Abla Nyuiadzi', email: 'abla@kya-demo.test' },
  app: {
    slug: 'fieldwork',
    name: 'Interventions',
    purpose: 'Planning des techniciens, bons d’intervention signés sur le téléphone, photos.',
    users: 'Techniciens SAV et leur chef de service',
    dataCategories: ['personal', 'location'],
    criticality: 'medium',
    ownerContact: 'abla@kya-demo.test',
  },
  callbackUrl: 'https://api.enterprise.test/v1/factory/reports',
};

function fakes() {
  const calls: string[] = [];
  const reports: RequestStatus[] = [];
  let agentRuns = 0;
  let probes = 0;
  const sandboxes = memoryProvider((command, files) => {
    if (command.includes('create @kete-africa/app')) {
      files.set(
        'kete-fieldwork/kete.json',
        new TextEncoder().encode(
          JSON.stringify({
            name: 'kete-fieldwork',
            governance: {
              owner: { name: 'Abla' },
              dataCategories: ['none'],
              ai: { used: false },
              criticality: 'low',
            },
          }),
        ),
      );
    }
    if (command.startsWith('cat /tmp/kete-agent.done')) {
      agentRuns += 1;
      return { stdout: agentRuns < 2 ? 'running\n' : '0\n' };
    }
    return undefined;
  });
  const ports: Ports = {
    code: {
      ensureRepository: async (name) => {
        calls.push(`repository ${name}`);
        return { fullName: `kete-africa/${name}` };
      },
      pushToken: async () => 'ghs_token',
      setSecret: async (repo, name) => {
        calls.push(`secret ${repo} ${name}`);
      },
      openPullRequest: async (repo, pull) => {
        calls.push(`pull ${repo} ${pull.head}->${pull.base}`);
        return { url: `https://github.com/${repo}/pull/1` };
      },
    },
    databases: {
      create: async (name) => {
        calls.push(`database ${name}`);
        return { ownerUrl: 'postgres://o', appUrl: 'postgres://a' };
      },
    },
    identity: {
      registerApp: async (input) => {
        calls.push(`sign-in ${input.redirectUri}`);
        return { clientId: 'cli_1', clientSecret: 'secret' };
      },
    },
    hosting: {
      ensureApp: async (input) => {
        calls.push(`hosting ${input.name} ${input.domain}`);
        return { id: 'cool_1' };
      },
      setEnv: async (id, runtime, build) => {
        calls.push(
          `env ${id} ${Object.keys(runtime).sort().join(',')} | ${Object.keys(build).join(',')}`,
        );
      },
      deploy: async (id) => {
        calls.push(`deploy ${id}`);
      },
    },
    sandboxes,
    agent: {
      prepare: async () => {
        calls.push('agent ready');
      },
      command: (prompt, log) => `agent ${prompt} > ${log}`,
    },
    probe: async () => {
      probes += 1;
      return probes > 1;
    },
    report: async (_request, status) => {
      reports.push(status);
    },
    config: {
      appsDomain: 'apps.example.test',
      packagesToken: 'ghp_packages',
      accountUrl: 'https://account.test',
      enterpriseApiUrl: 'https://api.enterprise.test',
      environment: 'staging',
      operatorsOrganizationId: 'org_kete',
      repositoryOwner: 'kete-africa',
    },
  };
  return { ports, calls, reports, sandboxes };
}

function memoryStore() {
  const rows = new Map<
    string,
    { request: AppRequest; status: RequestStatus; progress: Progress }
  >();
  rows.set(request.requestId, { request, status: 'queued', progress: { done: [] } });
  return {
    rows,
    store: {
      add: async () => true,
      get: async (_org: string, id: string) => rows.get(id) ?? null,
      save: async (_org: string, id: string, status: RequestStatus, progress: Progress) => {
        const row = rows.get(id);
        if (row) rows.set(id, { ...row, status, progress });
      },
    },
  };
}

describe('the factory’s pipeline', () => {
  it('creates the repository from the template, its hosting, database and sign-in, then deploys', async () => {
    const { ports, calls, reports, sandboxes } = fakes();
    const { store, rows } = memoryStore();
    const waits: number[] = [];
    const schedule = async (_id: string, _org: string, seconds: number) => {
      waits.push(seconds);
    };
    // The first run deploys and finds the app not answering yet; the next one goes on.
    await work(
      { requestId: request.requestId, organizationId: request.organizationId },
      store as never,
      ports,
      schedule,
    );
    expect(rows.get(request.requestId)?.status).toBe('building');
    await work(
      { requestId: request.requestId, organizationId: request.organizationId },
      store as never,
      ports,
      schedule,
    );
    expect(calls).toEqual([
      'repository kete-fieldwork',
      'secret kete-africa/kete-fieldwork KETE_PACKAGES_TOKEN',
      'hosting kete-fieldwork-staging https://kete-fieldwork.apps.example.test',
      'database kete_fieldwork',
      'sign-in https://kete-fieldwork.apps.example.test/auth/callback',
      'env cool_1 DATABASE_URL,ENTERPRISE_API_URL,KETE_ACCOUNT_URL,KETE_CLIENT_ID,KETE_CLIENT_SECRET,KETE_ENVIRONMENT,KETE_OPERATORS_ORGANIZATION_ID,OWNER_DATABASE_URL,PUBLIC_URL,SESSION_SECRET | node_auth_token',
      'deploy cool_1',
      'agent ready',
    ]);
    expect(reports).toEqual(['building', 'ready', 'coding']);
    expect(waits).toEqual([60, 120]);
    // The scaffold: the template, then the identity card and the request, pushed on dev.
    const scaffold = sandboxes.sandboxes[0];
    expect(
      scaffold?.commands.some((c) =>
        c.includes("create @kete-africa/app kete-fieldwork --owner='Abla Nyuiadzi'"),
      ),
    ).toBe(true);
    const card = JSON.parse(
      new TextDecoder().decode(scaffold?.files.get('kete-fieldwork/kete.json')),
    );
    expect(card).toMatchObject({
      name: 'Interventions',
      governance: { dataCategories: ['personal', 'location'], criticality: 'medium' },
    });
    expect(scaffold?.state).toBe('deleted');
    // Secrets go through a file, never through a command line.
    expect(scaffold?.commands.join('\n')).not.toContain('ghs_token');
    expect(scaffold?.commands.join('\n')).not.toContain('ghp_packages');
    expect(rows.get(request.requestId)?.status).toBe('coding');
  });

  it('waits while the agent works, then pushes its work and opens a pull request for review', async () => {
    const { ports, calls, reports, sandboxes } = fakes();
    const { store, rows } = memoryStore();
    const schedule = async () => undefined;
    await work(
      { requestId: request.requestId, organizationId: request.organizationId },
      store as never,
      ports,
      schedule,
    );
    await work(
      { requestId: request.requestId, organizationId: request.organizationId },
      store as never,
      ports,
      schedule,
    );
    await work(
      { requestId: request.requestId, organizationId: request.organizationId },
      store as never,
      ports,
      schedule,
    );
    await work(
      { requestId: request.requestId, organizationId: request.organizationId },
      store as never,
      ports,
      schedule,
    );
    expect(calls.at(-1)).toBe('pull kete-africa/kete-fieldwork factory/first-version->dev');
    expect(reports.at(-1)).toBe('review');
    const row = rows.get(request.requestId);
    expect(row).toMatchObject({
      status: 'review',
      progress: { pullRequest: 'https://github.com/kete-africa/kete-fieldwork/pull/1' },
    });
    const coding = sandboxes.sandboxes[1];
    expect(
      coding?.commands.some((c) => c.includes('git push') && c.includes('factory/first-version')),
    ).toBe(true);
    expect(coding?.state).toBe('deleted');
  });

  it('fails a request when a step fails, and reports it', async () => {
    const { ports, reports } = fakes();
    ports.databases.create = async () => {
      throw new Error('no capacity');
    };
    const { store, rows } = memoryStore();
    await work(
      { requestId: request.requestId, organizationId: request.organizationId },
      store as never,
      ports,
      async () => undefined,
    );
    expect(rows.get(request.requestId)).toMatchObject({
      status: 'failed',
      progress: { error: 'no capacity' },
    });
    expect(reports.at(-1)).toBe('failed');
  });

  it('resumes after the last step done', async () => {
    const { ports, calls } = fakes();
    const result = await advance(request, { done: ['repository', 'scaffold'] }, ports);
    expect(result.progress.done).toEqual(['repository', 'scaffold', 'secrets']);
    expect(calls).toEqual(['secret kete-africa/kete-fieldwork KETE_PACKAGES_TOKEN']);
  });

  it('tells the agent the template’s rules, then the request', () => {
    expect(agentPrompt(request)).toContain('never beside a');
    expect(requestDocument(request)).toContain('Planning des techniciens');
  });
});
