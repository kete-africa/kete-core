import { randomBytes } from 'node:crypto';
import { mustRun, type Sandbox } from '@kete/sandbox';
import type { Ports } from './ports.js';
import type { AppRequest, Progress, Step } from './request.js';

// The factory's pipeline (spec 048): from an approved request to a running app on staging and a
// pull request with its first version. Each step is done once — its result is kept in the
// request's progress — so a job that fails and runs again resumes where it stopped.

export type Advance =
  | { next: 'continue'; progress: Progress }
  | { next: 'wait'; progress: Progress; seconds: number }
  | { next: 'done'; progress: Progress };

const BRANCH = 'factory/first-version';
const AGENT_LOG = '/tmp/kete-agent.log';
const AGENT_DONE = '/tmp/kete-agent.done';

export const repositoryName = (request: AppRequest) => `kete-${request.app.slug}`;

export function appUrl(request: AppRequest, ports: Ports): string {
  return `https://${repositoryName(request)}.${ports.config.appsDomain}`;
}

/** What the coding agent reads first: the request, in the words of the person who asked. */
export function requestDocument(request: AppRequest): string {
  return [
    `# ${request.app.name}`,
    '',
    `Asked by ${request.requester.name}, approved by IT, for the organization ${request.organizationId}.`,
    '',
    '## What it is for',
    '',
    request.app.purpose,
    '',
    '## Who uses it',
    '',
    request.app.users,
    '',
    '## Its identity card',
    '',
    `- Data handled: ${request.app.dataCategories.join(', ')}`,
    `- What an outage costs: ${request.app.criticality}`,
    `- Owner: ${request.app.ownerContact}`,
    '',
  ].join('\n');
}

/** The instructions of the coding agent: the template's rules, then the request. */
export function agentPrompt(request: AppRequest): string {
  return [
    `You are building the first version of « ${request.app.name} », a Kete app created from the`,
    'Kete template in this repository. Read CLAUDE.md, AGENTS.md and docs/ first: they are the',
    'rules. Then read docs/request.md: it is what the person asked for.',
    '',
    'Build it as a feature of the template (src/features/<name>): its records (exposeRecord),',
    'its commands with their reversibility, its capabilities with their autonomy level, its data',
    'sets (defineDataset), its screens (every form in a dialog or on its page, never beside a',
    'list), every word in messages/fr.json and messages/en.json, its RLS migration, its tests.',
    'Replace the example tasks feature. Keep pnpm typecheck and pnpm test green.',
    `Commit on the branch ${BRANCH} with clear messages. Do not push; the factory pushes.`,
  ].join('\n');
}

