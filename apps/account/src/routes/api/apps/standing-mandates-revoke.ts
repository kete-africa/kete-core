import { createFileRoute } from '@tanstack/react-router';
import { revokeStandingMandate } from '@/features/apps/standing-mandates';
import { appApiResponse } from '@/features/apps/people';

// Spec 150: the center withdraws a standing mandate — the agent removed, or she withdrew it there.
export const Route = createFileRoute('/api/apps/standing-mandates/revoke')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await revokeStandingMandate(request);
          return new Response(null, { status: 204 });
        } catch (error) {
          return appApiResponse(error);
        }
      },
    },
  },
});
