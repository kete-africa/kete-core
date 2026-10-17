import { createFileRoute } from '@tanstack/react-router';
import {
  organizationLayer,
  personLayer,
  personOfToken,
  savePreference,
  SettingsApiError,
} from '@/features/settings/layers';

// Spec 115: an app reads the organization's and the person's layers of Kete's settings with her
// token, and saves one of her preferences, so it follows her in every app.

const refused = (error: unknown) => {
  if (error instanceof SettingsApiError) {
    return Response.json({ error: error.code }, { status: error.status });
  }
  throw error;
};
const noStore = { 'cache-control': 'no-store' };

export const Route = createFileRoute('/api/apps/settings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const identity = await personOfToken(request);
          const [organization, person] = await Promise.all([
            organizationLayer(identity.organizationId ?? ''),
            personLayer(identity.userId),
          ]);
          return Response.json({ organization, person }, { headers: noStore });
        } catch (error) {
          return refused(error);
        }
      },
      PUT: async ({ request }) => {
        try {
          const identity = await personOfToken(request);
          const body = ((await request.json().catch(() => null)) ?? {}) as {
            key?: unknown;
            value?: unknown;
          };
          const person = await savePreference(identity, body);
          return Response.json({ person }, { headers: noStore });
        } catch (error) {
          return refused(error);
        }
      },
    },
  },
});
