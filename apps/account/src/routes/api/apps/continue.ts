import { createFileRoute } from '@tanstack/react-router';
import { continueSignIn } from '@/features/apps/people';

// Spec 013: where a one-time sign-in link lands once it signed the person in.
export const Route = createFileRoute('/api/apps/continue')({
  server: { handlers: { GET: ({ request }) => continueSignIn(request) } },
});
