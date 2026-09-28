import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createEmitter,
  createOutboxRelay,
  memoryDedupeStore,
  receiveDelivery,
  type Transport,
} from '../src/index.js';
import { createTestDatabase, inOrganization, type TestDatabase } from './support/db.js';
import { key, keyRing, manifest, orgA, orgB } from './support/fixtures.js';

/**
 * SC-001: across 1,000 business changes with receiver outages, lost acknowledgements and relay
 * crashes, the receiver ends with exactly 1,000 events — none lost, none duplicated.
 */
const CHANGES = Number(process.env.KETE_CHAOS_CHANGES ?? 1000);

const emitter = createEmitter(manifest);
let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db?.drop();
});

describe('chaos (SC-001)', () => {
  it(`delivers ${CHANGES} events exactly once despite failures`, { timeout: 600_000 }, async () => {
    // 1. Business changes, some of them rolled back: only committed changes produce events.
    const committed: string[] = [];
    let attempted = 0;
    const workers = Array.from({ length: 10 }, async (_, w) => {
      while (committed.length < CHANGES) {
        const n = attempted++;
        const organization = n % 2 ? orgA : orgB;
        const rollback = n % 7 === 3;
        try {
          const event = await inOrganization(db.app, organization, async (tx) => {
            const e = await emitter.record(tx, {
              type: 'account.created',
              organization,
              data: { plan: `w${w}` },
            });
            if (rollback) throw new Error('rolled back');
            return e;
          });
          if (committed.length < CHANGES) committed.push(event.id);
          else await db.owner.query('delete from kete_outbox where event_id = $1', [event.id]);
        } catch {
          // A rolled-back change: its event must never be delivered.
        }
      }
    });
    await Promise.all(workers);
    expect(committed).toHaveLength(CHANGES);

    // 2. A receiver behind a hostile network.
    const store = memoryDedupeStore();
    let deliveries = 0;
    let random = 42;
    const chance = () => (random = (random * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    const hostile: Transport = {
      async send({ body, product, signature }) {
        if (chance() < 0.25) throw new Error('receiver unreachable');
        const headers = new Headers({ 'kete-product': product, 'kete-signature': signature });
        const outcome = await receiveDelivery({ headers, body }, { keyRing, store });
        deliveries += outcome.result.results.length;
        if (chance() < 0.2) throw new Error('acknowledgement lost');
        return outcome.result;
      },
    };
    const relay = createOutboxRelay({
      pool: db.app,
      transport: hostile,
      product: manifest.product,
      key,
      batchSize: 50,
      leaseSeconds: 1,
      retryDelaySeconds: () => 0,
    });

    // 3. Flush until the outbox is empty; sometimes the relay "crashes" after claiming.
    for (let round = 0; round < 500; round++) {
      if (chance() < 0.1) {
        await db.app.query('select * from kete_outbox_claim(20, 1)');
        await new Promise((r) => setTimeout(r, 1100));
      }
      await relay.flush();
      const { rows } = await db.owner.query<{ n: string }>(
        `select count(*) as n from kete_outbox where status = 'pending'`,
      );
      if (Number(rows[0]?.n) === 0) break;
    }

    const received = [...store.events.keys()].sort();
    expect(received).toEqual([...committed].sort());
    expect(deliveries).toBeGreaterThanOrEqual(CHANGES);
    console.info(
      `chaos: ${CHANGES} events, ${deliveries} deliveries (${deliveries - CHANGES} duplicates absorbed), 0 lost`,
    );
  });
});
