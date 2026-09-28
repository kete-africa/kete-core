import { describe, expect, it } from 'vitest';
import {
  createEmitter,
  createEvent,
  InvalidEventError,
  validateDeliveryResult,
  validateEvent,
  validateHealthReport,
  validateManifest,
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
