import { describe, expect, it } from 'vitest';
import { createStandingMandates } from '../src/index.js';

// Spec 150: the center's side of a standing mandate — given once with her token, asked at each
// use, withdrawn; nothing when the Compte Kete refuses or does not answer.

const calls: { url: string; body: unknown; auth: string | null }[] = [];
const answers: Record<string, Response> = {};
const fetchStub = (async (url: string, init: RequestInit) => {
  calls.push({
    url,
    body: JSON.parse(String(init.body)),
    auth: new Headers(init.headers).get('authorization'),
  });
  const path = new URL(url).pathname;
  return answers[path]?.clone() ?? new Response(null, { status: 404 });
}) as unknown as typeof fetch;

const mandates = (token: string | null = 'center-token') =>
  createStandingMandates({
    accountUrl: 'https://compte.kete.test/',
    appToken: async () => token,
    fetch: fetchStub,
  });

describe('a standing mandate, from the center', () => {
  it('is given with her token, used with its grant, and withdrawn', async () => {
    answers['/api/apps/standing-mandates'] = Response.json({ grant: 'smd_1' }, { status: 201 });
    answers['/api/apps/standing-mandates/token'] = Response.json(
      { token: 'mandate', expiresIn: 600 },
      { status: 201 },
    );
    answers['/api/apps/standing-mandates/revoke'] = new Response(null, { status: 204 });
    const m = mandates();
    expect(await m.grant('her-token', { id: 'agt_parc', name: 'Agent Parc' })).toBe('smd_1');
    expect(await m.token('org_kya1', 'smd_1')).toBe('mandate');
    expect(await m.revoke('org_kya1', 'smd_1')).toBe(true);
    expect(calls.map((c) => [new URL(c.url).pathname, c.body, c.auth])).toEqual([
      [
        '/api/apps/standing-mandates',
        { subjectToken: 'her-token', agent: { id: 'agt_parc', name: 'Agent Parc' } },
        'Bearer center-token',
      ],
      [
        '/api/apps/standing-mandates/token',
        { organization: 'org_kya1', grant: 'smd_1' },
        'Bearer center-token',
      ],
      [
        '/api/apps/standing-mandates/revoke',
        { organization: 'org_kya1', grant: 'smd_1' },
        'Bearer center-token',
      ],
    ]);
  });

  it('gives nothing when refused, or without the center’s own token', async () => {
    answers['/api/apps/standing-mandates/token'] = Response.json(
      { error: 'no_mandate' },
      { status: 404 },
    );
    expect(await mandates().token('org_kya1', 'smd_gone')).toBeNull();
    calls.length = 0;
    expect(await mandates(null).grant('her-token', { id: 'agt_x', name: 'X' })).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
