import { createFileRoute } from '@tanstack/react-router';
import { registerAppForFactory } from '@/features/apps/factory';
import { appApiResponse } from '@/features/apps/people';

// Spec 048: the app factory registers an app it created; its secret is returned once.
export const Route = createFileRoute('/api/apps/clients')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const client = await registerAppForFactory(request);
          return Response.json(client, { status: 201, headers: { 'cache-control': 'no-store' } });
        } catch (error) {
          return appApiResponse(error);
        }
      },
    },
  },
});
