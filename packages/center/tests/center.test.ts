import { describe, expect, it } from 'vitest';
import { createCenter } from '../src/index.js';

function fakeFetch(answer: () => Response) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return answer();
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const grants = {
  managed: true,
  permissions: [{ permission: 'tickets:manage', everywhere: false, units: ['unt_sav'] }],
};

describe('the center, as an app sees it', () => {
  it('reads the person’s grants with her token, and keeps them five minutes', async () => {
    const { calls, fetcher } = fakeFetch(() => Response.json(grants));
    let time = 0;
    const center = createCenter({
      url: 'https://api.center.test/',
      product: 'prd_kete_helpdesk',
      source: 'kete-helpdesk',
      fetch: fetcher,
      now: () => time,
    });
    expect(await center.grants('token-a')).toEqual(grants);
    expect(calls[0]?.url).toBe('https://api.center.test/v1/apps/prd_kete_helpdesk/grants');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer token-a');
    time = 299_000;
    await center.grants('token-a');
    expect(calls).toHaveLength(1);
    time = 301_000;
    await center.grants('token-a');
    expect(calls).toHaveLength(2);
  });

  it('answers nothing without a center, a token, or a valid answer — the app goes on alone', async () => {
    const alone = createCenter({ url: '', product: 'prd_x', source: 'x' });
    expect(alone.connected).toBe(false);
    expect(await alone.grants('token')).toBeNull();
    expect(
      await alone.sendReading('token', { quarter: 'q', indicator: 'i', value: 1, proof: 'p' }),
    ).toEqual({ ok: false, error: 'not_connected' });
    const broken = createCenter({
      url: 'https://api.center.test',
      product: 'prd_x',
      source: 'x',
      fetch: fakeFetch(() => Response.json({ hello: 1 })).fetcher,
    });
    expect(await broken.grants('token')).toBeNull();
    expect(await broken.grants(null)).toBeNull();
    const down = createCenter({
      url: 'https://api.center.test',
      product: 'prd_x',
      source: 'x',
      fetch: (async () => {
        throw new Error('down');
      }) as unknown as typeof fetch,
    });
    expect(await down.grants('token')).toBeNull();
    await expect(down.sendTask('token', { key: 'k', title: 't', href: 'h' })).resolves.toBe(
      undefined,
    );
  });

  it('puts a task in her To do, named after the app', async () => {
    const { calls, fetcher } = fakeFetch(() => Response.json({ ok: true }));
    const center = createCenter({
      url: 'https://api.center.test',
      product: 'prd_kete_helpdesk',
      source: 'kete-helpdesk',
      fetch: fetcher,
    });
    await center.sendTask('token', { key: 'TKT-1', title: 'Rétablir', href: 'https://x/t/1' });
    expect(calls[0]?.url).toBe('https://api.center.test/v1/workspace/tasks');
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      key: 'TKT-1',
      source: 'kete-helpdesk',
    });
  });
});
