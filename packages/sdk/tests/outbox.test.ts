import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildHealthReport,
  httpTransport,
  recordEvent,
  createEmitter,
  createOutboxRelay,
  memoryDedupeStore,
  outboxBacklog,
  postgresDedupeStore,
  receiveDelivery,
  type DeliveryResult,
  type Transport,
} from '../src/index.js';
import { createTestDatabase, inOrganization, type TestDatabase } from './support/db.js';
import { key, keyRing, manifest, orgA, orgB } from './support/fixtures.js';

const emitter = createEmitter(manifest);
let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db?.drop();
});

async function countRows(status?: string): Promise<number> {
  const { rows } = await db.owner.query<{ n: string }>(
    `select count(*) as n from kete_outbox ${status ? 'where status = $1' : ''}`,
    status ? [status] : [],
  );
  return Number(rows[0]?.n ?? 0);
}

async function clearOutbox(): Promise<void> {
  await db.owner.query('delete from kete_outbox');
}

/** A transport that hands batches to an in-process receiver. */
function receiverTransport(store = memoryDedupeStore()): Transport & { store: typeof store } {
  return {
    store,
    async send({ body, product, signature }) {
      const headers = new Headers({ 'kete-product': product, 'kete-signature': signature });
      const outcome = await receiveDelivery({ headers, body }, { keyRing, store });
      return outcome.result;
    },
  };
}

