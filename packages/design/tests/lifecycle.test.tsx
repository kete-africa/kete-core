import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AgentCard, LessonCard, TierLadder } from '../src/index.js';

// Spec 105: the Agent Relances' card, a lesson from Essi's correction, « Relance polie » climbing.

const BASE_COLOR =
  /\b(?:bg|text|border|ring)-(?:primary|primary-strong|ember|ochre|root|ink|bark|clay|sand|paper|rule|success|verify|error|info|night|gray-\d+)\b/;

describe('the lifecycle’s parts', () => {
  it('shows an agent as a job description: mission, facts, budget, state, gestures and their levels', () => {
    const html = renderToStaticMarkup(
      <AgentCard
        name="Agent Relances"
        state="waiting"
        stateLabel="Attend votre décision"
        mission="Faire payer les factures en retard sans abîmer la relation."
        facts={[
          { label: 'Lit', value: 'Kete Finance : factures, encaissements' },
          { label: 'Jamais', value: 'Accorder une remise, annuler une facture.' },
          { label: 'Se réveille', value: 'Chaque lundi à 8 h' },
        ]}
        budget={{ spent: 4100, limit: 5000, label: '4 100 sur 5 000 jetons ce mois' }}
        gesturesLabel="Ce qu’il fait, et jusqu’où"
        gestures={[
          {
            key: 'write',
            label: 'Écrire une relance',
            level: 'je valide',
            proof: '19 acceptées sur 20 — peut faire seul',
          },
          { key: 'cancel', label: 'Annuler une facture', level: 'jamais' },
        ]}
        actions={<button type="button">Mettre en pause</button>}
      />,
    );
    expect(html).toContain('data-agent-run="waiting"');
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="4100"');
    expect(html).toContain('bg-state-verify');
    expect(html).toContain('19 acceptées sur 20');
    expect(html).not.toMatch(BASE_COLOR);
  });

  it('shows a lesson with what was seen, what could change, the case it came from', () => {
    const html = renderToStaticMarkup(
      <LessonCard
        source="Correction d’Essi · mardi"
        observed="« Dernier rappel » retiré d’une première relance."
        proposal="Ne jamais l’écrire avant la troisième."
        testCase="Première relance, 412 000 F, 9 jours de retard."
        labels={{ proposal: 'Ce qui pourrait changer', testCase: 'Le cas' }}
        actions={<button type="button">Garder</button>}
      />,
    );
    expect(html).toContain('Ce qui pourrait changer');
    expect(html).toContain('Le cas');
    expect(html).toContain('Garder');
  });

  it('marks where a resource stands on its tiers, and what the next asks', () => {
    const html = renderToStaticMarkup(
      <TierLadder
        label="Qui peut l’utiliser"
        current="team"
        tiers={[
          { key: 'me', label: 'Moi' },
          { key: 'team', label: 'Mon équipe' },
          { key: 'unit', label: 'Mon unité' },
          { key: 'organization', label: 'Toute l’organisation' },
        ]}
        next="Mon unité : 5 cas réussis (4 aujourd’hui), revue par le chef d’unité."
      />,
    );
    expect(html).toContain('aria-current="step"');
    expect(html.indexOf('aria-current')).toBeLessThan(html.indexOf('Mon unité'));
    expect(html).toContain('5 cas réussis');
    expect(html).not.toMatch(BASE_COLOR);
  });
});
