import type { Actor } from '@kete/commands';
import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createFeedbackHandler,
  FeedbackButton,
  feedbackMigrationSql,
  listFeedback,
} from '../src/index.js';

let db: TestSchema;
const ama: Actor = { kind: 'person', id: 'usr_ama', channel: 'web' };

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(feedbackMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

const handler = (caller: { organizationId: string; actor: Actor } | null) =>
  createFeedbackHandler({
    caller: async () => caller,
    transaction: (organizationId, work) => inOrganization(db.app, organizationId, work),
  });

const post = (body: unknown) =>
  new Request('https://app.test/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('feedback', () => {
  it('is kept in the person’s organization, with the screen she was on and no query', async () => {
    const response = await handler({ organizationId: 'org_a', actor: ama })(
      post({ kind: 'problem', message: 'Le reçu ne s’imprime pas', page: '/caisse?ticket=42' }),
    );
    expect(response.status).toBe(201);
    const [kept] = await inOrganization(db.app, 'org_a', (tx) => listFeedback(tx));
    expect(kept).toMatchObject({
      kind: 'problem',
      message: 'Le reçu ne s’imprime pas',
      page: '/caisse',
      personId: 'usr_ama',
    });
  });

  it('refuses a stranger, an empty message and an agent', async () => {
    expect((await handler(null)(post({ kind: 'idea', message: 'x' }))).status).toBe(401);
    const asAma = handler({ organizationId: 'org_a', actor: ama });
    expect((await asAma(post({ kind: 'idea', message: ' ' }))).status).toBe(422);
    const agent: Actor = { kind: 'agent', id: 'agt_1', channel: 'mcp' };
    const asAgent = handler({ organizationId: 'org_a', actor: agent });
    expect((await asAgent(post({ kind: 'idea', message: 'x' }))).status).toBe(422);
  });

  it('stays in its organization (RLS)', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_feedback',
      organizations: ['org_a', 'org_b'],
      insert: async (client, organizationId) => {
        await client.query(
          `insert into kete_feedback (feedback_id, organization_id, person_id, kind, message)
           values ($1, $2, 'usr_x', 'idea', 'x')`,
          [`fbk_${organizationId}`, organizationId],
        );
      },
    });
  });

  it('has a button that says each kind, every word from the product', () => {
    const html = renderToStaticMarkup(
      <FeedbackButton
        labels={{
          open: 'Un avis ?',
          title: 'Votre avis',
          kinds: { problem: 'Un problème', idea: 'Une idée', praise: 'Ça marche bien' },
          kindsLabel: 'Type d’avis',
          message: 'Racontez-nous',
          send: 'Envoyer',
          close: 'Fermer',
          thanks: 'Merci !',
          error: 'Ça n’a pas marché.',
        }}
        onSubmit={async () => undefined}
      />,
    );
    expect(html).toContain('Un avis ?');
    for (const word of ['Un problème', 'Une idée', 'Ça marche bien', 'Racontez-nous']) {
      expect(html).toContain(word);
    }
  });
});
