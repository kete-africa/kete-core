import type { KeteEvent, Manifest } from '../contracts/types.gen.js';
import { recordEvent } from '../outbox/record.js';
import type { SqlExecutor } from '../outbox/sql.js';
import { createEvent, type EventData } from './create.js';

export interface EmitInput<T extends string> {
  type: T;
  organization: string;
  data: EventData<T>;
  occurredAt?: Date;
}

/**
 * The app-facing entry point: events carry the app's product and may only use the types its
 * manifest declares.
 */
export function createEmitter(manifest: Manifest) {
  const build = <T extends string>(input: EmitInput<T>): KeteEvent =>
    createEvent({
      ...input,
      product: manifest.product,
      declaredTypes: manifest.events,
    });

  return {
    /** Builds and validates an event without recording it. */
    build,
    /**
     * Records an event in the caller's transaction, with the business change it announces — in
     * `kete_outbox`, or the outbox named (spec 049). Returns the recorded event.
     */
    async record<T extends string>(
      db: SqlExecutor,
      input: EmitInput<T>,
      options: { outbox?: string } = {},
    ): Promise<KeteEvent> {
      const event = build(input);
      await recordEvent(db, event, options);
      return event;
    },
  };
}

export type Emitter = ReturnType<typeof createEmitter>;
