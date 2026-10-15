import type { AgentEvent } from '@kete/agents';
import { validateIntelligenceEvent, type IntelligenceEvent } from '@kete/sdk';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  IntelligencePanel,
  newTurn,
  readEvents,
  reduceTurn,
  type IntelligenceWords,
  type Turn,
} from '../src/index.js';
import { intelligenceResponse, refused, toIntelligence } from '../src/server.js';

// Spec 101: a turn of the agents' runtime, streamed as the contract, and the drawer that shows it.

async function* agentTurn(events: AgentEvent[]): AsyncGenerator<AgentEvent> {
  for (const event of events) yield event;
}

async function collect<T>(events: AsyncIterable<T>): Promise<T[]> {
  const all: T[] = [];
  for await (const event of events) all.push(event);
  return all;
}

const tools = [
  { name: 'quote_get', autonomy: 1 as const },
  { name: 'invoices_from_quote', autonomy: 3 as const },
];

describe('the server half', () => {
  it('tells a turn as the contract: each capability with its level, the draft, the words, the end', async () => {
    let clock = 1_000;
    const events = await collect(
      toIntelligence(
        agentTurn([
          { type: 'calling', name: 'quote_get' },
          { type: 'call', name: 'quote_get', status: 'done', output: { lines: 2 } },
          { type: 'calling', name: 'invoices_from_quote' },
          {
            type: 'call',
            name: 'invoices_from_quote',
            status: 'draft',
            draftId: 'drf_1',
            output: {},
          },
          { type: 'text', delta: 'J’ai préparé ' },
          { type: 'text', delta: 'la facture.' },
          { type: 'done', usage: { inputTokens: 10, outputTokens: 5, modelCalls: 2 } },
        ]),
        {
          tools,
          draftHref: (id) => `/verification/${id}`,
          sourceOf: ({ name }) =>
            name === 'quote_get' ? { label: 'Devis D-2026-0004', href: '/devis/4' } : null,
          now: () => (clock += 2_100),
        },
      ),
    );
    for (const event of events) expect(validateIntelligenceEvent(event).ok).toBe(true);
    expect(events.map((e) => e.type)).toEqual([
      'tool',
      'tool',
      'source',
      'tool',
      'tool',
      'draft',
      'text',
      'text',
      'done',
    ]);
    expect(events[0]).toEqual({
      type: 'tool',
      id: 't1',
      name: 'quote_get',
      level: 1,
      state: 'running',
    });
    expect(events[1]).toMatchObject({ id: 't1', state: 'done' });
    expect(events[3]).toMatchObject({ name: 'invoices_from_quote', level: 3, state: 'running' });
    expect(events[5]).toEqual({
      type: 'draft',
      draft_id: 'drf_1',
      title: 'invoices_from_quote',
      href: '/verification/drf_1',
    });
    expect(events.at(-1)).toEqual({ type: 'done', tools: 2, ms: 2_100 });
  });

  it('says a gesture waits for her, a failure as a code, and a turn that cannot start', async () => {
    const waiting = await collect(
      toIntelligence(
        agentTurn([
          {
            type: 'call',
            name: 'invoices_from_quote',
            status: 'confirmation_required',
            output: {},
          },
          { type: 'stopped', reason: 'budget_spent' },
        ]),
        { tools },
      ),
    );
    expect(waiting.map((e) => e.type)).toEqual(['tool', 'waiting', 'failed']);
    expect(waiting.at(-1)).toEqual({ type: 'failed', reason: 'budget_spent' });
    expect(await collect(refused('not_connected'))).toEqual([
      { type: 'failed', reason: 'not_connected' },
    ]);
  });

  it('streams one JSON line per event, read back as they come', async () => {
    const response = intelligenceResponse(
      (async function* (): AsyncGenerator<IntelligenceEvent> {
        yield { type: 'status', text: 'Je lis le devis…' };
        yield { type: 'text', delta: 'Bonjour' };
      })(),
    );
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const read = await collect(readEvents(response.body as ReadableStream<Uint8Array>));
    expect(read).toEqual([
      { type: 'status', text: 'Je lis le devis…' },
      { type: 'text', delta: 'Bonjour' },
    ]);
  });
});

describe('the turn on the screen', () => {
  it('rebuilds the answer from its events', () => {
    let turn: Turn = newTurn('1', 'Prépare l’acompte');
    const events: IntelligenceEvent[] = [
      { type: 'plan', steps: ['Lire le devis', 'Préparer la facture'] },
      { type: 'step', index: 0, state: 'running' },
      { type: 'tool', id: 't1', name: 'quote_get', level: 1, state: 'running' },
      { type: 'tool', id: 't1', name: 'quote_get', level: 1, state: 'done', summary: 'done' },
      { type: 'step', index: 0, state: 'done' },
      { type: 'draft', draft_id: 'drf_1', title: 'invoices_from_quote' },
      { type: 'text', delta: 'Prête.' },
      { type: 'done', tools: 1, ms: 4_000 },
    ];
    for (const event of events) turn = reduceTurn(turn, event);
    expect(turn.plan).toEqual([
      { step: 'Lire le devis', state: 'done' },
      { step: 'Préparer la facture', state: 'waiting' },
    ]);
    expect(turn.tools).toEqual([
      { id: 't1', name: 'quote_get', level: 1, state: 'done', summary: 'done' },
    ]);
    expect(turn.drafts).toEqual([{ id: 'drf_1', title: 'invoices_from_quote' }]);
    expect(turn).toMatchObject({ text: 'Prête.', state: 'done', ms: 4_000 });
    expect(reduceTurn(turn, { type: 'failed', reason: 'failed' }).state).toBe('failed');
  });
});

