import { holdingBody } from '@kete/center';
import { validateHolding } from '@kete/sdk';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { migrations } from '../db/migrations';
import { taskHoldings } from '../src/features/tasks';
import { transaction, usePool } from '../src/platform/db';
import { passGesture, sentencesOf } from '../src/platform/policies';
import { settingRows, settingsFrom } from '../src/platform/settings';

// Kete-core spec 114: the app says what it holds to its center and passes its gestures through
// the organization's policies.

let db: TestSchema;
const calls: { url: string; body: unknown }[] = [];

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, context) => {
      for (const migration of migrations) await owner.query(migration.sql(context));
    },
  });
  usePool(db.app);
  process.env.PUBLIC_URL = 'https://app.test';
  process.env.ENTERPRISE_API_URL = 'https://center.test';
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body ?? 'null')) });
    return Response.json({
      verdict: {
        effect: 'refuse',
        policies: [{ id: 'tasks.agents', sentence: 'Un agent ne clôt jamais une tâche' }],
        approvers: [],
      },
    });
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.drop();
});

describe('what the app holds', () => {
  it('says each open task, held by who wrote it, in the contract’s shape', async () => {
    const holdings = await transaction('org_acme', async (tx) => {
      await tx.query(
        `insert into tasks (task_id, organization_id, title, due_on, created_by)
         values ('tsk_model_1', 'org_acme', 'Relancer Garage Bè', '2026-10-30', 'usr_ama'),
                ('tsk_model_2', 'org_acme', 'Déjà fait', null, 'usr_ama')`,
      );
      await tx.query(`update tasks set status = 'done' where task_id = 'tsk_model_2'`);
      return taskHoldings(tx);
    });
    expect(holdings).toHaveLength(1);
    expect(holdings[0]).toMatchObject({
      ref: 'tsk_model_1',
      holder: { kind: 'person', id: 'usr_ama' },
      due: '2026-10-30',
      href: 'https://app.test/taches/tsk_model_1',
    });
    expect(validateHolding(holdingBody('prd_app', holdings[0] as never))).toMatchObject({
      ok: true,
    });
  });
});

describe('a gesture through the policies', () => {
  it('is asked for the person’s agent, and its refusal says the policy’s sentence', async () => {
    const verdict = await passGesture(
      'token',
      { kind: 'agent', id: 'agt_mcp' },
      { kind: 'card.decide', object: { kind: 'card', id: 'tsk_model_1' } },
    );
    expect(calls.at(-1)).toMatchObject({
      url: expect.stringContaining('/gestures'),
      body: { kind: 'card.decide', agent: { id: 'agt_mcp' } },
    });
    expect(verdict.effect).toBe('refuse');
    expect(sentencesOf(verdict)).toBe('Un agent ne clôt jamais une tâche');
  });
});

describe('the app’s settings (spec 115)', () => {
  it('gather the Compte Kete’s layers, the app’s and the device’s, the most precise winning', () => {
    const settings = settingsFrom({
      account: {
        organization: { 'kete.locale': 'fr', 'kete.currency': 'XOF' },
        person: { 'kete.locale': 'en' },
      },
      app: { 'kete.currency': 'GHS' },
      cookie: 'kete_theme=dark; other=1',
    });
    expect(settings.value('kete.locale')).toBe('en');
    expect(settings.from('kete.locale')).toBe('person');
    expect(settings.value('kete.currency')).toBe('GHS');
    expect(settings.value('kete.theme')).toBe('dark');
    expect(settings.from('kete.theme')).toBe('device');
    expect(settingsFrom({ account: { organization: {}, person: {} } }).from('kete.theme')).toBe(
      'kete',
    );
  });

  it('let the theme she chose in another app win over this device’s old copy', () => {
    const settings = settingsFrom({
      account: { organization: {}, person: { 'kete.theme': 'light' } },
      cookie: 'kete_theme=dark',
    });
    expect(settings.value('kete.theme')).toBe('light');
    expect(settings.from('kete.theme')).toBe('person');
  });

  it('say, on « Réglages », who sets each one here: she her preferences, an admin the app’s', () => {
    const resolved = settingsFrom({
      account: { organization: { 'kete.currency': 'XOF' }, person: { 'kete.theme': 'dark' } },
    });
    const row = (rows: ReturnType<typeof settingRows>, key: string) =>
      rows.find((r) => r.key === key);
    const admin = settingRows(resolved, { lang: 'fr', personal: true, manage: true });
    expect(row(admin, 'kete.theme')).toMatchObject({
      label: 'Thème',
      value: 'dark',
      from: 'person',
      editable: 'person',
      choices: { dark: 'Sombre' },
    });
    expect(row(admin, 'kete.currency')).toMatchObject({ from: 'organization', editable: 'app' });
    // The organization's identity is set in the Compte Kete, never here.
    expect(row(admin, 'kete.company_name')?.editable).toBeUndefined();
    const member = settingRows(resolved, { lang: 'en', personal: false, manage: false });
    expect(row(member, 'kete.theme')).toMatchObject({ label: 'Theme' });
    expect(row(member, 'kete.theme')?.editable).toBeUndefined();
    expect(row(member, 'kete.currency')?.editable).toBeUndefined();
  });
});
