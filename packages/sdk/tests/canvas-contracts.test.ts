import { describe, expect, it } from 'vitest';
import {
  validateDatedFact,
  validateFileLink,
  validateIntelligenceEvent,
  validateLesson,
  validateManifest,
  validateMetric,
  validateProposalSet,
  validateResource,
} from '../src/index.js';
import { manifest } from './support/fixtures.js';

// Spec 099: the contracts the canvas of the apps rests on (doctrine D-050 to D-054).

describe('the canvas contracts', () => {
  it('says a dated fact on a day or at a moment, never both, and takes it back', () => {
    const leave = {
      key: 'leave-yao-1',
      kind: 'absence',
      label: 'Congé de Yao',
      day: '2026-11-02',
      until: '2026-11-06',
      person_ids: ['usr_yao'],
    };
    expect(validateDatedFact(leave).ok).toBe(true);
    const reception = {
      key: 'reception-42',
      kind: 'task',
      label: 'Réception du matériel',
      starts_at: '2026-10-16T10:00:00Z',
      ends_at: '2026-10-16T11:00:00Z',
      project_id: 'prj_0b7d2c1e-1111',
      visibility: 'shared',
    };
    expect(validateDatedFact(reception).ok).toBe(true);
    expect(validateDatedFact({ ...reception, cancelled: true }).ok).toBe(true);
    // Neither a day nor a moment, or both: refused.
    expect(validateDatedFact({ key: 'k', kind: 'deadline', label: 'Rapport' }).ok).toBe(false);
    expect(validateDatedFact({ ...leave, starts_at: '2026-11-02T08:00:00Z' }).ok).toBe(false);
    expect(validateDatedFact({ ...leave, kind: 'holiday' }).ok).toBe(false);
  });

  it('declares metrics and places in the manifest, with words for people', () => {
    const metric = {
      name: 'finance.available',
      label: { fr: 'Réellement disponible', en: 'Really available' },
      unit: 'money',
      better: 'up',
      axes: ['project', 'period'],
    };
    expect(validateMetric(metric).ok).toBe(true);
    expect(validateMetric({ ...metric, name: 'available' }).ok).toBe(false);
    const withCanvas = {
      ...manifest,
      question: {
        fr: 'Combien ai-je vraiment, projet par projet ?',
        en: 'How much do I really have, project by project?',
      },
      places: [
        { id: 'home', label: { fr: 'Accueil', en: 'Home' }, path: '/', icon: 'home' },
        {
          id: 'quotes',
          label: { fr: 'Devis', en: 'Quotes' },
          path: '/devis',
          section: { fr: 'Ventes', en: 'Sales' },
          permission: 'sales:read',
        },
      ],
      metrics: [metric],
    };
    expect(validateManifest(withCanvas).ok).toBe(true);
    expect(validateManifest({ ...withCanvas, places: [{ id: 'x', path: 'devis' }] }).ok).toBe(
      false,
    );
  });

  it('proposes several things decided together, each with the level of its gesture', () => {
    const closure = {
      id: 'pps_closure_13oct',
      origin: 'closure',
      for: 'usr_afi',
      items: [
        { key: 'r1', gesture: 'block', label: 'Demain 8 h 30 – 10 h 30 · Rapport', level: 2 },
        {
          key: 'r3',
          gesture: 'assign',
          label: 'Réception vendredi → Yao',
          reason: 'Yao est libre vendredi',
          level: 3,
          ticked: true,
        },
      ],
    };
    expect(validateProposalSet(closure).ok).toBe(true);
    expect(validateProposalSet({ ...closure, items: [] }).ok).toBe(false);
    expect(validateProposalSet({ ...closure, items: [{ ...closure.items[0], level: 5 }] }).ok).toBe(
      false,
    );
  });

  it('carries a resource through its tiers, and a lesson only with consent', () => {
    expect(
      validateResource({
        kind: 'skill',
        id: 'design-kete',
        name: 'Design Kete',
        owner: 'usr_mawuli',
        version: '1.4',
        tier: 'team',
        review: { state: 'asked', risk: 'low', by: 'Responsable qualité' },
        cases: { total: 24, passed: 24 },
      }).ok,
    ).toBe(true);
    const lesson = {
      id: 'lsn_pdf_total_01',
      resource: { kind: 'skill', id: 'design-kete' },
      source: 'correction',
      observed: 'Le PDF du devis coupe le total en bas de page.',
      proposal: 'Garder le bloc des totaux sur une seule page.',
      case: 'Un devis de 14 lignes',
      consent: true,
      state: 'waiting',
    };
    expect(validateLesson(lesson).ok).toBe(true);
    expect(validateLesson({ ...lesson, consent: false }).ok).toBe(false);
  });

  it('links a file to what it proves', () => {
    expect(
      validateFileLink({
        key: 'receipt-1011',
        name: 'Reçu carburant 11-10.jpg',
        object: { kind: 'expense', id: 'exp_12' },
        role: 'justificatif',
        nature: 'receipt',
        origin: 'whatsapp',
        project_id: 'prj_0b7d2c1e-1111',
        keep_until: '2036-10-11',
      }).ok,
    ).toBe(true);
    expect(validateFileLink({ key: 'k', name: 'x', object: { kind: 'expense' } }).ok).toBe(false);
  });

  it('streams a Kete Intelligence turn event by event', () => {
    const turn = [
      { type: 'status', text: 'Je lis le devis…' },
      { type: 'plan', steps: ['Lire le devis', 'Préparer la facture'] },
      { type: 'step', index: 0, state: 'running' },
      { type: 'tool', id: 't1', name: 'quote_get', level: 1, state: 'done', summary: '2 lignes' },
      { type: 'draft', draft_id: 'drf_1', title: 'Facture d’acompte' },
      { type: 'source', label: 'Devis D-2026-0004' },
      { type: 'text', delta: 'J’ai préparé…' },
      { type: 'waiting', reason: 'Votre validation du brouillon' },
      { type: 'done', steps: 2, tools: 1, ms: 4200 },
    ];
    for (const event of turn) expect(validateIntelligenceEvent(event).ok).toBe(true);
    expect(validateIntelligenceEvent({ type: 'tool', id: 't', name: 'x', level: 9 }).ok).toBe(
      false,
    );
    expect(validateIntelligenceEvent({ type: 'shout', text: 'hé' }).ok).toBe(false);
  });
});