const words: IntelligenceWords = {
  name: 'Kete Intelligence',
  thread: 'Conversation',
  composer: 'Votre demande',
  placeholder: 'Demandez, ou confiez une tâche… @ pour citer, / pour un geste',
  send: 'Envoyer',
  stop: 'Arrêter',
  hint: 'Agit avec vos droits · prépare, vous décidez · chaque chiffre est calculé, jamais inventé',
  context: 'Contexte',
  removeContext: 'Retirer le contexte',
  suggestions: 'Suggestions',
  thinking: 'Je réfléchis…',
  reading: (tool) => `Je consulte ${tool}…`,
  plan: 'Plan',
  level: (level) => `niveau ${level}`,
  sources: 'Sources',
  draft: 'Brouillon',
  verify: 'Vérifier',
  tally: (steps, gestures, seconds) => `${steps} étapes · ${gestures} gestes · ${seconds} s`,
  seconds: (seconds) => `${seconds} s`,
  stopped: 'Arrêté. Ce qui a été lu est gardé ; rien n’a été modifié.',
  reason: (code) => ({ not_connected: 'Aucun modèle n’est connecté.' })[code] ?? code,
  copy: 'Copier',
  ask: 'Demander',
  files: 'Fichiers',
  history: 'Fils',
  newThread: 'Nouveau fil',
  wide: 'Agrandir',
  close: 'Fermer',
  attach: 'Joindre un fichier',
  cite: 'Citer un objet',
  gestures: 'Gestes',
  dictate: 'Dicter',
};

describe('the drawer', () => {
  it('shows what it does now, each capability with its level, and « Arrêter » while it runs', () => {
    const running = reduceTurn(newTurn('1', 'Où en est le devis ?'), {
      type: 'tool',
      id: 't1',
      name: 'quote_get',
      level: 1,
      state: 'running',
    });
    const html = renderToStaticMarkup(
      <IntelligencePanel
        turns={[running]}
        running
        onSend={() => undefined}
        onStop={() => undefined}
        words={words}
        context={{ label: 'Devis D-2026-0004', onRemove: () => undefined }}
        toolLabel={(name) => (name === 'quote_get' ? 'le devis' : name)}
      />,
    );
    expect(html).toContain('Je consulte le devis…');
    expect(html).toContain('niveau 1');
    expect(html).toContain('Devis D-2026-0004');
    expect(html).toContain('Arrêter');
  });

  it('shows the draft to verify, the sources, the end, and a failure in words', () => {
    let done = newTurn('1', 'Prépare l’acompte');
    for (const event of [
      {
        type: 'draft',
        draft_id: 'drf_1',
        title: 'invoices_from_quote',
        href: '/verification/drf_1',
      },
      { type: 'source', label: 'Devis D-2026-0004', href: '/devis/4' },
      { type: 'text', delta: 'Prête.' },
      { type: 'done', tools: 2, ms: 3_000 },
    ] satisfies IntelligenceEvent[])
      done = reduceTurn(done, event);
    const failed = reduceTurn(newTurn('2', 'Et ensuite ?'), {
      type: 'failed',
      reason: 'not_connected',
    });
    const html = renderToStaticMarkup(
      <IntelligencePanel
        turns={[done, failed]}
        running={false}
        onSend={() => undefined}
        onStop={() => undefined}
        words={words}
      />,
    );
    expect(html).toContain('href="/verification/drf_1"');
    expect(html).toContain('href="/devis/4"');
    expect(html).toContain('0 étapes · 0 gestes · 3 s');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Aucun modèle n’est connecté.');
  });

  it('wears the drawer’s head: its two tabs, the threads, a new one, wider, close', () => {
    const html = renderToStaticMarkup(
      <IntelligencePanel
        turns={[
          reduceTurn(newTurn('1', 'Combien ?', 0), {
            type: 'tool',
            id: 't1',
            name: 'metrics_query',
            level: 3,
            state: 'done',
            input: '{ "metric": "finance.available" }',
            summary: '4 339 500 F',
          }),
        ]}
        running={false}
        onSend={() => undefined}
        onStop={() => undefined}
        words={words}
        head={{
          tab: 'ask',
          onTab: () => undefined,
          onHistory: () => undefined,
          onNew: () => undefined,
          onWide: () => undefined,
          onClose: () => undefined,
        }}
      />,
    );
    for (const label of ['Demander', 'Fichiers', 'Fils', 'Nouveau fil', 'Agrandir', 'Fermer']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('aria-selected="true"');
    // A capability shows what it was called with and what it found.
    expect(html).toContain('→ { &quot;metric&quot;: &quot;finance.available&quot; }');
    expect(html).toContain('← 4 339 500 F');
    expect(html).toContain('bg-agent');
  });

  it('offers suggestions before anything is asked', () => {
    const html = renderToStaticMarkup(
      <IntelligencePanel
        turns={[]}
        running={false}
        onSend={() => undefined}
        onStop={() => undefined}
        words={words}
        suggestions={['Quelles factures relancer ?']}
        intro="Bonjour Afi."
      />,
    );
    expect(html).toContain('Quelles factures relancer ?');
    expect(html).toContain('Bonjour Afi.');
  });
});
