import type { KeteEvent } from '../contracts/types.gen.js';
import { validateEvent, validateEventData } from '../contracts/validate.js';
import { newEventId } from './ids.js';
import { isStandardEventType, standardEventTypes, type StandardEventDataMap } from './standard.js';

/** Maximum size of one serialized event. */
export const MAX_EVENT_BYTES = 16 * 1024;

export class InvalidEventError extends Error {
  constructor(
    readonly code: 'invalid_payload' | 'undeclared_type' | 'too_large',
    readonly details: string[] = [],
  ) {
    super(`${code}${details.length ? `: ${details.join('; ')}` : ''}`);
    this.name = 'InvalidEventError';
  }
}

export type EventData<T extends string> = T extends keyof StandardEventDataMap
  ? StandardEventDataMap[T]
  : Record<string, unknown>;

export interface CreateEventInput<T extends string> {
  type: T;
  product: string;
  organization: string;
  data: EventData<T>;
  occurredAt?: Date;
  /** The event types the app's manifest declares; anything else is refused. */
  declaredTypes: readonly string[];
}

/** Builds and validates an event envelope. Nothing invalid ever reaches the outbox. */
export function createEvent<T extends string>(input: CreateEventInput<T>): KeteEvent {
  if (!input.declaredTypes.includes(input.type)) {
    throw new InvalidEventError('undeclared_type', [input.type]);
  }
  const event: KeteEvent = {
    id: newEventId(),
    type: input.type,
    specversion: '1',
    product: input.product,
    organization: input.organization,
    occurred_at: (input.occurredAt ?? new Date()).toISOString(),
    data: input.data as Record<string, unknown>,
  };
  const envelope = validateEvent(event);
  if (!envelope.ok) throw new InvalidEventError('invalid_payload', envelope.errors);
  if (isStandardEventType(input.type)) {
    const data = validateEventData(standardEventTypes[input.type], input.data);
    if (!data.ok) throw new InvalidEventError('invalid_payload', data.errors);
  }
  if (Buffer.byteLength(JSON.stringify(event)) > MAX_EVENT_BYTES) {
    throw new InvalidEventError('too_large');
  }
  return event;
}
