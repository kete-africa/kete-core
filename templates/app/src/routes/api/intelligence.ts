import { intelligenceResponse } from '@kete/intelligence/server';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { askStream } from '@/features/assistant';
import { asPerson } from '@/platform/rights';
import { personOf, tokenOf } from '@/platform/session';
import { recordUse } from '@/platform/usage';

const asked = z.object({
  question: z.string().trim().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) }))
    .max(24)
    .default([]),
  page: z.string().max(300).optional(),
});

// The address of Kete Intelligence's drawer (kete-core spec 101): a question, answered as a stream
// of the contract intelligence-event.v1, the whole turn within the person's rights.
export const Route = createFileRoute('/api/intelligence')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const identity = await personOf(request);
        if (!identity?.organizationId) return new Response(null, { status: 401 });
        const input = asked.safeParse(await request.json().catch(() => null));
        if (!input.success) return new Response(null, { status: 400 });
        const token = await tokenOf(request);
        const organizationId = identity.organizationId;
        await recordUse(organizationId, 'assistant_ask', identity.userId);
        return intelligenceResponse(
          askStream(
            { userId: identity.userId, organizationId },
            input.data.question,
            input.data.history,
            input.data.page,
          ),
          (work) => asPerson(identity, work, token),
        );
      },
    },
  },
});
