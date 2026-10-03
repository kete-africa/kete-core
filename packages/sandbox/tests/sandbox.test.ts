import { describe, expect, it } from 'vitest';
import { boatProvider, memoryProvider, mustRun, SandboxError } from '../src/index.js';

// Spec 047: an isolated computer behind a neutral port; the provider's adapter speaks its API.

/** A fake provider API: records each call, answers like the provider documents. */
function fakeBoat() {
  const calls: {
    method: string;
    path: string;
    body: unknown;
    key: string | null;
    auth: string | null;
  }[] = [];
  let polls = 0;
  const fetcher = (async (url: string | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname.replace('/api/v1', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const headers = new Headers(init?.headers);
    calls.push({
      method: init?.method ?? 'GET',
      path,
      body,
      key: headers.get('idempotency-key'),
      auth: headers.get('authorization'),
    });
    const json = (value: unknown, status = 200) => Response.json(value, { status });
    if (init?.method === 'POST' && path === '/sandboxes') {
      return json(
        { ok: true, status: 'provisioning', sandbox: { id: 'bx_1', state: 'provisioning' } },
        202,
      );
    }
    if (init?.method === 'GET' && path === '/sandboxes/bx_1') {
      polls += 1;
      return json({ sandbox: { id: 'bx_1', state: polls > 1 ? 'ready' : 'provisioning' } });
    }
    if (path === '/sandboxes/bx_404') return json({ error: 'not_found' }, 404);
    if (path === '/sandboxes/bx_1/commands') {
      const command = (body as { command: string }).command;
      if (command.startsWith('base64')) {
        return json({
          exitCode: 0,
          stdout: Buffer.from('hello').toString('base64'),
          stderr: '',
          timedOut: false,
        });
      }
      if (command === 'false')
        return json({ exitCode: 1, stdout: '', stderr: 'nope', timedOut: false });
      return json({ exitCode: 0, stdout: 'ok\n', stderr: '', timedOut: false });
    }
    return json({ ok: true });
  }) as typeof fetch;
  return { calls, fetcher };
}

describe('the provider adapter', () => {
  it('creates a machine without the account secrets, waits until it is ready', async () => {
    const boat = fakeBoat();
    const provider = boatProvider({ apiKey: 'boat_test', fetch: boat.fetcher, pollMs: 1 });
    const sandbox = await provider.create({ ttlSeconds: 600, idempotencyKey: 'factory-req-1' });
    expect(sandbox.id).toBe('bx_1');
    expect(boat.calls[0]).toMatchObject({
      method: 'POST',
      path: '/sandboxes',
      body: { ttlSeconds: 600, noEnv: true },
      key: 'factory-req-1',
      auth: 'Bearer boat_test',
    });
    expect(boat.calls.filter((c) => c.path === '/sandboxes/bx_1').length).toBe(2);
  });

  it('runs commands, writes and reads files, and stops a failing step', async () => {
    const boat = fakeBoat();
    const sandbox = await boatProvider({ apiKey: 'k', fetch: boat.fetcher, pollMs: 1 }).create();
    expect((await sandbox.run('echo ok', { cwd: 'app', timeoutSeconds: 9999 })).stdout).toBe(
      'ok\n',
    );
    expect(boat.calls.find((c) => c.path.endsWith('/commands'))?.body).toEqual({
      command: 'echo ok',
      timeoutSeconds: 600,
      cwd: 'app',
    });
    await sandbox.writeFile('docs/request.md', '# Need');
    await sandbox.writeFile('bin.dat', new Uint8Array([1, 2, 3]));
    const writes = boat.calls.filter((c) => c.method === 'PUT').map((c) => c.body);
    expect(writes).toEqual([
      { path: 'docs/request.md', content: '# Need', encoding: 'utf8' },
      { path: 'bin.dat', content: 'AQID', encoding: 'base64' },
    ]);
    expect(new TextDecoder().decode(await sandbox.readFile('x.txt'))).toBe('hello');
    await expect(mustRun(sandbox, 'false')).rejects.toBeInstanceOf(SandboxError);
  });

  it('says when a sandbox no longer exists', async () => {
    const boat = fakeBoat();
    expect(await boatProvider({ apiKey: 'k', fetch: boat.fetcher }).open('bx_404')).toBeNull();
  });
});

describe('the sandbox in memory, for tests', () => {
  it('keeps files and answers commands from a script', async () => {
    const provider = memoryProvider((command) =>
      command === 'git status' ? { stdout: 'clean' } : undefined,
    );
    const sandbox = await provider.create();
    await sandbox.writeFile('a.txt', 'x');
    expect(new TextDecoder().decode(await sandbox.readFile('a.txt'))).toBe('x');
    expect((await sandbox.run('git status')).stdout).toBe('clean');
    await sandbox.destroy();
    expect(await provider.open(sandbox.id)).toBeNull();
    expect(provider.sandboxes[0]?.commands).toEqual(['git status']);
  });
});
