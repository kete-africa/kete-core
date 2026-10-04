import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hostedShell } from '@kete/ai';
import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { MockLanguageModelV4 } from 'ai/test';
import { strToU8, zipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  evaluateSkill,
  inlineSkills,
  listSkills,
  parseSkill,
  readSkillArchive,
  readSkillsDirectory,
  readStoredSkill,
  saveSkill,
  skillArchive,
  SkillError,
  skillFromText,
  skillsCatalog,
  skillsFor,
  skillsMigrationSql,
  skillTools,
  skillVersion,
  skillVersions,
  updateSkill,
} from '../src/index.js';

// Spec 054: Agent Skills folders read and validated by the standard, versioned in Postgres,
// offered to a model progressively, carried to a provider's sandbox, checked by their own cases.

const tone = skillFromText({
  'SKILL.md': `---
name: courrier-client
description: Rédige un courrier à un client de l'entreprise, au ton maison. À utiliser pour toute lettre ou tout e-mail à un client.
metadata:
  author: kya
  version: "1.0"
---
# Courrier client

1. Vouvoyer, phrases courtes.
2. Lire [le ton](references/ton.md) avant d'écrire.

---

Signer « Le service client ».`,
  'references/ton.md': 'Chaleureux, précis, jamais familier.',
  'evals/evals.json': JSON.stringify({
    skill_name: 'courrier-client',
    evals: [
      {
        id: 1,
        prompt: 'Écris au client Mensah pour son retard de livraison.',
        expectations: ['Vouvoie le client', 'Signe « Le service client »'],
      },
    ],
  }),
});

/** A tool of the set, run as the model would call it. */
const run = (tools: ReturnType<typeof skillTools>, name: string, input: unknown) =>
  (tools[name]?.execute as (input: unknown, options: unknown) => Promise<unknown>)(input, {
    toolCallId: 'call',
    messages: [],
  });

