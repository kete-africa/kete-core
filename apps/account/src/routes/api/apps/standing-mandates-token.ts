import { createFileRoute } from '@tanstack/react-router';
import { useStandingMandate } from '@/features/apps/standing-mandates';
import { appApiResponse } from '@/features/apps/people';

// Spec 150: the agent's mandate for now, from its standing grant — her claims read again.
export const Route = createFileRoute('/api/apps/standing-mandates/token')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const mandate = await useStandingMandate(request);
          return Response.json(mandate, { status: 201, headers: { 'cache-control': 'no-store' } });
        } catch (error) {
          return appApiResponse(error);
        }
      },
    },
  },
});
