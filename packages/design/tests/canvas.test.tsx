import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AgentRunState,
  DecisionCard,
  KpiTile,
  Mention,
  type AgentRunStateName,
} from '../src/index.js';

// Spec 100: the canvas's first wave of parts — the same in the center and in every app.

// The colors of the palettes: components name semantic tokens only.
const BASE_COLOR =
  /\b(?:bg|text|border|ring)-(?:primary|primary-strong|ember|ochre|root|ink|bark|clay|sand|paper|rule|success|verify|error|info|night|gray-\d+)\b/;

describe('the canvas’s parts', () => {
  it('shows a decision with its evidence, what it changes and its gestures', () => {
    const html = renderToStaticMarkup(
      <DecisionCard
        title="Achat « Outillage de pose »"
        amount="145 000 F"
        asker="Kossi Adjo le demande pour Éclairage — La Colombe"
        evidence={[
          { label: 'Budget du projet', detail: 'hors poste' },
          { label: 'Dernier prix payé', detail: '152 000 F', href: '/achats/12' },
        ]}
        actions={<button type="button">Approuver</button>}
        how={<button type="button">Comment ?</button>}
      >
        Approuvé, la marge prévue passe de 240 000 F à 95 000 F.
      </DecisionCard>,
    );
    expect(html).toMatch(/<article aria-labelledby="[^"]+"/);
    expect(html).toContain('145 000 F');
    expect(html).toContain('href="/achats/12"');
    expect(html).toContain('la marge prévue passe');
    expect(html).toContain('Comment ?');
    expect(html).not.toMatch(BASE_COLOR);
  });

  it('names an object with its card, in the color of its app', () => {
    const html = renderToStaticMarkup(
      <Mention
        href="/projets/la-colombe"
        label="Éclairage — La Colombe"
        color="var(--app-finance)"
        card="Projet · en préparation · Kossi Adjo"
      />,
    );
    expect(html).toContain('role="tooltip"');
    expect(html).toMatch(/aria-describedby="[^"]+"/);
    expect(html).toContain('background:var(--app-finance)');
    expect(html).not.toMatch(BASE_COLOR);
  });

  it('marks the six states of an agent the same way everywhere', () => {
    const states: AgentRunStateName[] = [
      'asleep',
      'working',
      'waiting',
      'blocked',
      'paused',
      'stopped',
    ];
    for (const state of states) {
      const html = renderToStaticMarkup(<AgentRunState state={state}>{state}</AgentRunState>);
      expect(html).toContain(`data-agent-run="${state}"`);
      expect(html).not.toMatch(BASE_COLOR);
    }
  });

  it('puts « Pourquoi ? » under a figure, never inside a link', () => {
    const why = <button type="button">Pourquoi ?</button>;
    expect(
      renderToStaticMarkup(<KpiTile label="Marge prévue" value="240 000 F" why={why} />),
    ).toContain('Pourquoi ?');
    expect(
      renderToStaticMarkup(<KpiTile label="Marge" value="240 000 F" href="/marge" why={why} />),
    ).not.toContain('Pourquoi ?');
  });
});