describe('reading skills', () => {
  it('reads a skill by the standard, its instructions whole', () => {
    expect(tone).toMatchObject({
      name: 'courrier-client',
      metadata: { author: 'kya', version: '1.0' },
    });
    expect(tone.instructions).toContain('Signer « Le service client ».');
    expect(tone.files.map((f) => f.path)).toEqual([
      'evals/evals.json',
      'references/ton.md',
      'SKILL.md',
    ]);
  });

  it('refuses what the standard refuses, saying every problem', () => {
    const bad = () =>
      skillFromText({ 'SKILL.md': '---\nname: Courrier--Client\nauthor: moi\n---\nCorps' });
    expect(bad).toThrow(SkillError);
    try {
      bad();
    } catch (error) {
      expect((error as SkillError).problems.join(' ')).toMatch(/lowercase|consecutive/);
      expect((error as SkillError).problems.join(' ')).toMatch(/description/);
      expect((error as SkillError).problems.join(' ')).toMatch(/Unexpected fields/);
    }
    expect(() => skillFromText({ 'README.md': 'x' })).toThrow(/SKILL.md/);
    expect(() => parseSkill([{ path: '../SKILL.md', data: strToU8('x') }])).toThrow(
      /Invalid file path/,
    );
    expect(() =>
      parseSkill([{ path: 'SKILL.md', data: strToU8('---\nname: a\ndescription: b\n---\n') }], {
        folder: 'other',
      }),
    ).toThrow(/must match/);
  });

  it('goes to a .zip and back, the same content always the same version', () => {
    const archive = skillArchive(tone);
    const [back] = readSkillArchive(archive);
    expect(back).toEqual(tone);
    expect(skillVersion(back as never)).toBe(skillVersion(tone));
    const edited = skillFromText({
      'SKILL.md': `---\nname: courrier-client\ndescription: ${tone.description}\n---\nAutre corps`,
    });
    expect(skillVersion(edited)).not.toBe(skillVersion(tone));
    // A skill at the root of the archive, as some tools export it.
    const root = zipSync({
      'SKILL.md': strToU8('---\nname: seul\ndescription: Un seul.\n---\nOk'),
    });
    expect(readSkillArchive(root).map((s) => s.name)).toEqual(['seul']);
    expect(() => readSkillArchive(strToU8('not a zip'))).toThrow(SkillError);
  });

  it("reads a product's own skills from its folder", async () => {
    const dir = await mkdtemp(join(tmpdir(), 'skills-'));
    try {
      await mkdir(join(dir, 'resume', 'references'), { recursive: true });
      await writeFile(
        join(dir, 'resume', 'SKILL.md'),
        '---\nname: resume\ndescription: Résume en points.\n---\nTrois points au plus.',
      );
      await writeFile(join(dir, 'resume', 'references', 'exemple.md'), 'Exemple');
      const [skill] = await readSkillsDirectory(dir);
      expect(skill?.files.map((f) => f.path)).toEqual(['references/exemple.md', 'SKILL.md']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('a model reading skills', () => {
  it('sees names and descriptions first, then loads one, then reads a file', async () => {
    const catalog = skillsCatalog([tone]);
    expect(catalog).toContain('<name>courrier-client</name>');
    expect(catalog).not.toContain('Vouvoyer');
    const used: string[] = [];
    const tools = skillTools([tone], { onLoad: (s) => used.push(s.name) });
    const loaded = await run(tools, 'skill_load', { name: 'courrier-client' });
    expect(loaded).toMatchObject({
      instructions: expect.stringContaining('Vouvoyer'),
      files: ['evals/evals.json', 'references/ton.md'],
    });
    expect(used).toEqual(['courrier-client']);
    expect(
      await run(tools, 'skill_read', { name: 'courrier-client', path: 'references/ton.md' }),
    ).toEqual({ path: 'references/ton.md', text: 'Chaleureux, précis, jamais familier.' });
    expect(
      await run(tools, 'skill_read', { name: 'courrier-client', path: 'references/x.md' }),
    ).toMatchObject({ error: expect.stringContaining('No text file') });
    expect(skillTools([])).toEqual({});
  });

  it("carries skills with scripts to the provider's sandbox, its network off", () => {
    const withScript = skillFromText({
      'SKILL.md':
        '---\nname: tableau-excel\ndescription: Produit un classeur Excel.\n---\nLancer scripts/build.py',
      'scripts/build.py': 'print("ok")',
    });
    const inline = inlineSkills([tone, withScript]);
    expect(inline.map((s) => s.name)).toEqual(['tableau-excel']);
    const shell = hostedShell(
      { provider: 'openai', model: 'gpt-test', apiKey: 'test' },
      { skills: inline },
    );
    expect(shell && Object.keys(shell)).toEqual(['shell']);
    const args = JSON.stringify((shell?.shell as { args?: unknown }).args);
    expect(args).toContain('"networkPolicy":{"type":"disabled"}');
    expect(args).toContain('"name":"tableau-excel"');
    expect(
      hostedShell({ provider: 'deepseek', model: 'deepseek-chat', apiKey: 'test' }),
    ).toBeNull();
  });

  it("checks a skill against its own cases, the judge's verdict per expectation", async () => {
    const usage = {
      inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 5, text: 5, reasoning: 0 },
    };
    const stop = { unified: 'stop' as const, raw: 'stop' };
    let step = 0;
    const model = new MockLanguageModelV4({
      doGenerate: async () =>
        step++ === 0
          ? {
              content: [
                {
                  type: 'tool-call',
                  toolCallId: 't1',
                  toolName: 'skill_load',
                  input: '{"name":"courrier-client"}',
                },
              ],
              finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
              usage,
              warnings: [],
            }
          : {
              content: [{ type: 'text', text: 'Monsieur, nous vous prions… Le service client' }],
              finishReason: stop,
              usage,
              warnings: [],
            },
    });
    const judge = new MockLanguageModelV4({
      doGenerate: {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verdicts: [
                { expectation: 'Vouvoie le client', met: true, reason: 'Vous.' },
                { expectation: 'Signe', met: true, reason: 'Signé.' },
              ],
            }),
          },
        ],
        finishReason: stop,
        usage,
        warnings: [],
      },
    });
    const report = await evaluateSkill({ skill: tone, model, judge });
    expect(report).toMatchObject({ passed: 1, total: 1 });
    expect(report.cases[0]).toMatchObject({ loaded: true, passed: true });
  });
});

describe('skills kept by an organization', () => {
  let db: TestSchema;
  const as = <T>(organizationId: string, fn: Parameters<typeof inOrganization<T>>[2]) =>
    inOrganization(db.app, organizationId, fn);

  beforeAll(async () => {
    db = await createTestSchema({
      migrate: async (owner, { schema, appRole }) => {
        await owner.query(skillsMigrationSql({ schema, appRole }));
      },
    });
  });

  afterAll(async () => {
    await db?.drop();
  });

  it('keeps each version once, the latest current, and brings an older one back', async () => {
    const first = await as('org_kya', (c) =>
      saveSkill(c, {
        organizationId: 'org_kya',
        skill: tone,
        by: 'usr_ama',
        audience: ['user:usr_ama'],
      }),
    );
    expect(first).toMatchObject({ created: true, newVersion: true });
    const again = await as('org_kya', (c) =>
      saveSkill(c, { organizationId: 'org_kya', skill: tone, by: 'usr_ama' }),
    );
    expect(again).toMatchObject({ created: false, newVersion: false });
    const edited = skillFromText({
      'SKILL.md': `---\nname: courrier-client\ndescription: Courrier client, version 2.\n---\nTutoyer jamais.`,
    });
    const second = await as('org_kya', (c) =>
      saveSkill(c, {
        organizationId: 'org_kya',
        skill: edited,
        by: 'usr_kofi',
        note: 'Plus court',
      }),
    );
    expect(second.skill).toMatchObject({
      version: skillVersion(edited),
      description: 'Courrier client, version 2.',
      audience: ['user:usr_ama'],
    });
    const skillId = first.skill.skillId;
    const versions = await as('org_kya', (c) => skillVersions(c, skillId));
    expect(versions.map((v) => v.current)).toEqual([true, false]);
    await as('org_kya', (c) => updateSkill(c, skillId, { version: skillVersion(tone) }));
    expect((await as('org_kya', (c) => readStoredSkill(c, skillId)))?.instructions).toContain(
      'Vouvoyer',
    );
  });

  it('gives each reader the skills opened to her, enabled', async () => {
    const [stored] = await as('org_kya', (c) => listSkills(c));
    const skillId = stored?.skillId as string;
    expect(await as('org_kya', (c) => skillsFor(c, ['everyone', 'user:usr_kofi']))).toEqual([]);
    expect(
      (await as('org_kya', (c) => skillsFor(c, ['everyone', 'user:usr_ama']))).map((s) => s.name),
    ).toEqual(['courrier-client']);
    await as('org_kya', (c) => updateSkill(c, skillId, { audience: ['everyone'] }));
    expect(await as('org_kya', (c) => skillsFor(c, ['everyone', 'user:usr_kofi']))).toHaveLength(1);
    await as('org_kya', (c) => updateSkill(c, skillId, { enabled: false }));
    expect(await as('org_kya', (c) => skillsFor(c, ['everyone']))).toEqual([]);
    expect(await as('org_kya', (c) => listSkills(c, { readerKeys: ['everyone'] }))).toHaveLength(1);
    expect(await as('org_kya', (c) => listSkills(c, { enabledOnly: true }))).toEqual([]);
    await expect(
      as('org_kya', (c) => updateSkill(c, skillId, { version: 'nope' })),
    ).rejects.toThrow(SkillError);
  });

  it('keeps each organization to its own skills', async () => {
    expect(await as('org_other', (c) => listSkills(c))).toEqual([]);
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_skills',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (client, organization) => {
        await saveSkill(client, { organizationId: organization, skill: tone, by: 'usr_x' });
      },
    });
  });
});
