import { createFileRoute } from '@tanstack/react-router';
import { appApiResponse, createSignInLink, requireApp } from '@/features/apps/people';

// Spec 013: a one-time sign-in link for a person the app provisioned, landing on its own origin.
export const Route = createFileRoute('/api/apps/sign-in-links')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const app = await requireApp(request);
          const body: unknown = await request.json().catch(() => null);
          const link = await createSignInLink(
            app,
            (body ?? {}) as { personId: string; returnTo: string },
          );
          return Response.json(link, { headers: { 'cache-control': 'no-store' } });
        } catch (error) {
          return appApiResponse(error);
        }
      },
    },
  },
});
