import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/platform/auth';

// OpenID Connect discovery, at the issuer's root (the issuer is the Compte Kete's address):
// served by the OAuth provider through Better Auth (spec 007).
export const Route = createFileRoute('/.well-known/openid-configuration')({
  server: { handlers: { GET: ({ request }) => auth.handler(request) } },
});
