import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/platform/auth';

// Better Auth's endpoints, including the published keys at /api/auth/jwks.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
