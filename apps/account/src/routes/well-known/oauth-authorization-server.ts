import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/platform/auth';

// OAuth 2.0 authorization server metadata (RFC 8414), at the issuer's root (spec 007).
export const Route = createFileRoute('/.well-known/oauth-authorization-server')({
  server: { handlers: { GET: ({ request }) => auth.handler(request) } },
});
