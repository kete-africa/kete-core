import { createFileRoute } from '@tanstack/react-router';
import { receiveNotification } from '@/features/payments/billing';

// The payment provider's notifications. The raw body is what is signed: it is read as text,
// never re-serialized. 401 for anything not genuine; 200 once handled (or already handled), so
// the provider stops retrying; an error lets it retry.
export const Route = createFileRoute('/api/payments/notifications')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text();
        const result = await receiveNotification(body, request.headers);
        if (result.status === 'refused') return new Response(null, { status: 401 });
        if (result.status === 'applied' && result.outcome.status === 'rejected') {
          // Paid, but not what was agreed: kept pending for an operator, never granted.
          console.warn(`[payments] sale kept for review: ${result.outcome.reason}`);
        }
        return Response.json({ ok: true });
      },
    },
  },
});
