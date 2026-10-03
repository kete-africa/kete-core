import type { DatasetRegistry } from './datasets.js';
import type { Caller, CapabilityRegistry } from './registry.js';

// A product's API (spec 045): its capabilities and its data sets over HTTP, for other apps and for
// people's dashboards — the same registry as the screens and MCP, so the same rights, journal and
// autonomy rules. Mounted under one prefix:
//
//   GET  {prefix}/capabilities            what the caller may use (capability.v1)
//   POST {prefix}/capabilities/{name}     invoke one: JSON input, `Idempotency-Key` header
//   GET  {prefix}/datasets                what the caller may read (dataset.v1)
//   GET  {prefix}/datasets/{name}         rows: ?from=YYYY-MM-DD&to=YYYY-MM-DD&limit=500

export interface HttpApiOptions {
  registry: CapabilityRegistry;
  datasets: DatasetRegistry;
  /** Who calls, from the request (a Compte Kete token): null for nobody. */
  caller(request: Request): Promise<Caller | null>;
  /** The path the API is mounted at, e.g. `/api/v1`. */
  prefix: string;
  /** Where clients learn how to get a token (RFC 9728), sent with a 401. */
  resourceMetadataUrl?: string;
}

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

const invocationStatus: Record<string, number> = {
  done: 200,
  draft: 202,
  confirmation_required: 409,
};
const refusalStatus: Record<string, number> = {
  not_allowed: 403,
  unknown_capability: 404,
  unknown_dataset: 404,
  invalid_input: 422,
  invalid_query: 422,
};

export function createHttpApi(options: HttpApiOptions): (request: Request) => Promise<Response> {
  const prefix = options.prefix.replace(/\/$/, '');
  return async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${prefix}/`)) return json({ error: 'not_found' }, 404);
    const parts = url.pathname.slice(prefix.length + 1).split('/');
    const caller = await options.caller(request);
    if (!caller) {
      return new Response(JSON.stringify({ error: 'signed_out' }), {
        status: 401,
        headers: {
          'content-type': 'application/json',
          'www-authenticate': options.resourceMetadataUrl
            ? `Bearer resource_metadata="${options.resourceMetadataUrl}"`
            : 'Bearer',
        },
      });
    }
    const [collection, name, ...rest] = parts;
    if (rest.length > 0) return json({ error: 'not_found' }, 404);

    if (collection === 'capabilities' && !name && request.method === 'GET') {
      return json({ capabilities: await options.registry.list(caller) });
    }
    if (collection === 'capabilities' && name && request.method === 'POST') {
      const input: unknown = await request.json().catch(() => undefined);
      if (input === undefined) return json({ error: 'invalid_input' }, 422);
      const key = request.headers.get('idempotency-key');
      const result = await options.registry.invoke({
        ...caller,
        name,
        input,
        ...(key ? { idempotencyKey: key } : {}),
      });
      if (result.status === 'refused') {
        return json({ error: result.reason, ...result }, refusalStatus[result.reason] ?? 400);
      }
      return json(result, invocationStatus[result.status] ?? 200);
    }
    if (collection === 'datasets' && !name && request.method === 'GET') {
      return json({ datasets: await options.datasets.list(caller) });
    }
    if (collection === 'datasets' && name && request.method === 'GET') {
      const query = Object.fromEntries(
        (['from', 'to', 'limit'] as const)
          .map((key) => [key, url.searchParams.get(key)] as const)
          .filter(
            (entry): entry is readonly ['from' | 'to' | 'limit', string] => entry[1] !== null,
          ),
      );
      const read = await options.datasets.read(caller, name, query);
      if (read.status === 'refused')
        return json({ error: read.reason }, refusalStatus[read.reason] ?? 400);
      return json(read);
    }
    return json(
      { error: 'not_found' },
      request.method === 'GET' || request.method === 'POST' ? 404 : 405,
    );
  };
}
