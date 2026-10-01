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

/**
 * The actor of a gesture, always explicit (CONCEPTION 10): who acts, on behalf of whom, and through
 * which channel. An agent acting for a person names that person in `onBehalfOf`.
 */
export const actorSchema = actorRef.extend({
  onBehalfOf: actorRef.optional(),
  channel: z.enum(channels),
});
export type Actor = z.infer<typeof actorSchema>;

/** A person decides; an agent, a service or an app only prepares or executes (doctrine). */
export function isHuman(actor: ActorRef): boolean {
  return actor.kind === 'person';
}
