import { metricsResponse } from '@kete/metrics/server';
import { createFileRoute } from '@tanstack/react-router';
import { metrics } from '@/platform/metrics';
import { asPerson } from '@/platform/rights';
import { personOf, tokenOf } from '@/platform/session';

// The app's figures (kete-core spec 103): `?names=tasks.open&period=30d&compare=1`, read for the
// person whose session or token comes, within her rights — the center's boards read them here.
export const Route = createFileRoute('/api/metrics')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const identity = await personOf(request);
        if (!identity?.organizationId) return new Response(null, { status: 401 });
        const token = await tokenOf(request);
        return metricsResponse(metrics, request, {
          today: new Date().toISOString().slice(0, 10),
          within: (work) => asPerson(identity, work, token),
        });
      },
    },
  },
});