describe('recording (US1, FR-006)', () => {
  it('commits the event with the business change, and never without it', async () => {
    await clearOutbox();
    await inOrganization(db.app, orgA, (tx) =>
      emitter.record(tx, { type: 'account.created', organization: orgA, data: {} }),
    );
    await expect(
      inOrganization(db.app, orgA, async (tx) => {
        await emitter.record(tx, { type: 'account.created', organization: orgA, data: {} });
        throw new Error('business change failed');
      }),
    ).rejects.toThrow('business change failed');
    expect(await countRows()).toBe(1);
  });

  it('isolates organizations: a row is neither readable nor writable across them (RLS)', async () => {
    await clearOutbox();
    await inOrganization(db.app, orgA, (tx) =>
      emitter.record(tx, { type: 'account.created', organization: orgA, data: {} }),
    );
    const seenByB = await inOrganization(db.app, orgB, async (tx) => {
      const { rows } = await tx.query('select event_id from kete_outbox');
      return rows.length;
    });
    expect(seenByB).toBe(0);
    await expect(
      inOrganization(db.app, orgB, (tx) =>
        emitter.record(tx, { type: 'account.created', organization: orgA, data: {} }),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('relay (US1, FR-008)', () => {
  it('delivers pending events and marks them delivered', async () => {
    await clearOutbox();
    for (let i = 0; i < 3; i++) {
      await inOrganization(db.app, orgA, (tx) =>
        emitter.record(tx, { type: 'account.created', organization: orgA, data: {} }),
      );
    }
    const transport = receiverTransport();
    const relay = createOutboxRelay({ pool: db.app, transport, product: manifest.product, key });
    const report = await relay.flush();
    expect(report).toMatchObject({ claimed: 3, delivered: 3 });
    expect(await countRows('delivered')).toBe(3);
    expect(transport.store.events.size).toBe(3);
  });

  it('keeps events pending and pushes them back when the receiver is down', async () => {
    await clearOutbox();
    await inOrganization(db.app, orgA, (tx) =>
      emitter.record(tx, { type: 'account.created', organization: orgA, data: {} }),
    );
    const down: Transport = {
      send: () => Promise.reject(new Error('connection refused')),
    };
    const relay = createOutboxRelay({
      pool: db.app,
      transport: down,
      product: manifest.product,
      key,
    });
    expect((await relay.flush()).retried).toBe(1);
    const { rows } = await db.owner.query<{ status: string; due: boolean; last_error: string }>(
      'select status, next_attempt_at > now() as due, last_error from kete_outbox',
    );
    expect(rows[0]).toMatchObject({ status: 'pending', due: true });
    expect(rows[0]?.last_error).toContain('connection refused');
    // Not due yet: a second flush claims nothing.
    expect((await relay.flush()).claimed).toBe(0);
    expect(await outboxBacklog(db.app)).toMatchObject({ pending: 1 });
  });

  it('marks a definitive refusal and never retries it', async () => {
    await clearOutbox();
    await inOrganization(db.app, orgA, (tx) =>
      emitter.record(tx, { type: 'account.created', organization: orgA, data: {} }),
    );
    const refusing: Transport = {
      send: ({ body }) =>
        Promise.resolve<DeliveryResult>({
          results: (JSON.parse(body) as { events: { id: string }[] }).events.map((e) => ({
            id: e.id,
            outcome: 'refused',
            reason: 'undeclared_type',
          })),
        }),
    };
    const relay = createOutboxRelay({
      pool: db.app,
      transport: refusing,
      product: manifest.product,
      key,
    });
    expect((await relay.flush()).refused).toBe(1);
    expect(await countRows('refused')).toBe(1);
  });

  it('never lets two relays claim the same event', { timeout: 120_000 }, async () => {
    await clearOutbox();
    await Promise.all(
      Array.from({ length: 40 }, (_, i) => {
        const organization = i % 2 ? orgA : orgB;
        return inOrganization(db.app, organization, (tx) =>
          emitter.record(tx, { type: 'account.created', organization, data: {} }),
        );
      }),
    );
    const transport = receiverTransport();
    let sent = 0;
    const counting: Transport = {
      send: (request) => {
        sent += (JSON.parse(request.body) as { events: unknown[] }).events.length;
        return transport.send(request);
      },
    };
    const relays = [0, 1, 2].map(() =>
      createOutboxRelay({
        pool: db.app,
        transport: counting,
        product: manifest.product,
        key,
        batchSize: 10,
      }),
    );
    for (let round = 0; round < 3; round++) await Promise.all(relays.map((r) => r.flush()));
    expect(await countRows('delivered')).toBe(40);
    expect(sent).toBe(40);
  });
});

describe('receiver store (US2, FR-012)', () => {
  it('stores each event once in Postgres', async () => {
    await db.owner.query('delete from kete_received_events');
    const store = postgresDedupeStore(db.owner);
    const event = emitter.build({ type: 'account.created', organization: orgA, data: {} });
    expect((await store.accept(manifest.product, [event])).has(event.id)).toBe(true);
    expect((await store.accept(manifest.product, [event])).has(event.id)).toBe(false);
  });
});

describe('health (US3, FR-016)', () => {
  it('reports dependencies and the outbox backlog, without secrets', async () => {
    const report = await buildHealthReport({
      version: manifest.version,
      dependencies: [
        { name: 'database', probe: () => db.app.query('select 1') },
        { name: 'storage', probe: () => Promise.reject(new Error('unreachable')) },
      ],
      backlog: () => outboxBacklog(db.app),
    });
    expect(report.status).toBe('degraded');
    expect(report.dependencies.find((d) => d.name === 'storage')?.status).toBe('down');
    expect(typeof report.outbox.pending).toBe('number');
    expect(JSON.stringify(report)).not.toMatch(/postgres(ql)?:\/\//);
  });
});

describe('an outbox to the center (spec 049)', () => {
  it('keeps its own rows, and goes with the app’s own token instead of a signature', async () => {
    await clearOutbox();
    const event = emitter.build({ type: 'account.created', organization: orgA, data: {} });
    await inOrganization(db.app, orgA, (tx) =>
      recordEvent(tx, event, { outbox: 'kete_center_outbox' }),
    );
    expect(await countRows()).toBe(0);
    expect(await outboxBacklog(db.app, 'kete_center_outbox')).toMatchObject({ pending: 1 });
    const seen: Headers[] = [];
    const relay = createOutboxRelay({
      pool: db.app,
      product: manifest.product,
      outbox: 'kete_center_outbox',
      transport: httpTransport({
        url: 'https://center.test/public/apps/events',
        token: async () => 'app-token',
        fetch: (async (_url: string, init?: RequestInit) => {
          seen.push(new Headers(init?.headers));
          const { events } = JSON.parse(String(init?.body)) as { events: { id: string }[] };
          return Response.json({ results: events.map((e) => ({ id: e.id, outcome: 'accepted' })) });
        }) as unknown as typeof fetch,
      }),
    });
    expect(await relay.flush()).toMatchObject({ claimed: 1, delivered: 1 });
    expect(seen[0]?.get('authorization')).toBe('Bearer app-token');
    expect(seen[0]?.has('kete-signature')).toBe(false);
    expect(await outboxBacklog(db.app, 'kete_center_outbox')).toEqual({ pending: 0 });
  });

  it('waits while the app has no token', async () => {
    const event = emitter.build({ type: 'account.created', organization: orgA, data: {} });
    await inOrganization(db.app, orgA, (tx) =>
      recordEvent(tx, event, { outbox: 'kete_center_outbox' }),
    );
    const relay = createOutboxRelay({
      pool: db.app,
      product: manifest.product,
      outbox: 'kete_center_outbox',
      retryDelaySeconds: () => 0,
      transport: httpTransport({ url: 'https://center.test/x', token: async () => null }),
    });
    expect(await relay.flush()).toMatchObject({ retried: 1 });
  });
});