async function scaffold(sandbox: Sandbox, request: AppRequest, ports: Ports, token: string) {
  const name = repositoryName(request);
  const { packagesToken, repositoryOwner } = ports.config;
  // Secrets reach the sandbox in a file it alone reads, never in a command line.
  await sandbox.writeFile(
    '.factory-env',
    `export NODE_AUTH_TOKEN='${packagesToken}'\nexport PUSH_TOKEN='${token}'\n`,
  );
  await mustRun(sandbox, 'chmod 600 .factory-env', { timeoutSeconds: 10 });
  await sandbox.writeFile(
    '.npmrc',
    '@kete-africa:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n',
  );
  const owner = request.app.ownerContact.replace(/'/g, '');
  await mustRun(
    sandbox,
    `. ./.factory-env && npx --yes pnpm@11 create @kete-africa/app ${name} --owner='${request.requester.name.replace(/'/g, '')}' --contact='${owner}' --design=workspace`,
    { timeoutSeconds: 600 },
  );
  // The identity card the request gave.
  const card = JSON.parse(new TextDecoder().decode(await sandbox.readFile(`${name}/kete.json`)));
  card.name = request.app.name;
  card.governance = {
    ...card.governance,
    dataCategories: request.app.dataCategories,
    criticality: request.app.criticality,
  };
  await sandbox.writeFile(`${name}/kete.json`, `${JSON.stringify(card, null, 2)}\n`);
  await sandbox.writeFile(`${name}/docs/request.md`, requestDocument(request));
  await mustRun(
    sandbox,
    [
      `cd ${name}`,
      'git init -q -b dev',
      'git config user.name "Kete factory"',
      'git config user.email "factory@kete.africa"',
      'git add -A',
      `git commit -q -m "feat: ${request.app.name}, created from the Kete template"`,
      '. ../.factory-env',
      `git push -q "https://x-access-token:$PUSH_TOKEN@github.com/${repositoryOwner}/${name}.git" dev`,
    ].join(' && '),
    { timeoutSeconds: 300 },
  );
}

/** The next step of a request, if any: what it does, and what it adds to the progress. */
export async function advance(
  request: AppRequest,
  progress: Progress,
  ports: Ports,
): Promise<Advance> {
  const done = new Set(progress.done);
  const finish = (step: Step, extra: Partial<Progress> = {}): Advance => ({
    next: 'continue',
    progress: { ...progress, ...extra, done: [...progress.done, step] },
  });
  const name = repositoryName(request);
  const url = appUrl(request, ports);

  if (!done.has('repository')) {
    const repo = await ports.code.ensureRepository(
      name,
      `${request.app.name}: ${request.app.users}`.slice(0, 340),
    );
    await ports.report(request, 'building', progress);
    return finish('repository', { repository: repo.fullName });
  }
  const repository = progress.repository ?? `${ports.config.repositoryOwner}/${name}`;

  if (!done.has('scaffold')) {
    const sandbox = await ports.sandboxes.create({
      ttlSeconds: 3600,
      idempotencyKey: `${request.requestId}-scaffold`,
    });
    try {
      await scaffold(sandbox, request, ports, await ports.code.pushToken());
    } finally {
      await sandbox.destroy();
    }
    return finish('scaffold');
  }

  if (!done.has('secrets')) {
    await ports.code.setSecret(repository, 'KETE_PACKAGES_TOKEN', ports.config.packagesToken);
    return finish('secrets');
  }

  if (!done.has('database') || !done.has('sign-in') || !done.has('hosting')) {
    // The secrets of the app go straight to its hosting: none is kept by the factory.
    const hosting = await ports.hosting.ensureApp({
      name: `${name}-${ports.config.environment}`,
      repository,
      domain: url,
      description: `${request.app.name} — ${ports.config.environment} (branch dev)`,
    });
    const database = await ports.databases.create(name.replace(/-/g, '_'));
    const client = await ports.identity.registerApp({
      name: `${request.app.name} (${ports.config.environment})`,
      redirectUri: `${url}/auth/callback`,
    });
    await ports.hosting.setEnv(
      hosting.id,
      {
        DATABASE_URL: database.appUrl,
        OWNER_DATABASE_URL: database.ownerUrl,
        PUBLIC_URL: url,
        KETE_ACCOUNT_URL: ports.config.accountUrl,
        KETE_CLIENT_ID: client.clientId,
        KETE_CLIENT_SECRET: client.clientSecret,
        SESSION_SECRET: randomBytes(36).toString('base64url'),
        KETE_OPERATORS_ORGANIZATION_ID: ports.config.operatorsOrganizationId,
        KETE_ENVIRONMENT: ports.config.environment,
        ENTERPRISE_API_URL: ports.config.enterpriseApiUrl,
      },
      { node_auth_token: ports.config.packagesToken },
    );
    return {
      next: 'continue',
      progress: {
        ...progress,
        hostingId: hosting.id,
        clientId: client.clientId,
        done: [...progress.done, 'database', 'sign-in', 'hosting'],
      },
    };
  }

  if (!done.has('deploy')) {
    await ports.hosting.deploy(progress.hostingId ?? '');
    const next = { ...progress, url, done: [...progress.done, 'deploy' as const] };
    await ports.report(request, 'ready', next);
    return { next: 'continue', progress: next };
  }

  if (!done.has('coding')) {
    if (!progress.sandboxId) {
      // The agent works in a sandbox of its own, on a clone, in the background.
      const sandbox = await ports.sandboxes.create({
        ttlSeconds: 4 * 3600,
        size: 'large',
        idempotencyKey: `${request.requestId}-coding`,
      });
      const token = await ports.code.pushToken();
      await sandbox.writeFile(
        '.factory-env',
        `export PUSH_TOKEN='${token}'\nexport NODE_AUTH_TOKEN='${ports.config.packagesToken}'\n`,
      );
      await sandbox.writeFile(
        '.npmrc',
        '@kete-africa:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n',
      );
      await mustRun(
        sandbox,
        `chmod 600 .factory-env && . ./.factory-env && git clone -q -b dev "https://x-access-token:$PUSH_TOKEN@github.com/${repository}.git" app && cd app && git checkout -q -b ${BRANCH}`,
        { timeoutSeconds: 300 },
      );
      await ports.agent.prepare(sandbox);
      await sandbox.writeFile('prompt.md', agentPrompt(request));
      await mustRun(
        sandbox,
        `cd app && (. ../.factory-env && ${ports.agent.command('../prompt.md', AGENT_LOG)}; echo $? > ${AGENT_DONE}) > /dev/null 2>&1 &`,
        { timeoutSeconds: 30 },
      );
      const next = { ...progress, sandboxId: sandbox.id };
      await ports.report(request, 'coding', next);
      return { next: 'wait', progress: next, seconds: 120 };
    }
    const sandbox = await ports.sandboxes.open(progress.sandboxId);
    if (!sandbox) throw new Error('The coding sandbox is gone.');
    const status = await sandbox.run(`cat ${AGENT_DONE} 2>/dev/null || echo running`, {
      timeoutSeconds: 20,
    });
    if (status.stdout.trim() === 'running') return { next: 'wait', progress, seconds: 120 };
    if (status.stdout.trim() !== '0') {
      const log = await sandbox.run(`tail -c 3000 ${AGENT_LOG}`, { timeoutSeconds: 20 });
      throw new Error(`The coding agent stopped (${status.stdout.trim()}): ${log.stdout}`);
    }
    await mustRun(
      sandbox,
      `cd app && . ../.factory-env && git add -A && (git diff --cached --quiet || git commit -q -m "feat: first version of ${request.app.name}") && git push -q "https://x-access-token:$PUSH_TOKEN@github.com/${repository}.git" ${BRANCH}`,
      { timeoutSeconds: 300 },
    );
    await sandbox.destroy();
    const { sandboxId: _gone, ...rest } = progress;
    void _gone;
    return { next: 'continue', progress: { ...rest, done: [...progress.done, 'coding'] } };
  }

  if (!done.has('pull-request')) {
    const pull = await ports.code.openPullRequest(repository, {
      head: BRANCH,
      base: 'dev',
      title: `feat: first version of ${request.app.name}`,
      body: [
        `Coded by the factory's agent from the request of ${request.requester.name}.`,
        '',
        requestDocument(request),
        'A person reviews it, CI green, before it is merged.',
      ].join('\n'),
    });
    const next = {
      ...progress,
      pullRequest: pull.url,
      done: [...progress.done, 'pull-request' as const],
    };
    await ports.report(request, 'review', next);
    return { next: 'done', progress: next };
  }
  return { next: 'done', progress };
}
