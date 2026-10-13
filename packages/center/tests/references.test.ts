import { validateMoneyFact } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { createCenter, moneyFactBody, type MoneyFact } from '../src/index.js';

// Spec 096 (doctrine D-047, D-049): an app cites the center's references — third parties,
// projects — by their identifier, with the person's token, and says its facts of money in the
// contract's shape. Without a center it goes on alone.

function fake(answers: Record<string, () => Response>) {
  const calls: { url: string; method: string; body: unknown; token: string | null }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
      token: new Headers(init?.headers).get('authorization'),
    });
    const path = new URL(url).pathname;
    return (answers[path] ?? (() => Response.json({ error: 'not_found' }, { status: 404 })))();
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const hotel = {
  partyId: 'pty_0000-a07e1',
  kind: 'company',
  name: 'Hôtel du Golfe',
  roles: ['client', 'supplier'],
  email: null,
  phone: '+228 90 12 34 56',
  address: null,
  registration: null,
  channel: 'whatsapp',
  mergedFrom: ['pty_0000-2b1ce'],
};
const site = {
  projectId: 'prj_0000-51fe',
  name: 'Chantier Garage Bè',
  party: null,
  lead: { userId: 'usr_abla', name: 'Abla Nyuiadzi' },
  status: 'open',
  phase: 'Exécution',
  sold: 2_480_000,
  currency: 'XOF',
  team: [{ userId: 'usr_abla', name: 'Abla Nyuiadzi', lead: true }],
  posts: [{ postId: 'pst_1', name: 'Matériel', budget: 1_450_000 }],
  budget: 1_450_000,
};

const centerWith = (answers: Record<string, () => Response>) => {
  const { calls, fetcher } = fake(answers);
  const center = createCenter({
    url: 'https://api.center.test',
    product: 'prd_kete_gestion',
    source: 'Gestion',
    fetch: fetcher,
  });
  return { calls, center };
};

