import { describe, expect, it } from 'vitest';
import { describeDraft } from '../src/index.js';

// Spec 139, FR-013: the invoice draft Support prepared in Kete Finance, read by an accountant —
// never `amount_minor`, never `[object Object]`, never an identifier.

const schema = {
  type: 'object',
  properties: {
    party_id: { type: 'string', title: 'Client' },
    issued_on: { type: 'string', format: 'date' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: { label: { type: 'string' }, total: { type: 'object' } },
      },
    },
    total: { type: 'object' },
    paid: { type: 'boolean' },
  },
};

describe('a draft described', () => {
  it('gives labels, money in F CFA, dates, names and lines', () => {
    const fields = describeDraft(
      {
        schema,
        values: {
          lines: [
            { label: 'Intervention (90 min)', total: { amount: 22500, currency: 'XOF' } },
            { label: 'Pièces', total: { amount: 42000, currency: 'XOF' } },
          ],
          party_id: 'pty_01a15c43sarakawa',
          issued_on: '2026-10-21',
          total: { amount: 76110, currency: 'XOF' },
          paid: false,
        },
        provenance: {
          party_id: { source: 'system' },
          total: { source: 'inferred', certainty: 'low' },
        },
      },
      {
        locale: 'fr',
        label: (key) => ({ lines: 'Lignes', total: 'Total TTC', paid: 'Payée' })[key],
        name: (id) => (id === 'pty_01a15c43sarakawa' ? 'Hôtel Sarakawa' : undefined),
        words: { yes: 'Oui', no: 'Non' },
      },
    );
    const nb = (text: string) => text.replace(/[\u202f\u00a0]/g, ' ');
    expect(fields.map((f) => [f.label, nb(f.value)])).toEqual([
      ['Client', 'Hôtel Sarakawa'],
      ['Issued on', '21 octobre 2026'],
      [
        'Lignes',
        'Label : Intervention (90 min) · Total : 22 500 F CFA\nLabel : Pièces · Total : 42 000 F CFA',
      ],
      ['Total TTC', '76 110 F CFA'],
      ['Payée', 'Non'],
    ]);
    expect(fields.find((f) => f.key === 'total')).toMatchObject({
      source: 'inferred',
      uncertain: true,
    });
  });
});
