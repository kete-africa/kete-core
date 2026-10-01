import { randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { createOutboxRelay, deliveryHandler, httpTransport, memoryDedupeStore } from '@kete/sdk';
import { sql } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auth } from '@/platform/auth';
import { getPool } from '@/platform/db';
import { PRODUCT } from '@/platform/events';
import { manifest } from '@/platform/service';
import { inOrganization } from '@/platform/tenancy';

// Spec 010: the Compte Kete announces what happens to Kete Cockpit — through its outbox, delivered
// signed by the relay.

const run = randomBytes(4).toString('hex');
const key = { kid: `key_test_${run}`, secret: randomBytes(32).toString('base64url') };
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });
const received = memoryDedupeStore();
let receiver: Server;
let receiverUrl = '';
let organizationId = '';

beforeAll(async () => {
  const handler = deliveryHandler({
    keyRing: new Map([[PRODUCT, [key]]]),
    store: received,
    declaredTypes: () => manifest().events,
  });
  receiver = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const response = await handler(
      new Request('http://receiver/api/events', {
        method: 'POST',
        headers: Object.entries(req.headers).flatMap(([k, v]) =>
          typeof v === 'string' ? [[k, v] as [string, string]] : [],
        ),
        body: Buffer.concat(chunks).toString('utf8'),
      }),
    );
    res.writeHead(response.status, { 'content-type': 'application/json' });
    res.end(await response.text());
  });
  await new Promise<void>((resolve) => receiver.listen(0, '127.0.0.1', resolve));
  const address = receiver.address();
  receiverUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/api/events`;
});

afterAll(async () => {
  if (organizationId) {
    await owner.query('delete from kete_outbox where organization_id = $1', [organizationId]);
    await owner.query('delete from organization where id = $1', [organizationId]);
  }
  await owner.query('delete from "user" where email = $1', [`events.${run}@example.test`]);
  await owner.end();
  await new Promise((resolve) => receiver.close(resolve));
  await getPool().end();
});

describe('the Compte Kete announces', () => {
  it('declares its events in its manifest', () => {
    expect(manifest().events).toEqual(['account.created', 'payment.succeeded']);
  });

  it('and its identity card: every Kete app signs in through it (D-040)', () => {
    expect(manifest().governance).toMatchObject({
      owner: { name: 'Kete' },
      dataCategories: ['personal', 'credentials', 'financial'],
      criticality: 'critical',
    });
  });

  it('a new organization, as account.created, in its outbox', async () => {
    const api = auth.api as unknown as {
      signUpEmail(input: {
        body: { name: string; email: string; password: string };
        returnHeaders: true;
      }): Promise<{ headers: Headers }>;
      createOrganization(input: {
        body: { name: string; slug: string };
        headers: Headers;
      }): Promise<{ id: string }>;
    };
    const signUp = await api.signUpEmail({
      body: {
        name: 'Events',
        email: `events.${run}@example.test`,
        password: `pw-${randomBytes(9).toString('hex')}`,
      },
      returnHeaders: true,
    });
    const cookie = signUp.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ');
    const created = await api.createOrganization({
      body: { name: `Events ${run}`, slug: `events-${run}` },
      headers: new Headers({ cookie }),
    });
    organizationId = created.id;
    const { rows } = await inOrganization(organizationId, (tx) =>
      tx.execute<{ envelope: { type: string; product: string; organization: string } }>(
        sql`select envelope from kete_outbox where organization_id = ${organizationId}`,
      ),
    );
    expect(rows.map((r) => r.envelope)).toEqual([
      expect.objectContaining({
        type: 'account.created',
        product: PRODUCT,
        organization: organizationId,
      }),
    ]);
  });

  it('delivers the outbox to Kete Cockpit, signed, and marks it delivered', async () => {
    const relay = createOutboxRelay({
      pool: getPool(),
      transport: httpTransport({ url: receiverUrl }),
      product: PRODUCT,
      key,
    });
    for (let i = 0; i < 20; i += 1) {
      const report = await relay.flush();
      if (report.claimed === 0) break;
    }
    const ours = [...received.events.values()].filter((e) => e.organization === organizationId);
    expect(ours.map((e) => e.type)).toEqual(['account.created']);
    const { rows } = await owner.query<{ status: string }>(
      'select status from kete_outbox where organization_id = $1',
      [organizationId],
    );
    expect(rows).toEqual([{ status: 'delivered' }]);
  });
});
