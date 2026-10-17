import { randomUUID } from 'node:crypto';
import { createFileRoute } from '@tanstack/react-router';
import { CommandError } from '@kete/commands';
import { z } from 'zod';
import { AdminError, requireOperator, type OperatorGesture } from '@/features/admin/offers';
import { FleetError, makeReady, makeReadyInput, readFleet } from '@/features/deployments/fleet';

// Kete's fleet, for Kete Cockpit (spec 125): every organization's deployments, and an operator's
// word that one is made. A Kete operator's bearer token only.

async function guarded(
  request: Request,
  run: (gesture: OperatorGesture) => Promise<unknown>,
): Promise<Response> {
  try {
    const identity = await requireOperator(request);
    const idempotencyKey = request.headers.get('idempotency-key') ?? `fleet-${randomUUID()}`;
    return Response.json(await run({ identity, idempotencyKey }), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof AdminError || error instanceof FleetError) {
      return Response.json({ error: error.code }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return Response.json({ error: 'invalid_request' }, { status: 400 });
    }
    if (error instanceof CommandError) {
      const status = error.code === 'idempotency_conflict' ? 409 : 400;
      return Response.json({ error: error.code }, { status });
    }
    throw error;
  }
}

export const Route = createFileRoute('/api/admin/deployments')({
  server: {
    handlers: {
      GET: ({ request }) => guarded(request, async () => ({ deployments: await readFleet() })),
      POST: ({ request }) =>
        guarded(request, async (gesture) => {
          const body = makeReadyInput.parse(await request.json().catch(() => null));
          return { deployment: await makeReady(body, gesture) };
        }),
    },
  },
});
