import type { KeteIdentity } from '@kete/auth';
import { getDraft } from '@kete/drafts';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../db/migrations';
import { listTasks } from '../src/features/tasks/infrastructure/task.table';
import { taskInput } from '../src/features/tasks/task.record';
import { useModel } from '../src/platform/ai';
import { transaction, usePool } from '../src/platform/db';
import { readIntoDraft } from '../src/platform/intake';
import { registry } from '../src/platform/registry';
import { asPerson } from '../src/platform/rights';
import { screenActor } from '../src/platform/session';

// kete-core spec 098 — intake, on the template: a photo becomes a draft whose every field says
// where it comes from; the person corrects it and validates it, and her correction is kept.

const ORG = 'org_intake';
let db: TestSchema;
const ama: KeteIdentity = {
  userId: 'usr_ama',
  email: 'usr_ama@example.test',
  name: 'Ama',
  organizationId: ORG,
  role: 'owner',
  apps: {},
  twoFactor: false,
  expiresAt: new Date(Date.now() + 60_000),
};
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const answering = (answer: Record<string, unknown>) =>
  new MockLanguageModelV4({
    doGenerate: {
      content: [{ type: 'text', text: JSON.stringify(answer) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
    },
  });
const photo = {
  kind: 'photo' as const,
  data: new Uint8Array([0xff, 0xd8]),
  contentType: 'image/jpeg',
};

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, context) => {
      for (const migration of migrations) await owner.query(migration.sql(context));
    },
  });
  usePool(db.app);
});

afterAll(async () => {
  useModel(undefined);
  await db.drop();
});

describe('a photo becomes a draft with the provenance of each field', () => {
  it('prepares the draft, every value with its source, certainty and passage — nothing written yet', async () => {
    useModel(
      answering({
        title: {
          found: true,
          value: 'Rappeler Efua',
          quote: 'rappeler Efua !',
          certainty: 'medium',
        },
        dueOn: { found: true, value: '2026-10-16', quote: 'vendredi 16/10', certainty: 'high' },
      }),
    );
    const read = await asPerson(ama, () =>
      readIntoDraft({
        identity: ama,
        capability: 'tasks_create',
        schema: taskInput,
        source: photo,
        context: 'A task: what is to be done, and by when.',
        evidence: 'fil_note_1',
      }),
    );
    expect(read).toMatchObject({ status: 'draft' });
    const draftId = read.status === 'draft' ? read.draftId : '';
    const draft = await transaction(ORG, (tx) => getDraft(tx, draftId));
    expect(draft?.provenance).toEqual({
      title: {
        source: 'photo',
        by: { kind: 'agent', id: 'agt_intake' },
        certainty: 'medium',
        quote: 'rappeler Efua !',
        evidence: 'fil_note_1',
      },
      dueOn: {
        source: 'photo',
        by: { kind: 'agent', id: 'agt_intake' },
        certainty: 'high',
        quote: 'vendredi 16/10',
        evidence: 'fil_note_1',
      },
    });
    expect(await transaction(ORG, (tx) => listTasks(tx))).toEqual([]);

    // She corrects the title and validates: the task is written, her correction kept.
    const decided = await asPerson(ama, () =>
      registry.decide({
        actor: screenActor(ama),
        organizationId: ORG,
        draftId,
        action: 'validate',
        confirmed: false,
        corrections: { title: 'Rappeler Efua pour le devis' },
      }),
    );
    expect(decided).toMatchObject({ status: 'validated' });
    const kept = await transaction(ORG, (tx) => getDraft(tx, draftId));
    expect(kept?.corrections).toEqual({
      title: { prepared: 'Rappeler Efua', validated: 'Rappeler Efua pour le devis' },
    });
    const [task] = await transaction(ORG, (tx) => listTasks(tx));
    expect(task).toMatchObject({ title: 'Rappeler Efua pour le devis', dueOn: '2026-10-16' });
  });

  it('asks her for what the photo does not give, and prepares nothing', async () => {
    useModel(
      answering({
        title: { found: false, value: null, quote: null, certainty: 'low' },
        dueOn: { found: true, value: '2026-10-20', quote: '20/10', certainty: 'high' },
      }),
    );
    expect(
      await asPerson(ama, () =>
        readIntoDraft({
          identity: ama,
          capability: 'tasks_create',
          schema: taskInput,
          source: photo,
        }),
      ),
    ).toEqual({ status: 'incomplete', missing: ['title'] });
  });

  it('says it is not connected without a model', async () => {
    useModel(null);
    expect(
      await asPerson(ama, () =>
        readIntoDraft({
          identity: ama,
          capability: 'tasks_create',
          schema: taskInput,
          source: photo,
        }),
      ),
    ).toEqual({ status: 'not_connected' });
  });
});
