import { validateDatedFact } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { createCenter, datedFactBody } from '../src/index.js';

// Spec 102 (doctrine D-050): an app says what will happen at a time — in the contract's shape — so
// that the center's Planifier shows the time of the whole organization.

function centerWith(answers: Record<string, () => Response>) {
  const calls: { path: string; body: unknown }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    return (answers[path] ?? (() => Response.json({ error: 'not_found' }, { status: 404 })))();
  }) as unknown as typeof fetch;
  const center = createCenter({
    url: 'https://api.enterprise.test',
    product: 'prd_kete_team',
    source: 'kete-team',
    fetch: fetcher,
  });
  return { calls, center };
}

describe('the time an app says', () => {
  it('says a leave and a reception in the contract’s shape, and takes one back', async () => {
    const { calls, center } = centerWith({
      '/v1/time/facts': () => Response.json({ kept: true }, { status: 201 }),
      '/v1/time/facts/drop': () => Response.json({ dropped: true }),
    });
    expect(
      await center.sendDatedFact('token', {
        key: 'leave-kossi',
        kind: 'absence',
        label: 'Congé',
        day: '2026-10-15',
        until: '2026-10-16',
        personIds: ['usr_kossi'],
      }),
    ).toEqual({ ok: true, error: null });
    expect(
      await center.sendDatedFact('token', {
        key: 'reception',
        kind: 'task',
        label: 'Réception du matériel',
        startsAt: '2026-10-16T10:00:00Z',
        endsAt: '2026-10-16T11:00:00Z',
        personIds: ['usr_kossi'],
        projectId: 'prj_0000-51fe',
        href: 'https://team.kete.test/taches/reception',
      }),
    ).toEqual({ ok: true, error: null });
    const [leave, reception] = calls.map((c) => c.body as { source: string; fact: object });
    expect(leave).toEqual({
      source: 'kete-team',
      fact: {
        key: 'leave-kossi',
        kind: 'absence',
        label: 'Congé',
        day: '2026-10-15',
        until: '2026-10-16',
        person_ids: ['usr_kossi'],
      },
    });
    // What travels is the contract: the same bodies validate against it.
    expect(validateDatedFact(leave?.fact)).toMatchObject({ ok: true });
    expect(validateDatedFact(reception?.fact)).toMatchObject({ ok: true });
    await center.dropDatedFact('token', 'reception');
    expect(calls[2]).toEqual({
      path: '/v1/time/facts/drop',
      body: { source: 'kete-team', key: 'reception' },
    });
  });

  it('refuses in its contract a fact with both a day and a moment, or neither', () => {
    const both = datedFactBody({
      key: 'k',
      kind: 'meeting',
      label: 'Point',
      day: '2026-10-15',
      startsAt: '2026-10-15T09:00:00Z',
    });
    expect(validateDatedFact(both)).toMatchObject({ ok: false });
    expect(
      validateDatedFact(datedFactBody({ key: 'k', kind: 'deadline', label: 'É' })),
    ).toMatchObject({ ok: false });
  });

  it('goes on alone without a center, and says why it could not', async () => {
    const alone = createCenter({ url: null, product: 'prd_kete_team', source: 'kete-team' });
    const fact = { key: 'k', kind: 'deadline' as const, label: 'É', day: '2026-10-15' };
    expect(await alone.sendDatedFact('token', fact)).toEqual({ ok: false, error: 'not_connected' });
    await expect(alone.dropDatedFact('token', 'k')).resolves.toBeUndefined();
    const { center } = centerWith({});
    expect(await center.sendDatedFact(null, fact)).toEqual({ ok: false, error: 'signed_out' });
    expect(await center.sendDatedFact('token', fact)).toEqual({ ok: false, error: 'not_found' });
  });
});
