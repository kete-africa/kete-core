import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DraftReview } from '@kete/capabilities';
import fr from '../messages/fr.json' with { type: 'json' };
import en from '../messages/en.json' with { type: 'json' };
import { ViewRoot, type ViewHost } from '../app/view.js';
import { detailView, formView, keteViews, tableView, VIEWS } from '../src/index.js';

const host: ViewHost = { call: async () => undefined, open: () => undefined };

const review = (autonomy: 3 | 4): DraftReview => ({
  draftId: 'drf_1',
  capability: 'quotes_issue',
  description: 'Issues a quote to a client.',
  autonomy,
  recordType: 'quote',
  status: 'prepared',
  values: { client: 'Ama', amount: 18000 },
  provenance: {
    client: { source: 'message', by: { kind: 'agent', id: 'agt_1' } },
    amount: { source: 'inferred', by: { kind: 'agent', id: 'agt_1' }, certainty: 'low' },
  },
  schema: {
    type: 'object',
    properties: { client: { type: 'string', title: 'Client' }, amount: { type: 'integer' } },
  },
});

describe('the generic views, as MCP Apps resources', () => {
  it('serve one self-contained page, in the product’s design', async () => {
    const views = keteViews({ design: 'workspace' });
    expect(views.map((view) => view.uri)).toEqual(Object.values(VIEWS));
    const [review] = views;
    if (!review) throw new Error('No view.');
    const html = await review.html();
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html data-design="workspace"');
    // Scripts and styles are inlined: the page asks nothing of any origin.
    expect(html).not.toMatch(/<script\b[^>]*\bsrc="/);
    expect(html).not.toMatch(/<link\b[^>]*\brel="stylesheet"/);
    expect(html).not.toContain('jsxDEV');
  });

  it('keep the same words in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
});

describe('a draft to verify', () => {
  it('shows each value with where it came from, and lets the person decide (level 3)', () => {
    const html = renderToStaticMarkup(
      <ViewRoot content={{ status: 'draft', review: review(3) }} labels={fr} host={host} />,
    );
    expect(html).toContain('Client');
    expect(html).toContain('tiré du message');
    expect(html).toContain('déduit par l’agent · incertain');
    expect(html).toContain('bg-state-verify-surface');
    for (const word of ['Valider', 'Corriger', 'Refuser']) expect(html).toContain(word);
  });

  it('sends a level 4 decision to the app, where it is confirmed', () => {
    const html = renderToStaticMarkup(
      <ViewRoot
        content={{ status: 'draft', review: review(4), openUrl: 'https://app.test/review/drf_1' }}
        labels={fr}
        host={host}
      />,
    );
    expect(html).toContain('Ouvrir pour confirmer');
    expect(html).not.toContain('>Valider<');
    expect(html).toContain('il se confirme dans l’application');
  });

  it('shows a decided draft as decided, with no gesture left', () => {
    const decided = { ...review(3), status: 'validated' as const };
    const html = renderToStaticMarkup(
      <ViewRoot content={{ status: 'validated', review: decided }} labels={en} host={host} />,
    );
    expect(html).toContain('data-agent-state="verified"');
    expect(html).not.toContain('>Validate<');
  });
});

describe('table, detail and form', () => {
  it('draw a table with its headers, numbers on the right', () => {
    const content = {
      status: 'done',
      output: tableView({
        title: 'Factures',
        columns: [
          { key: 'client', label: 'Client' },
          { key: 'amount', label: 'Montant', align: 'end' },
        ],
        rows: [{ client: 'Ama', amount: 18000 }],
      }),
    };
    const html = renderToStaticMarkup(<ViewRoot content={content} labels={fr} host={host} />);
    expect(html).toContain('<th scope="col"');
    expect(html).toContain('text-right font-number');
    expect(html).toContain('18000');
  });

  it('draw a record field by field, and a form from its schema', () => {
    const detail = renderToStaticMarkup(
      <ViewRoot
        content={detailView({ title: 'Ama', fields: [{ label: 'Ville', value: 'Lomé' }] })}
        labels={fr}
        host={host}
      />,
    );
    expect(detail).toContain('<dt');
    expect(detail).toContain('Lomé');
    const form = renderToStaticMarkup(
      <ViewRoot
        content={formView({
          title: 'Nouvelle demande',
          schema: {
            type: 'object',
            properties: {
              project: { type: 'string', title: 'Projet' },
              quantity: { type: 'integer', title: 'Quantité' },
              unit: { enum: ['pièce', 'lot'], title: 'Unité' },
            },
            required: ['project', 'quantity'],
          },
          submit: { tool: 'purchases_prepare', label: 'Préparer la demande' },
        })}
        labels={fr}
        host={host}
      />,
    );
    expect(form).toContain('Projet');
    expect(form).toContain('type="number"');
    expect(form).toContain('<select');
    expect(form).toContain('Préparer la demande');
  });
});
