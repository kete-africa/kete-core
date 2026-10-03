import { createFileRoute } from '@tanstack/react-router';
import { issueMandate } from '@/features/apps/mandates';
import { appApiResponse } from '@/features/apps/people';

// Spec 049: the center exchanges a person's token for a mandate one of its agents carries.
export const Route = createFileRoute('/api/apps/mandates')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const mandate = await issueMandate(request);
          return Response.json(mandate, { status: 201, headers: { 'cache-control': 'no-store' } });
        } catch (error) {
          return appApiResponse(error);
        }
      },
    },
  },
});
