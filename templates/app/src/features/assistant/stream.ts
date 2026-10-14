import { memoriesFor, streamAgent } from '@kete/agents';
import type { Caller } from '@kete/capabilities';
import { refused, toIntelligence } from '@kete/intelligence/server';
import type { IntelligenceEvent } from '@kete/sdk';
import { getModel } from '@/platform/ai';
import { transaction } from '@/platform/db';
import { registry } from '@/platform/registry';
import { ASSISTANT, SYSTEM, type Turn } from './ask';

// Kete Intelligence's drawer (kete-core spec 101): the same question as « Demander », answered
// as it happens — each reading as it starts and ends, the words as they come — in the contract
// the drawer reads. The person's rights are those of the context the stream runs in.

/** A question asked from the drawer, streamed; to run within her rights (`asPerson`). */
export async function* askStream(
  person: { userId: string; organizationId: string },
  question: string,
  history: readonly Turn[] = [],
  /** The page she asks from. */
  page?: string,
): AsyncGenerator<IntelligenceEvent> {
  const model = getModel();
  if (!model) {
    yield* refused('not_connected');
    return;
  }
  const caller: Caller = {
    organizationId: person.organizationId,
    actor: {
      kind: 'agent',
      id: ASSISTANT,
      channel: 'chat',
      onBehalfOf: { kind: 'person', id: person.userId },
    },
  };
  // Readings only, as in « Demander »: a product may offer more (drafts) once it decides to.
  const tools = (await registry.tools(caller)).filter((tool) => tool.autonomy === 1);
  const remembered = await transaction(person.organizationId, (db) =>
    memoriesFor(db, person.userId),
  );
  const context = [
    `[Today: ${new Date().toISOString().slice(0, 10)}]`,
    ...(page ? [`[Page: ${page.slice(0, 300)}]`] : []),
  ].join('\n');
  yield* toIntelligence(
    streamAgent({
      agent: ASSISTANT,
      model,
      instructions: SYSTEM,
      remembered,
      tools,
      maxSteps: 6,
      messages: [
        ...history
          .slice(-12)
          .map((turn) => ({ role: turn.role, content: turn.text.slice(0, 2000) })),
        { role: 'user' as const, content: `${context}\n${question.slice(0, 2000)}` },
      ],
    }),
    { tools, draftHref: (draftId) => `/verification/${draftId}` },
  );
}
