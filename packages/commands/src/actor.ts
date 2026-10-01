import { z } from 'zod';

/** Who can act in a Kete service: a person, an AI agent, a service, or a connected app. */
export const actorKinds = ['person', 'agent', 'service', 'app'] as const;
export type ActorKind = (typeof actorKinds)[number];

/** Where a gesture came from. */
export const channels = [
  'web',
  'api',
  'mcp',
  /** A view an MCP host shows (MCP Apps): what a person does in it, not the model. */
  'view',
  'chat',
  'whatsapp',
  'telegram',
  'email',
  'worker',
  'script',
] as const;
export type Channel = (typeof channels)[number];

const actorRef = z.object({
  kind: z.enum(actorKinds),
  id: z.string().min(1).max(128),
});
export type ActorRef = z.infer<typeof actorRef>;

/** At most this many agents between the person and the agent that acts (doctrine D-039). */
export const MAX_DELEGATION_DEPTH = 4;

const agentRef = z.object({ kind: z.literal('agent'), id: z.string().min(1).max(128) });

/**
 * The actor of a gesture, always explicit (CONCEPTION 10): who acts, on behalf of whom, and through
 * which channel. An agent acting for a person names that person in `onBehalfOf`.
 *
 * An agent working for another agent carries its chain (doctrine D-039): `delegatedBy` lists the
 * agents that asked, from the first (the one the person asked) to the last, and the chain always
 * goes back to a person. `traceId` ties together every gesture of one delegated task.
 */
export const actorSchema = actorRef
  .extend({
    onBehalfOf: actorRef.optional(),
    delegatedBy: z.array(agentRef).min(1).max(MAX_DELEGATION_DEPTH).optional(),
    traceId: z
      .string()
      .regex(/^[A-Za-z0-9_.:-]{8,128}$/)
      .optional(),
    channel: z.enum(channels),
  })
  .superRefine((actor, context) => {
    if (!actor.delegatedBy) return;
    if (actor.kind !== 'agent') {
      context.addIssue({
        code: 'custom',
        path: ['delegatedBy'],
        message: 'Only an agent is asked by other agents.',
      });
    }
    if (actor.onBehalfOf?.kind !== 'person') {
      context.addIssue({
        code: 'custom',
        path: ['onBehalfOf'],
        message: 'A chain of agents always goes back to a person.',
      });
    }
    const ids = [...actor.delegatedBy.map((agent) => agent.id), actor.id];
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: 'custom',
        path: ['delegatedBy'],
        message: 'An agent appears only once in its chain.',
      });
    }
  });
export type Actor = z.infer<typeof actorSchema>;

/** A person decides; an agent, a service or an app only prepares or executes (doctrine). */
export function isHuman(actor: ActorRef): boolean {
  return actor.kind === 'person';
}
