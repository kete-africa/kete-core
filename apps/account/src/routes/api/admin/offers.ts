import { randomUUID } from 'node:crypto';
import { createFileRoute } from '@tanstack/react-router';
import { CommandError } from '@kete/commands';
import { z } from 'zod';
import {
  AdminError,
  disableOffer,
  readCatalog,
  requireOperator,
  setOffer,
  type OperatorGesture,
} from '@/features/admin/offers';

// The offers catalog, for Kete Cockpit (spec 007, FR-005). A Kete operator's bearer token only.
const action = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('set'),
    app: z.string(),
    productId: z.string(),
    periodDays: z.number(),
    graceDays: z.number().optional(),
    name: z.string().optional(),
  }),
  z.object({ action: z.literal('disable'), productId: z.string().min(1).max(128) }),
]);

/** The caller's `Idempotency-Key` makes a retried request harmless; without one, each call is new. */
function idempotencyKeyOf(request: Request): string {
  return request.headers.get('idempotency-key') ?? `admin-${randomUUID()}`;
}

async function guarded(
  request: Request,
  run: (gesture: OperatorGesture) => Promise<unknown>,
): Promise<Response> {
  try {
    const identity = await requireOperator(request);
    const gesture = { identity, idempotencyKey: idempotencyKeyOf(request) };
    return Response.json(await run(gesture), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    if (error instanceof AdminError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError)
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    if (error instanceof CommandError) {
      const status = error.code === 'idempotency_conflict' ? 409 : 400;
      return Response.json({ error: error.code }, { status });
    }
    throw error;
  }
}

export const Route = createFileRoute('/api/admin/offers')({
  server: {
    handlers: {
      GET: ({ request }) => guarded(request, readCatalog),
      POST: ({ request }) =>
        guarded(request, async (gesture) => {
          const body = action.parse(await request.json());
          if (body.action === 'disable') return disableOffer(body.productId, gesture);
          return setOffer(
            {
              app: body.app as 'nettio',
              productId: body.productId,
              periodDays: body.periodDays,
              ...(body.graceDays === undefined ? {} : { graceDays: body.graceDays }),
              ...(body.name === undefined ? {} : { name: body.name }),
            },
            gesture,
          );
        }),
    },
  },
});
