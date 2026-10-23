import { createFileRoute } from '@tanstack/react-router';
import { grantStandingMandate } from '@/features/apps/standing-mandates';
import { appApiResponse } from '@/features/apps/people';

// Spec 150: a person lets one of the center's agents act for her while she is away.
export const Route = createFileRoute('/api/apps/standing-mandates')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const grant = await grantStandingMandate(request);
          return Response.json(grant, { status: 201, headers: { 'cache-control': 'no-store' } });
        } catch (error) {
          return appApiResponse(error);
        }
      },
    },
  },
});
