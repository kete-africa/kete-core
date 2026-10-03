import {
  SandboxError,
  type AgentRunStatus,
  type CommandResult,
  type CreateOptions,
  type RunOptions,
  type Sandbox,
  type SandboxProvider,
} from './port.js';

// The boat.dev adapter (spec 047): persistent Linux machines with Docker, git and Node, billed by
// the second. Its name stays in this file; the rest of Kete speaks of « a sandbox ».

export interface BoatOptions {
  apiKey: string;
  /** Default `https://boat.dev/api/v1`. */
  baseUrl?: string;
  fetch?: typeof fetch;
  /** How long to wait for a new machine to be ready (default 180 s). */
  readyTimeoutMs?: number;
  /** Pause between readiness checks (default 2 s). */
  pollMs?: number;
}

interface BoatSandbox {
  id: string;
  state: string;
}

export function boatProvider(options: BoatOptions): SandboxProvider {
  const base = (options.baseUrl ?? 'https://boat.dev/api/v1').replace(/\/$/, '');
  const http = options.fetch ?? fetch;
  const call = async <T>(
    method: string,
    path: string,
    body?: unknown,
    key?: string,
    extra: Record<string, string> = {},
  ): Promise<T> => {
    const response = await http(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(key ? { 'idempotency-key': key } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 404) throw new SandboxError('not_found', `${method} ${path}: 404`);
    if (response.status === 401 || response.status === 403) {
      throw new SandboxError('refused', `${method} ${path}: ${response.status}`);
    }
    if (!response.ok) {
      // The provider says why (`provider_not_configured`, `subscription_required`…): kept, so a
      // failure tells what to fix.
      const answer = (await response.json().catch(() => null)) as {
        code?: string;
        message?: string;
      } | null;
      const why = answer?.code ? ` ${answer.code}: ${answer.message ?? ''}`.trimEnd() : '';
      throw new SandboxError('unavailable', `${method} ${path}: ${response.status}${why}`);
    }
    return (await response.json()) as T;
  };

  const handle = (id: string): Sandbox => ({
    id,
    async run(command: string, run: RunOptions = {}): Promise<CommandResult> {
      const answer = await call<{
        exitCode: number | null;
        stdout: string;
        stderr: string;
        timedOut: boolean;
      }>('POST', `/sandboxes/${id}/commands`, {
        command,
        timeoutSeconds: Math.min(Math.max(run.timeoutSeconds ?? 120, 1), 600),
        ...(run.cwd ? { cwd: run.cwd } : {}),
      });
      return {
        exitCode: answer.exitCode,
        stdout: answer.stdout ?? '',
        stderr: answer.stderr ?? '',
        timedOut: Boolean(answer.timedOut),
      };
    },
    async writeFile(path: string, content: string | Uint8Array) {
      await call('PUT', `/sandboxes/${id}/files`, {
        path,
        ...(typeof content === 'string'
          ? { content, encoding: 'utf8' }
          : { content: Buffer.from(content).toString('base64'), encoding: 'base64' }),
      });
    },
    async readFile(path: string) {
      // Read through a command: the bytes come back in base64, whatever the file holds.
      const quoted = `'${path.replace(/'/g, `'\\''`)}'`;
      const result = await this.run(`base64 -w0 ${quoted}`, { timeoutSeconds: 60 });
      if (result.exitCode !== 0) throw new SandboxError('not_found', `No file at ${path}`);
      return new Uint8Array(Buffer.from(result.stdout.trim(), 'base64'));
    },
    async prompt(input) {
      const answer = await call<{ promptId?: string; promptRun?: { promptId?: string } }>(
        'POST',
        `/sandboxes/${id}/prompt`,
        {
          provider: input.agent,
          prompt: input.prompt,
          new: true,
          ...(input.model ? { model: input.model } : {}),
          ...(input.reasoningEffort ? { reasoningEffort: input.reasoningEffort } : {}),
        },
      );
      const runId = answer.promptId ?? answer.promptRun?.promptId;
      if (!runId) throw new SandboxError('failed', `Sandbox ${id}: the prompt was not queued`);
      return { runId };
    },
    async promptStatus(runId) {
      const { promptRun } = await call<{ promptRun: { status: string } }>(
        'GET',
        `/sandboxes/${id}/prompts/${encodeURIComponent(runId)}`,
      );
      const status = promptRun.status;
      return status === 'sending' ? 'queued' : (status as AgentRunStatus);
    },
    async stop() {
      await call('POST', `/sandboxes/${id}/stop`, {});
    },
    async destroy() {
      // The provider asks the deletion to name its target, so that no id is deleted by mistake.
      await call('DELETE', `/sandboxes/${id}`, undefined, undefined, {
        'x-ascii-confirm-delete': id,
      });
    },
  });

  async function waitReady(id: string): Promise<void> {
    const deadline = Date.now() + (options.readyTimeoutMs ?? 180_000);
    for (;;) {
      const { sandbox } = await call<{ sandbox: BoatSandbox }>('GET', `/sandboxes/${id}`);
      if (['ready', 'idle', 'running'].includes(sandbox.state)) return;
      if (['error', 'archiving', 'archived', 'failed', 'deleted'].includes(sandbox.state)) {
        throw new SandboxError('unavailable', `Sandbox ${id}: ${sandbox.state}`);
      }
      if (Date.now() > deadline) throw new SandboxError('timeout', `Sandbox ${id} not ready`);
      await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 2000));
    }
  }

  /** A sandbox being stopped is resumed only once it is stopped. */
  async function waitArchived(id: string): Promise<string> {
    const deadline = Date.now() + (options.readyTimeoutMs ?? 180_000);
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, options.pollMs ?? 2000));
      const { sandbox } = await call<{ sandbox: BoatSandbox }>('GET', `/sandboxes/${id}`);
      if (sandbox.state !== 'archiving') return sandbox.state;
      if (Date.now() > deadline) throw new SandboxError('timeout', `Sandbox ${id} still stopping`);
    }
  }

  return {
    async create(create: CreateOptions = {}) {
      const answer = await call<{ status: string; sandbox: BoatSandbox }>(
        'POST',
        '/sandboxes',
        {
          type: create.size ?? 'default',
          ttlSeconds: create.ttlSeconds ?? 3600,
          // Never the account's own secrets: the sandbox gets only what the caller gives it — or,
          // with a template, the agents' sign-in that template passes, and nothing else.
          ...(create.template ? { environment: create.template } : { noEnv: true }),
          ...(create.env ? { env: create.env } : {}),
        },
        create.idempotencyKey,
      );
      if (answer.sandbox.state !== 'ready') await waitReady(answer.sandbox.id);
      return handle(answer.sandbox.id);
    },
    async open(id: string, open: { resume?: boolean } = {}) {
      let state: string;
      try {
        ({
          sandbox: { state },
        } = await call<{ sandbox: BoatSandbox }>('GET', `/sandboxes/${id}`));
      } catch (error) {
        if (error instanceof SandboxError && error.code === 'not_found') return null;
        throw error;
      }
      if (state === 'cancelled') return null;
      if (open.resume === false) return handle(id);
      // A stopped sandbox keeps its disk — a person's own agent sign-in among it: it comes back
      // where it was, on a fresh machine, before it is handed out.
      if (state === 'archiving') state = await waitArchived(id);
      if (state === 'archived') {
        await call('POST', `/sandboxes/${id}/resume`, {});
        await waitReady(id);
      } else if (!['ready', 'idle', 'running'].includes(state)) {
        await waitReady(id);
      }
      return handle(id);
    },
  };
}
