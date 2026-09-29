import { createFileRoute } from '@tanstack/react-router';
import { appApiResponse, readAccess, requireApp } from '@/features/apps/people';

// Spec 014: a trusted Kete app reads which apps an organization may use, and until when.
export const Route = createFileRoute('/api/apps/access')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await requireApp(request);
          const organizationId = new URL(request.url).searchParams.get('organizationId') ?? '';
          return Response.json(
            { access: await readAccess(organizationId) },
            { headers: { 'cache-control': 'no-store' } },
          );
        } catch (error) {
          return appApiResponse(error);
        }
      },
    },
  },
});
