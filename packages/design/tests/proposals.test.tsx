import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProposalList, VoiceCapture, type ProposalRow, type ProposalWords } from '../src/index.js';

// Spec 104: Afi's evening — three gestures proposed, applied together; her voice to say it.

const BASE_COLOR =
  /\b(?:bg|text|border|ring)-(?:primary|primary-strong|ember|ochre|root|ink|bark|clay|sand|paper|rule|success|verify|error|info|night|gray-\d+)\b/;

const words: ProposalWords = {
  label: 'Ce que je propose pour ce soir',
  apply: (n) => `Appliquer ${n} geste${n > 1 ? 's' : ''}`,
  dismiss: 'Ne rien garder',
  undo: 'Tout annuler',
  level: (l) => `Niveau ${l}`,
  outcomes: {
    applied: 'fait',
    failed: 'pas fait',
    needs_confirmation: 'à confirmer à part',
    not_ticked: 'laissé',
    undone: 'annulé',
    undo_failed: 'pas annulé',
  },
};
const rows: [ProposalRow, ProposalRow, ProposalRow] = [
  {
    key: 'close',
    label: 'Clore « Devis Pharmacie du Port »',
    reason: 'J’ai fini le devis.',
    level: 2,
    ticked: true,
  },
  { key: 'remind', label: 'Vous rappeler Ecobank jeudi', level: 1, ticked: true },
  { key: 'rename', label: 'Renommer le devis', level: 3, ticked: false },
];
const noop = () => undefined;

describe('the proposals’ parts', () => {
  it('lists what is proposed, ticked or not, with its level and her words, and applies the ticked ones', () => {
    const html = renderToStaticMarkup(
      <ProposalList
        rows={rows}
        status="proposed"
        words={words}
        onToggle={noop}
        onApply={noop}
        onDismiss={noop}
      />,
    );
    expect(html).toContain('aria-label="Ce que je propose pour ce soir"');
    expect(html.match(/checked=""/g)).toHaveLength(2);
    expect(html).toContain('Appliquer 2 gestes');
    expect(html).toContain('J’ai fini le devis.');
    expect(html).toContain('Niveau 3');
    expect(html).not.toMatch(BASE_COLOR);
  });

  it('says what became of each once applied, and offers to undo them together', () => {
    const html = renderToStaticMarkup(
      <ProposalList
        rows={[
          { ...rows[0], outcome: 'applied' },
          { ...rows[1], outcome: 'failed' },
          { ...rows[2], outcome: 'not_ticked' },
        ]}
        status="applied"
        words={words}
        onToggle={noop}
        onApply={noop}
        onDismiss={noop}
        onUndo={noop}
      />,
    );
    expect(html).toContain('data-outcome="applied"');
    expect(html).toContain('pas fait');
    expect(html).toContain('Tout annuler');
    expect(html).not.toContain('Appliquer');
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('records nothing before she presses', () => {
    const html = renderToStaticMarkup(
      <VoiceCapture
        onAudio={noop}
        words={{
          start: 'Dire ma journée',
          stop: 'Terminer',
          recording: (s) => `J’écoute… ${s} s`,
          unavailable: 'Le micro n’est pas disponible',
        }}
      />,
    );
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('Dire ma journée');
    expect(html).toContain('data-voice="idle"');
    expect(html).toContain('role="status"');
  });
});
