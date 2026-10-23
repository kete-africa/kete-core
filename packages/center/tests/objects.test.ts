import { validateObject } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { createCenter, objectBody, type AppObject } from '../src/index.js';

// Kete-core spec 142: an app says its objects to the center's index; anyone reads them there with
// her own rights — by words, kind, axis or state — and one with its named links.

function fakeFetch(answer: () => Response) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return answer();
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const ticket: AppObject = {
  kind: 'ticket',
  id: 'T-0412',
  title: 'T-0412 · Onduleur 2 hors ligne',
  state: 'open',
  partyId: 'pty_0199a40000',
  unitId: 'unt_0199a40000',
  personId: 'usr_yao',
  links: [{ relation: 'concerns', kind: 'asset', id: 'ast_0199a4' }],
  updatedAt: '2026-10-23T09:12:00Z',
};

const center = (fetcher: typeof fetch) =>
  createCenter({
    url: 'https://api.center.test',
    product: 'prd_support',
    source: 'support',
    fetch: fetcher,
  });

describe('the objects an app says', () => {
  it('are said in the contract’s shape', () => {
    const body = objectBody(ticket);
    expect(validateObject(body).ok).toBe(true);
    expect(body).toMatchObject({ unit_id: 'unt_0199a40000', person_id: 'usr_yao' });
    expect(
      validateObject(objectBody({ kind: 'ticket', id: 'T-1', title: 'x', gone: true })).ok,
    ).toBe(true);
    const long = objectBody({ ...ticket, title: 'x'.repeat(260) });
    expect(String(long.title)).toHaveLength(200);
  });

  it('go to the center with the app’s own token, at most 500 at once', async () => {
    const { calls, fetcher } = fakeFetch(() => Response.json({ said: 1, gone: 0 }));
    expect(await center(fetcher).sayObjects('app-token', 'org_demo', [ticket])).toEqual({
      ok: true,
      said: 1,
      gone: 0,
    });
    expect(calls[0]?.url).toBe('https://api.center.test/public/apps/objects');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer app-token');
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      organization: 'org_demo',
      product: 'prd_support',
    });
    const many = Array.from({ length: 501 }, (_, i) => ({ ...ticket, id: `T-${i}` }));
    expect(await center(fetcher).sayObjects('app-token', 'org_demo', many)).toEqual({
      ok: false,
      error: 'too_many',
    });
    expect(await center(fetcher).sayObjects(null, 'org_demo', [])).toEqual({
      ok: false,
      error: 'signed_out',
    });
    const alone = createCenter({ url: '', product: 'prd_x', source: 'x' });
    expect(await alone.sayObjects('t', 'org_demo', [])).toEqual({
      ok: false,
      error: 'not_connected',
    });
  });
});

describe('the index, as she reads it', () => {
  it('finds by words, kind and axis, and answers nothing rather than throwing', async () => {
    const { calls, fetcher } = fakeFetch(() =>
      Response.json({ objects: [{ kind: 'ticket', id: 'T-0412', title: 'T-0412' }] }),
    );
    const found = await center(fetcher).objects('token', {
      q: 'onduleur',
      kind: 'ticket',
      unitId: 'unt_0199a40000',
      closed: true,
    });
    expect(found).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      'https://api.center.test/v1/objects?q=onduleur&kind=ticket&unit=unt_0199a40000&closed=true',
    );
    const refused = fakeFetch(() => new Response('{}', { status: 403 }));
    expect(await center(refused.fetcher).objects('token')).toEqual([]);
    expect(refused.calls[0]?.url).toBe('https://api.center.test/v1/objects');
    expect(await center(fetcher).objects(null)).toEqual([]);
  });

  it('reads one object with its links, and never asks for a kind that cannot be', async () => {
    const card = {
      object: { kind: 'asset', id: 'ast_0199a4', title: 'Mini-centrale' },
      links: [],
      threadId: 'thr_0199a4000000',
    };
    const { calls, fetcher } = fakeFetch(() => Response.json(card));
    expect(await center(fetcher).object('token', 'asset', 'ast_0199a4')).toEqual(card);
    expect(calls[0]?.url).toBe('https://api.center.test/v1/objects/asset/ast_0199a4');
    expect(await center(fetcher).object('token', '../admin', 'x')).toBeNull();
    expect(calls).toHaveLength(1);
  });
});
