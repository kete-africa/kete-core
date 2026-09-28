import { describe, expect, it } from 'vitest';
import {
  createEmitter,
  memoryDedupeStore,
  PRODUCT_HEADER,
  receiveDelivery,
  SIGNATURE_HEADER,
  sign,
  verify,
  type SigningKey,
} from '../src/index.js';
import { key, keyRing, manifest, orgA } from './support/fixtures.js';

const emitter = createEmitter(manifest);

function delivery(
  body: string,
  options: { signWith?: SigningKey; at?: Date; product?: string } = {},
) {
  const headers = new Headers({
    [PRODUCT_HEADER]: options.product ?? manifest.product,
    [SIGNATURE_HEADER]: sign(body, options.signWith ?? key, options.at ?? new Date()),
  });
  return { headers, body };
}

const batch = () =>
  JSON.stringify({
    events: [emitter.build({ type: 'account.created', organization: orgA, data: {} })],
  });

describe('verification (US2)', () => {
  it('accepts a valid signed delivery', async () => {
    const outcome = await receiveDelivery(delivery(batch()), {
      keyRing,
      store: memoryDedupeStore(),
    });
    expect(outcome.status).toBe(200);
    expect(outcome.result.results[0]?.outcome).toBe('accepted');
  });

  it('refuses an altered body', async () => {
    const body = batch();
    const d = delivery(body);
    const outcome = await receiveDelivery(
      { headers: d.headers, body: body.replace('account.created', 'account.closed') },
      { keyRing, store: memoryDedupeStore() },
    );
    expect(outcome.status).toBe(401);
    expect(outcome.result.results[0]?.reason).toBe('invalid_signature');
  });

  it('refuses a wrong key, an unknown product and a stale delivery', async () => {
    const store = memoryDedupeStore();
    const wrongKey = await receiveDelivery(
      delivery(batch(), { signWith: { kid: 'key_1', secret: 'b'.repeat(40) } }),
      { keyRing, store },
    );
    const unknown = await receiveDelivery(delivery(batch(), { product: 'prd_other' }), {
      keyRing,
      store,
    });
    const stale = await receiveDelivery(
      delivery(batch(), { at: new Date(Date.now() - 10 * 60_000) }),
      { keyRing, store },
    );
    expect(wrongKey.result.results[0]?.reason).toBe('invalid_signature');
    expect(unknown.result.results[0]?.reason).toBe('unknown_product');
    expect(stale.result.results[0]?.reason).toBe('stale');
    expect(store.events.size).toBe(0);
  });

  it('accepts old and new keys during a rotation, then only the new one (FR-014)', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    const oldKey = {
      kid: 'key_old',
      secret: 'o'.repeat(40),
      notAfter: new Date('2026-10-02T00:00:00Z'),
    };
    const newKey = {
      kid: 'key_new',
      secret: 'n'.repeat(40),
      notBefore: new Date('2026-09-30T00:00:00Z'),
    };
    const ring = new Map([[manifest.product, [oldKey, newKey]]]);
    const body = '{}';
    const check = (k: SigningKey, at: Date) =>
      verify({ product: manifest.product, signature: sign(body, k, at), body }, ring, { now: at })
        .ok;
    expect(check(oldKey, now)).toBe(true);
    expect(check(newKey, now)).toBe(true);
    const later = new Date('2026-10-03T00:00:00Z');
    expect(check(oldKey, later)).toBe(false);
    expect(check(newKey, later)).toBe(true);
  });
});

describe('processing (US1, US2)', () => {
  it('processes each event at most once (FR-012)', async () => {
    const store = memoryDedupeStore();
    const body = batch();
    const first = await receiveDelivery(delivery(body), { keyRing, store });
    const second = await receiveDelivery(delivery(body), { keyRing, store });
    expect(first.result.results[0]?.outcome).toBe('accepted');
    expect(second.result.results[0]?.outcome).toBe('duplicate');
    expect(store.events.size).toBe(1);
  });

  it('refuses per event: invalid payload, undeclared type, foreign product', async () => {
    const good = emitter.build({ type: 'account.created', organization: orgA, data: {} });
    const undeclared = emitter.build({ type: 'deposit.created', organization: orgA, data: {} });
    const foreign = {
      ...emitter.build({ type: 'account.created', organization: orgA, data: {} }),
      product: 'prd_other',
    };
    const broken = { ...good, id: 'evt_bad' };
    const body = JSON.stringify({ events: [good, undeclared, foreign, broken] });
    const outcome = await receiveDelivery(delivery(body), {
      keyRing,
      store: memoryDedupeStore(),
      declaredTypes: () => ['account.created'],
    });
    const byId = new Map(outcome.result.results.map((r) => [r.id, r]));
    expect(byId.get(good.id)?.outcome).toBe('accepted');
    expect(byId.get(undeclared.id)?.reason).toBe('undeclared_type');
    expect(byId.get(foreign.id)?.reason).toBe('invalid_payload');
    expect(byId.get('evt_bad')?.reason).toBe('invalid_payload');
  });

  it('refuses a batch larger than 256 KB', async () => {
    const body = JSON.stringify({ events: [], padding: 'x'.repeat(300 * 1024) });
    const outcome = await receiveDelivery(delivery(body), { keyRing, store: memoryDedupeStore() });
    expect(outcome.status).toBe(413);
  });
});