describe('the center’s references, as an app cites them', () => {
  it('reads a third party with her token, and follows a merged record', async () => {
    const { calls, center } = centerWith({
      '/v1/parties': () => Response.json({ parties: [hotel] }),
      '/v1/parties/pty_0000-2b1ce': () => Response.json({ party: hotel, facts: [] }),
    });
    expect(await center.parties('token', 'hôtel')).toEqual([hotel]);
    expect(calls[0]?.url).toBe('https://api.center.test/v1/parties?q=h%C3%B4tel');
    expect(calls[0]?.token).toBe('Bearer token');
    // The app kept the identifier of a record merged since: the one that stays answers.
    const followed = await center.party('token', 'pty_0000-2b1ce');
    expect(followed?.partyId).toBe('pty_0000-a07e1');
    expect(followed?.mergedFrom).toContain('pty_0000-2b1ce');
    // What she may not read is not there.
    expect(await center.party('token', 'pty_0000-5ec4e7')).toBeNull();
  });

  it('says what the app knows of a third party under its own name, and takes it back', async () => {
    const { calls, center } = centerWith({
      '/v1/parties/pty_0000-a07e1/facts': () => Response.json({ kept: true }, { status: 201 }),
      '/v1/parties/pty_0000-a07e1/facts/drop': () => Response.json({ dropped: true }),
    });
    await center.sayOfParty('token', 'pty_0000-a07e1', {
      key: 'F-0412',
      label: 'Facture F-0412 · 2 480 000 F',
      state: 'Due depuis 6 jours',
    });
    expect(calls[0]).toMatchObject({
      method: 'POST',
      body: { source: 'Gestion', key: 'F-0412', state: 'Due depuis 6 jours' },
    });
    await center.sayOfParty('token', 'pty_0000-a07e1', { key: 'F-0412', gone: true });
    expect(calls[1]).toMatchObject({ body: { source: 'Gestion', key: 'F-0412' } });
    expect(calls[1]?.url).toContain('/facts/drop');
  });

  it('reads her projects, and opens one from its own document once', async () => {
    const { calls, center } = centerWith({
      '/v1/projects': () => Response.json({ project: site, created: true }, { status: 201 }),
      '/v1/projects/mine': () => Response.json({ projectIds: [site.projectId] }),
      '/v1/projects/prj_0000-51fe': () => Response.json({ project: site }),
    });
    expect(await center.myProjectIds('token')).toEqual([site.projectId]);
    expect((await center.project('token', site.projectId))?.name).toBe('Chantier Garage Bè');
    expect(await center.project('token', 'prj_0000-0f4e4')).toBeNull();
    const opened = await center.openProject('token', {
      name: 'Chantier Garage Bè',
      reference: 'D-0081',
      sold: 2_480_000,
      posts: [{ name: 'Matériel', budget: 1_450_000 }],
    });
    expect(opened).toMatchObject({
      ok: true,
      created: true,
      project: { projectId: site.projectId },
    });
    // The app's own document is what makes it the same project when asked again.
    expect(calls.at(-1)?.body).toMatchObject({
      name: 'Chantier Garage Bè',
      bornFrom: { source: 'Gestion', ref: 'D-0081' },
      sold: 2_480_000,
    });
  });

  it('says a fact of money in the contract’s shape, with its project and its post', async () => {
    const { calls, center } = centerWith({
      '/v1/money/facts': () => Response.json({ kept: true }, { status: 201 }),
      '/v1/money/facts/drop': () => Response.json({ dropped: true }),
    });
    const fact: MoneyFact = {
      key: 'BC-0031',
      kind: 'committed',
      amount: 700_000,
      currency: 'XOF',
      occurredOn: '2026-10-09',
      label: 'Bon de commande BC-0031',
      projectId: 'prj_0000-51fe',
      post: 'Matériel',
      partyId: 'pty_0000-a07e1',
      href: 'https://gestion.kete.test/commandes/BC-0031',
    };
    expect(await center.sendMoneyFact('token', fact)).toEqual({ ok: true, error: null });
    const sent = calls[0]?.body as { source: string; fact: Record<string, unknown> };
    expect(sent.source).toBe('Gestion');
    expect(sent.fact).toEqual({
      key: 'BC-0031',
      kind: 'committed',
      amount: 700_000,
      currency: 'XOF',
      occurred_on: '2026-10-09',
      label: 'Bon de commande BC-0031',
      project_id: 'prj_0000-51fe',
      post: 'Matériel',
      party_id: 'pty_0000-a07e1',
      href: 'https://gestion.kete.test/commandes/BC-0031',
    });
    // What travels is the contract: the same body validates against it.
    expect(validateMoneyFact(sent.fact)).toMatchObject({ ok: true });
    await center.dropMoneyFact('token', 'BC-0031');
    expect(calls[1]).toMatchObject({ body: { source: 'Gestion', key: 'BC-0031' } });
  });

  it('refuses in its contract what is not a fact of money', () => {
    const base = moneyFactBody({
      key: 'F-1',
      kind: 'received',
      amount: 992_000,
      currency: 'XOF',
      occurredOn: '2026-10-01',
      label: 'Acompte',
    });
    expect(validateMoneyFact(base)).toMatchObject({ ok: true });
    // Without a project: the organization's own running.
    expect(base).not.toHaveProperty('project_id');
    expect(validateMoneyFact({ ...base, amount: 12.5 })).toMatchObject({ ok: false });
    expect(validateMoneyFact({ ...base, amount: -1 })).toMatchObject({ ok: false });
    expect(validateMoneyFact({ ...base, currency: 'cfa' })).toMatchObject({ ok: false });
    expect(validateMoneyFact({ ...base, kind: 'paid' })).toMatchObject({ ok: false });
    expect(validateMoneyFact({ ...base, occurred_on: '13/10/2026' })).toMatchObject({
      ok: false,
    });
    expect(validateMoneyFact({ ...base, project_id: 'Garage Bè' })).toMatchObject({ ok: false });
  });

  it('goes on alone without a center: nothing throws, nothing is found', async () => {
    const alone = createCenter({ url: null, product: 'prd_kete_gestion', source: 'Gestion' });
    expect(await alone.parties('token')).toEqual([]);
    expect(await alone.party('token', 'pty_0000-a07e1')).toBeNull();
    expect(await alone.projects('token')).toEqual([]);
    expect(await alone.myProjectIds('token')).toEqual([]);
    expect(await alone.openProject('token', { name: 'X', reference: 'D-1' })).toEqual({
      ok: false,
      error: 'not_connected',
    });
    expect(
      await alone.sendMoneyFact('token', {
        key: 'k',
        kind: 'spent',
        amount: 1,
        currency: 'XOF',
        occurredOn: '2026-10-13',
        label: 'x',
      }),
    ).toEqual({ ok: false, error: 'not_connected' });
    await alone.sayOfParty('token', 'pty_0000-a07e1', { key: 'k', label: 'x' });
    await alone.dropMoneyFact('token', 'k');
  });
});
