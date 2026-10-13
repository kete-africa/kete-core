import { intake, type IntakeSource } from '@kete/ai';
import type { KeteIdentity } from '@kete/auth';
import type { z } from 'zod';
import { getModel } from './ai';
import { registry } from './registry';

/** The reading agent: it reads for the person, and only prepares — she decides. */
const READER = { kind: 'agent' as const, id: 'agt_intake' };

export type Intaken =
  | { status: 'draft'; draftId: string }
  /** What the source does not give: she types the record herself. */
  | { status: 'incomplete'; missing: string[] }
  | { status: 'not_connected' }
  | { status: 'refused'; reason: string };

/**
 * What was received — a message, a photo, a voice note, a document — becomes a draft of a
 * capability (kete-core spec 098): a model reads it into the record's fields, every value with
 * its source, its certainty and the passage it was read in; the draft waits for the person, who
 * corrects and validates it. What the source does not give, she types: the reading never guesses.
 * Run within her rights (`asPerson`): the reading agent has no more than she has.
 */
export async function readIntoDraft<Shape extends z.ZodRawShape>(options: {
  identity: KeteIdentity;
  /** The capability whose draft it prepares: `tasks_create`. */
  capability: string;
  schema: z.ZodObject<Shape>;
  source: IntakeSource;
  /** What the record is, in a sentence, for the reading. */
  context?: string;
  evidence?: string;
}): Promise<Intaken> {
  const model = getModel();
  if (!model || !options.identity.organizationId) return { status: 'not_connected' };
  const read = await intake({
    model,
    schema: options.schema,
    source: options.source,
    by: READER,
    ...(options.context ? { context: options.context } : {}),
    ...(options.evidence ? { evidence: options.evidence } : {}),
  });
  if (read.missing.length > 0) {
    return { status: 'incomplete', missing: read.missing };
  }
  const result = await registry.invoke({
    organizationId: options.identity.organizationId,
    actor: {
      ...READER,
      channel: 'web',
      onBehalfOf: { kind: 'person', id: options.identity.userId },
    },
    name: options.capability,
    input: read.values,
    provenance: read.provenance,
  });
  if (result.status === 'draft') return { status: 'draft', draftId: result.draftId };
  return { status: 'refused', reason: result.status === 'refused' ? result.reason : result.status };
}
