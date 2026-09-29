import { createFileRoute } from '@tanstack/react-router';
import { appApiResponse, provisionPerson, requireApp } from '@/features/apps/people';

// Spec 013: a trusted Kete app provisions a person by the phone number a channel proved.
export const Route = createFileRoute('/api/apps/people')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireApp(request);
          const body: unknown = await request.json().catch(() => null);
          const result = await provisionPerson((body ?? {}) as { phoneNumber: string });
          return Response.json(result, { headers: { 'cache-control': 'no-store' } });
        } catch (error) {
          return appApiResponse(error);
        }
      },
    },
  },
});
