import { describe, expect, it } from 'vitest';
import {
  createEmitter,
  createEvent,
  InvalidEventError,
  validateDeliveryResult,
  validateEvent,
  validateHealthReport,
  validateManifest,
  validateObject,
  validateObjectType,
} from '../src/index.js';
import { manifest, orgA } from './support/fixtures.js';

const emitter = createEmitter(manifest);

describe('contracts', () => {
  it('accepts a valid event and refuses an event with personal fields or a bad id', () => {
    const event = emitter.build({ type: 'account.created', organization: orgA, data: {} });
    expect(validateEvent(event).ok).toBe(true);
    expect(validateEvent({ ...event, email: 'a@b.c' }).ok).toBe(false);
    expect(validateEvent({ ...event, id: 'evt_123' }).ok).toBe(false);
  });

  it('validates manifests, health reports and delivery results', () => {
    expect(validateManifest(manifest).ok).toBe(true);
    expect(validateManifest({ ...manifest, version: 'v1' }).ok).toBe(false);
    expect(
      validateHealthReport({
        status: 'healthy',
        version: '0.1.0',
        checked_at: new Date().toISOString(),
        dependencies: [{ name: 'database', status: 'up', latency_ms: 3 }],
        outbox: { pending: 0 },
      }).ok,
    ).toBe(true);
    expect(validateDeliveryResult({ results: [{ id: 'x', outcome: 'lost' }] }).ok).toBe(false);
  });

  it("accepts an app's identity card, complete, and refuses an incomplete one (D-040)", () => {
    const governance = {
      owner: { name: 'Software team', contact: 'software@example.com' },
      dataCategories: ['personal', 'financial'],
      ai: { used: true, purpose: 'Reads delivery notes from photos' },
      criticality: 'high',
    };
    expect(validateManifest({ ...manifest, governance }).ok).toBe(true);
    // Without a card, a manifest stays valid (additive within v1).
    expect(validateManifest(manifest).ok).toBe(true);
    const refused = (card: Record<string, unknown>) =>
      expect(validateManifest({ ...manifest, governance: { ...governance, ...card } }).ok).toBe(
        false,
      );
    refused({ owner: undefined });
    refused({ owner: { name: '' } });
    refused({ owner: { name: 'Software team', contact: 'not an e-mail' } });
    refused({ dataCategories: [] });
    refused({ dataCategories: ['none', 'personal'] });
    refused({ dataCategories: ['gossip'] });
    refused({ ai: {} });
    refused({ criticality: 'extreme' });
    expect(
      validateManifest({ ...manifest, governance: { ...governance, dataCategories: ['none'] } }).ok,
    ).toBe(true);
  });

  it('declares a kind of object once and says its objects to the index (spec 142)', () => {
    const asset = {
      kind: 'asset',
      label: { fr: 'Équipement', en: 'Asset', fr_plural: 'Équipements', en_plural: 'Assets' },
      icon: 'sun',
      states: [
        { id: 'in_service', label: { fr: 'En service', en: 'In service' }, tone: 'ok' },
        { id: 'retired', label: { fr: 'Retiré', en: 'Retired' }, closed: true },
      ],
      axes: ['project', 'party', 'unit', 'person'],
      links: [
        {
          relation: 'located_at',
          to: 'place',
          label: { fr: 'se trouve à', en: 'located at' },
          inverse: { fr: 'accueille', en: 'hosts' },
        },
      ],
      href: '/equipements/{id}',
    };
    expect(validateObjectType(asset).ok).toBe(true);
    expect(validateManifest({ ...manifest, objects: [asset] }).ok).toBe(true);
    expect(validateObjectType({ ...asset, kind: 'Asset' }).ok).toBe(false);
    expect(validateObjectType({ ...asset, axes: ['site'] }).ok).toBe(false);
    expect(validateObjectType({ ...asset, href: '/equipements' }).ok).toBe(false);
    expect(validateObjectType({ ...asset, states: [] }).ok).toBe(false);

    const said = {
      kind: 'asset',
      id: 'ast_0199a4',
      title: 'Mini-centrale · École de Tsévié',
      state: 'in_service',
      project_id: 'prj_0199a40000',
      unit_id: 'unt_0199a40000',
      person_id: 'usr_yao',
      links: [{ relation: 'located_at', kind: 'place', id: 'plc_0199a4' }],
      updated_at: '2026-10-23T09:12:00Z',
    };
    expect(validateObject(said).ok).toBe(true);
    expect(validateObject({ kind: 'asset', id: 'ast_0199a4', title: 'x', gone: true }).ok).toBe(
      true,
    );
    expect(validateObject({ ...said, unit_id: 'site-12' }).ok).toBe(false);
    expect(validateObject({ ...said, title: '' }).ok).toBe(false);
    expect(validateObject({ ...said, fields: { power: 24 } }).ok).toBe(false);
  });
});

describe('createEvent', () => {
  it('builds a time-ordered envelope with the product of the manifest', () => {
    const first = emitter.build({ type: 'account.created', organization: orgA, data: {} });
    const second = emitter.build({ type: 'account.created', organization: orgA, data: {} });
    expect(first.product).toBe('prd_sample');
    expect(first.specversion).toBe('1');
    expect(first.id < second.id || first.id.slice(0, 17) === second.id.slice(0, 17)).toBe(true);
  });

  it('validates the data of standard event types', () => {
    expect(() =>
      emitter.build({
        type: 'payment.succeeded',
        organization: orgA,
        data: { amount: 5000, currency: 'XOF', reference: 'chw_1' },
      }),
    ).not.toThrow();
    expect(() =>
      emitter.build({
        type: 'payment.succeeded',
        organization: orgA,
        // A decimal amount breaks the "smallest unit" rule.
        data: { amount: 50.5, currency: 'XOF', reference: 'chw_1' },
      }),
    ).toThrow(InvalidEventError);
  });

  it('refuses an undeclared type before it leaves the app (FR-010)', () => {
    expect(() =>
      createEvent({
        type: 'payment.failed',
        product: manifest.product,
        organization: orgA,
        data: { amount: 1, currency: 'XOF', reason_code: 'x' },
        declaredTypes: manifest.events,
      }),
    ).toThrow(/undeclared_type/);
  });

  it('refuses an oversized event', () => {
    expect(() =>
      emitter.build({
        type: 'deposit.created',
        organization: orgA,
        data: { note: 'x'.repeat(20_000) },
      }),
    ).toThrow(/too_large/);
  });
});
