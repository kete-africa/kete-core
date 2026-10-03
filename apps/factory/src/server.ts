import { PRODUCT_HEADER, SIGNATURE_HEADER, verify, type KeyRing } from '@kete/sdk';
import { Hono } from 'hono';
import { appRequest } from './request.js';
import type { RequestStore } from './store.js';

// The factory's door (spec 048): only Kete Enterprise calls it, each call signed with the key they
// share. A request approved there is recorded once and queued; its state can be read back.

export const ENTERPRISE_PRODUCT = 'prd_kete_enterprise';

export function factoryServer(options: {
  store: RequestStore;
  keys: KeyRing;
  enqueue(requestId: string, organizationId: string): Promise<void>;
}): Hono {
  const app = new Hono();

  /** The body, verified: signed by Kete Enterprise, fresh. */
  async function signedBody(request: Request): Promise<string | null> {
    const body = await request.text();
    const result = verify(
      {
        product: request.headers.get(PRODUCT_HEADER),
        signature: request.headers.get(SIGNATURE_HEADER),
        body,
      },
      options.keys,
    );
    return result.ok ? body : null;
  }

  app.get('/health', (c) => c.json({ status: 'healthy' }));

  app.post('/v1/requests', async (c) => {
    const body = await signedBody(c.req.raw);
    if (body === null) return c.json({ error: 'invalid_signature' }, 401);
    const parsed = appRequest.safeParse(JSON.parse(body));
    if (!parsed.success)
      return c.json({ error: 'invalid_input', issues: parsed.error.issues }, 422);
    const added = await options.store.add(parsed.data);
    if (added) await options.enqueue(parsed.data.requestId, parsed.data.organizationId);
    return c.json({ requestId: parsed.data.requestId, status: 'queued' }, added ? 202 : 200);
  });

  // A read is signed too: the body signed is « organizationId:requestId ».
  app.get('/v1/requests/:organizationId/:requestId', async (c) => {
    const { organizationId, requestId } = c.req.param();
    const result = verify(
      {
        product: c.req.header(PRODUCT_HEADER) ?? null,
        signature: c.req.header(SIGNATURE_HEADER) ?? null,
        body: `${organizationId}:${requestId}`,
      },
      options.keys,
    );
    if (!result.ok) return c.json({ error: 'invalid_signature' }, 401);
    const stored = await options.store.get(organizationId, requestId);
    if (!stored) return c.json({ error: 'not_found' }, 404);
    return c.json({ requestId, status: stored.status, progress: stored.progress });
  });

  return app;
}
