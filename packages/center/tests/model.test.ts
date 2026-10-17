import { validateHolding } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { createCenter, holdingBody, type AppHolding } from '../src/index.js';

// Kete-core spec 114: an app says what it holds and passes its gestures through the policies.

function fakeFetch(answer: () => Response) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return answer();
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const invoice: AppHolding = {
  kind: 'invoice',
  ref: 'F-2026-0003',
  object: { kind: 'project', id: 'prj_garage_be' },
  what: 'Encaisser la facture F-2026-0003',
  holder: { kind: 'person', id: 'usr_abla' },
  waitingOn: { kind: 'party', id: 'pty_garage_be' },
  due: '2026-10-30',
  state: 'waiting',
  href: 'https://finance.example/sales/invoice?id=F-2026-0003',
};

describe('what the app holds', () => {
  it('is said in the contract’s shape, under the app’s source', () => {
    const body = holdingBody('prd_kete_finance', invoice);
    expect(validateHolding(body)).toMatchObject({ ok: true });
    expect(body).toMatchObject({
      source: { app: 'prd_kete_finance', kind: 'invoice', ref: 'F-2026-0003' },
      waiting_on: { kind: 'party', id: 'pty_garage_be' },
    });
    expect(
      (holdingBody('prd_x', { ...invoice, what: 'x'.repeat(400) }).what as string).length,
    ).toBe(300);
  });

  it('goes all at once with the app’s own token, and says what moved', async () => {
    const { calls, fetcher } = fakeFetch(() => Response.json({ said: 1, finished: 2 }));
    const center = createCenter({
      url: 'https://api.center.test',
      product: 'prd_kete_finance',
      source: 'kete-finance',
      fetch: fetcher,
    });
    expect(await center.sayHoldings('app-token', 'org_kya_demo', [invoice])).toEqual({
      ok: true,
      said: 1,
      finished: 2,
    });
    expect(calls[0]?.url).toBe('https://api.center.test/public/apps/holdings');
    expect(calls[0]?.init?.method).toBe('PUT');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe('Bearer app-token');
    const sent = JSON.parse(String(calls[0]?.init?.body)) as Record<string, unknown>;
    expect(sent).toMatchObject({ organization: 'org_kya_demo', product: 'prd_kete_finance' });
    expect(await center.sayHoldings(null, 'org_kya_demo', [])).toEqual({
      ok: false,
      error: 'signed_out',
    });
    const alone = createCenter({ url: '', product: 'prd_x', source: 'x' });
    expect(await alone.sayHoldings('t', 'org_kya_demo', [])).toEqual({
      ok: false,
      error: 'not_connected',
    });
  });
});

describe('a gesture through the policies', () => {
  it('reads the verdict, with the policies’ sentences and who approves', async () => {
    const { calls, fetcher } = fakeFetch(() =>
      Response.json({
        verdict: {
          effect: 'approve',
          policies: [{ id: 'spend.over-limit', sentence: 'Au-delà de 500 000 F…' }],
          approvers: [{ approver: 'manager', people: ['usr_abla', 42] }],
        },
      }),
    );
    const center = createCenter({
      url: 'https://api.center.test',
      product: 'prd_kete_finance',
      source: 'kete-finance',
      fetch: fetcher,
    });
    const verdict = await center.checkGesture('token', {
      kind: 'purchase.commit',
      object: { kind: 'project', id: 'prj_garage_be' },
      amount: { value: 700_000, currency: 'XOF' },
      context: { budgetLeft: 450_000 },
    });
    expect(calls[0]?.url).toBe('https://api.center.test/v1/apps/prd_kete_finance/gestures');
    expect(verdict).toEqual({
      effect: 'approve',
      policies: [{ id: 'spend.over-limit', sentence: 'Au-delà de 500 000 F…' }],
      approvers: [{ approver: 'manager', people: ['usr_abla'] }],
    });
  });

  it('is unruled without a center, a token or a readable answer: the app keeps its own rules', async () => {
    const gesture = { kind: 'contract.sign', object: { kind: 'project', id: 'prj_x' } };
    const alone = createCenter({ url: '', product: 'prd_x', source: 'x' });
    expect(await alone.checkGesture('t', gesture)).toMatchObject({
      effect: 'unruled',
      reason: 'not_connected',
    });
    const down = createCenter({
      url: 'https://api.center.test',
      product: 'prd_x',
      source: 'x',
      fetch: fakeFetch(() => new Response('nope', { status: 503 })).fetcher,
    });
    expect(await down.checkGesture('t', gesture)).toMatchObject({ reason: 'http_503' });
    expect(await down.checkGesture(null, gesture)).toMatchObject({ reason: 'signed_out' });
    const odd = createCenter({
      url: 'https://api.center.test',
      product: 'prd_x',
      source: 'x',
      fetch: fakeFetch(() => Response.json({ verdict: { effect: 'maybe' } })).fetcher,
    });
    expect(await odd.checkGesture('t', gesture)).toMatchObject({ reason: 'unreadable' });
  });
});
