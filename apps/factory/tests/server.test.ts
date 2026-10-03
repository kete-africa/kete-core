import { PRODUCT_HEADER, SIGNATURE_HEADER, sign } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { ENTERPRISE_PRODUCT, factoryServer } from '../src/server.js';

// Spec 048: only Kete Enterprise calls the factory, each call signed; a request is queued once.

const key = { kid: 'k1', secret: 'a-shared-secret-of-at-least-32-bytes!' };
const request = {
  requestId: 'apr_0002-assets',
  organizationId: 'org_kya-demo',
  requester: { userId: 'usr_sena', name: 'Sena Afiwa Dogbé' },
  app: {
    slug: 'assets',
    name: 'Équipements',
    purpose: 'Véhicules, outillage, appareils de mesure et leur étalonnage, exigé par ISO 9001.',
    users: 'Moyens généraux, laboratoire, QHSE',
    dataCategories: ['none'],
    criticality: 'medium',
    ownerContact: 'sena@kya-demo.test',
  },
  callbackUrl: 'https://api.enterprise.test/v1/factory/reports',
};

function server() {
  const added = new Set<string>();
  const queued: string[] = [];
  const app = factoryServer({
    keys: new Map([[ENTERPRISE_PRODUCT, [key]]]),
    store: {
      add: async (r: { requestId: string }) => {
        if (added.has(r.requestId)) return false;
        added.add(r.requestId);
        return true;
      },
      get: async (_org: string, id: string) =>
        added.has(id)
          ? { request: request as never, status: 'queued' as const, progress: { done: [] } }
          : null,
      save: async () => undefined,
    } as never,
    enqueue: async (id) => {
      queued.push(id);
    },
  });
  return { app, queued };
}

const post = (app: ReturnType<typeof server>['app'], body: unknown, signed = true) => {
  const text = JSON.stringify(body);
  return app.request('/v1/requests', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [PRODUCT_HEADER]: ENTERPRISE_PRODUCT,
      [SIGNATURE_HEADER]: signed ? sign(text, key) : 't=1,kid=k1,v1=' + '0'.repeat(64),
    },
    body: text,
  });
};

describe('the factory’s door', () => {
  it('queues a signed request once', async () => {
    const { app, queued } = server();
    expect((await post(app, request)).status).toBe(202);
    expect((await post(app, request)).status).toBe(200);
    expect(queued).toEqual(['apr_0002-assets']);
  });

  it('refuses an unsigned or invalid request', async () => {
    const { app, queued } = server();
    expect((await post(app, request, false)).status).toBe(401);
    expect(
      (await post(app, { ...request, app: { ...request.app, slug: 'Bad Name' } })).status,
    ).toBe(422);
    expect((await post(app, { ...request, callbackUrl: 'http://evil.test' })).status).toBe(422);
    expect(queued).toEqual([]);
  });

  it('reads a request back only when the read is signed', async () => {
    const { app } = server();
    await post(app, request);
    const path = `/v1/requests/${request.organizationId}/${request.requestId}`;
    const unsigned = await app.request(path);
    expect(unsigned.status).toBe(401);
    const signed = await app.request(path, {
      headers: {
        [PRODUCT_HEADER]: ENTERPRISE_PRODUCT,
        [SIGNATURE_HEADER]: sign(`${request.organizationId}:${request.requestId}`, key),
      },
    });
    expect(signed.status).toBe(200);
    expect(await signed.json()).toMatchObject({ status: 'queued' });
  });
});
