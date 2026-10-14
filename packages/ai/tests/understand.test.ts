import { validateProposalSet } from '@kete/sdk';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { understand, type GestureOffer, type KnownObject } from '../src/index.js';

// Spec 104 — Afi's evening, said in a voice note: « J'ai fini le devis de la Pharmacie. Rappelle-moi
// Ecobank jeudi. Pas eu le temps pour le rapport, on verra lundi. Et appelle le cousin de Kossi. »
// The model is played; what is tested is what Kete keeps of its reading.

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function reading(answer: unknown) {
  const shown: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      shown.push(JSON.stringify(options.prompt));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(answer) }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage,
        warnings: [],
      };
    },
  });
  return { model, shown };
}

const known: KnownObject[] = [
  { key: 'tsk_quote', kind: 'task', label: 'Devis Pharmacie du Port' },
  { key: 'tsk_report', kind: 'task', label: 'Rapport au Fonds Énergie Rurale', due: '2026-10-30' },
];
const offers: GestureOffer[] = [
  {
    gesture: 'close',
    describe: 'close a task she says is done',
    level: 2,
    capability: 'tasks_complete',
    inputOf: ({ object }) => ({ taskId: object?.key }),
  },
  {
    gesture: 'postpone',
    describe: 'move a task to a later day',
    level: 2,
    capability: 'tasks_postpone',
    inputOf: ({ object, day }) => ({ taskId: object?.key, dueOn: day }),
  },
  { gesture: 'remind', describe: 'remind her of something on a day', level: 1, needsObject: false },
  { gesture: 'correct', describe: 'correct a record', level: 3, capability: 'tasks_rename' },
];
const note =
  "J'ai fini le devis de la Pharmacie. Rappelle-moi Ecobank jeudi. Pas eu le temps pour le rapport, on verra lundi. Et appelle le cousin de Kossi.";

describe('a note becomes gestures proposed to her', () => {
  it('keeps the gestures offered on the objects she has, their level and capability from the app', async () => {
    const { model, shown } = reading({
      items: [
        {
          gesture: 'close',
          object: 'tsk_quote',
          day: null,
          label: 'Clore « Devis Pharmacie du Port »',
          reason: "J'ai fini le devis de la Pharmacie.",
        },
        {
          gesture: 'remind',
          object: null,
          day: '2026-10-15',
          label: 'Vous rappeler Ecobank jeudi',
          reason: 'Rappelle-moi Ecobank jeudi.',
        },
        {
          gesture: 'postpone',
          object: 'tsk_report',
          day: '2026-10-19',
          label: 'Reporter le rapport au Fonds à lundi',
          reason: 'on verra lundi',
        },
        // A task she does not have, a gesture not offered, a gesture that needs an object without one.
        {
          gesture: 'close',
          object: 'tsk_ghost',
          day: null,
          label: 'Clore une tâche inventée',
          reason: null,
        },
        {
          gesture: 'assign',
          object: 'tsk_report',
          day: null,
          label: 'Confier le rapport',
          reason: null,
        },
        {
          gesture: 'correct',
          object: null,
          day: null,
          label: 'Corriger quelque chose',
          reason: null,
        },
      ],
      unclear: ['appelle le cousin de Kossi'],
    });
    const understood = await understand({
      model,
      text: note,
      today: '2026-10-14',
      known,
      offers,
      language: 'French',
    });
    expect(understood.items).toEqual([
      {
        key: 'close-tsk_quote',
        gesture: 'close',
        label: 'Clore « Devis Pharmacie du Port »',
        reason: "J'ai fini le devis de la Pharmacie.",
        level: 2,
        capability: 'tasks_complete',
        input: { taskId: 'tsk_quote' },
        ticked: true,
      },
      {
        key: 'remind-1',
        gesture: 'remind',
        label: 'Vous rappeler Ecobank jeudi',
        reason: 'Rappelle-moi Ecobank jeudi.',
        level: 1,
        ticked: true,
      },
      {
        key: 'postpone-tsk_report',
        gesture: 'postpone',
        label: 'Reporter le rapport au Fonds à lundi',
        reason: 'on verra lundi',
        level: 2,
        capability: 'tasks_postpone',
        input: { taskId: 'tsk_report', dueOn: '2026-10-19' },
        ticked: true,
      },
    ]);
    expect(understood.unclear).toEqual(['appelle le cousin de Kossi']);
    // The model was told today, the offers and her objects — nothing else of hers.
    expect(shown[0]).toContain('2026-10-14');
    expect(shown[0]).toContain('tsk_report (task) Rapport au Fonds');
    // What it proposes is a proposal set in the contract.
    const [first, ...rest] = understood.items;
    expect(
      validateProposalSet({
        id: 'pps_0000-evening',
        origin: 'closure',
        for: 'usr_afi',
        items: [first, ...rest],
      }).ok,
    ).toBe(true);
  });

  it('asks nothing of an empty note, and leaves a gesture above level 2 unticked', async () => {
    const { model, shown } = reading({ items: [], unclear: [] });
    expect(await understand({ model, text: '   ', today: '2026-10-14', known, offers })).toEqual({
      items: [],
      unclear: [],
    });
    expect(shown).toEqual([]);
    const strict = reading({
      items: [
        {
          gesture: 'correct',
          object: 'tsk_quote',
          day: null,
          label: 'Renommer le devis',
          reason: null,
        },
      ],
      unclear: [],
    });
    const { items } = await understand({
      model: strict.model,
      text: 'renomme le devis',
      today: '2026-10-14',
      known,
      offers,
    });
    expect(items[0]).toMatchObject({ level: 3, ticked: false, capability: 'tasks_rename' });
  });
});
