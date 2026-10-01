import type { KeteIdentity } from '@kete/auth';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminError, adminErrorResponse, AuditLog, createOperatorGuard } from '../src/index.js';

const operator: KeteIdentity = {
  userId: 'usr_ama',
  email: 'ama@kete.africa',
  name: 'Ama',
  organizationId: 'org_kete',
  role: 'owner',
  apps: {},
  twoFactor: true,
  expiresAt: new Date(Date.now() + 60_000),
};

const tokens: Record<string, KeteIdentity> = {
  operator,
  member: { ...operator, role: 'member' },
  weak: { ...operator, twoFactor: false },
  client: { ...operator, organizationId: 'org_client' },
  former: { ...operator, userId: 'usr_former' },
};

const guard = createOperatorGuard({
  async verify(token) {
    const identity = tokens[token];
    if (!identity) throw new Error('invalid');
    return identity;
  },
  operatorsOrganizationId: () => 'org_kete',
  stillOperator: async (userId) => userId !== 'usr_former',
});

const request = (token?: string) =>
  new Request('https://app.test/api/admin', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

async function refusal(token?: string): Promise<{ status: number; code: string }> {
  try {
    await guard.requireOperator(request(token));
    return { status: 200, code: 'ok' };
  } catch (error) {
    const { status, code } = error as AdminError;
    return { status, code };
  }
}

describe('who is a Kete operator', () => {
  it('an owner or admin of Kete’s organization, signing in strongly, and still one now', async () => {
    await expect(guard.requireOperator(request('operator'))).resolves.toMatchObject({
      userId: 'usr_ama',
    });
  });

  it('nobody else, each refusal saying why', async () => {
    expect(await refusal()).toEqual({ status: 401, code: 'unauthenticated' });
    expect(await refusal('forged')).toEqual({ status: 401, code: 'invalid_token' });
    for (const token of ['member', 'weak', 'client', 'former']) {
      expect(await refusal(token)).toEqual({ status: 403, code: 'not_an_operator' });
    }
  });

  it('nobody at all when Kete’s organization is not configured', async () => {
    const closed = createOperatorGuard({
      verify: async () => operator,
      operatorsOrganizationId: () => null,
    });
    await expect(closed.requireOperator(request('operator'))).rejects.toBeInstanceOf(AdminError);
  });

  it('answers a refusal with its status and code, and lets other errors through', async () => {
    const response = adminErrorResponse(new AdminError(403, 'not_an_operator'));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toEqual({ error: 'not_an_operator' });
    expect(adminErrorResponse(new Error('boom'))).toBeNull();
  });
});

describe('the audit', () => {
  it('says when, who and for whom, through what, and what was done', () => {
    const html = renderToStaticMarkup(
      <AuditLog
        entries={[
          {
            commandId: 'cmd_1',
            name: 'set-offer',
            summary: 'Offre nettio, 30 jours',
            reason: null,
            actor: { kind: 'agent', id: 'agt_1' },
            onBehalfOf: { kind: 'person', id: 'usr_ama' },
            channel: 'mcp',
            reversible: true,
            inverse: 'disable-offer',
            createdAt: new Date('2026-10-01T09:00:00Z'),
          },
        ]}
        labels={{
          title: 'Journal',
          when: 'Quand',
          who: 'Qui',
          what: 'Quoi',
          channel: 'Par',
          onBehalfOf: (name) => `pour ${name}`,
          reversible: 'Réversible',
          empty: 'Rien encore.',
        }}
        nameOf={(actor) => (actor.id === 'usr_ama' ? 'Ama' : 'Agent commercial')}
        formatDate={(date) => date.toISOString().slice(0, 10)}
      />,
    );
    expect(html).toContain('Agent commercial');
    expect(html).toContain('pour Ama');
    expect(html).toContain('Offre nettio, 30 jours');
    expect(html).toContain('2026-10-01');
    expect(html).toContain('<th scope="col"');
  });
});
