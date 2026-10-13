import type { AgentEvent } from '@kete/agents';
import type { IntelligenceEvent } from '@kete/sdk';

// The server half of Kete Intelligence (spec 101): a turn of the agents' runtime (@kete/agents)
// told as the contract `intelligence-event.v1`, one JSON line per event, so that the drawer is
// drawn the same way in the center and in every app. No word here: a reason travels as a code,
// the screen words it from the product's catalogs.

/** A capability the agent may call, as its turn was given it: its name and its autonomy. */
export interface IntelligenceTool {
  name: string;
  autonomy: 1 | 2 | 3 | 4;
}

export interface IntelligenceOptions {
  /** The capabilities offered to the turn: each call's level is read from them. */
  tools: readonly IntelligenceTool[];
  /** Where a draft is verified, for a draft a capability prepared. */
  draftHref?: (draftId: string) => string;
  /** A source of the answer, for a reading the product can open; none by default. */
  sourceOf?: (call: { name: string; output: unknown }) => { label: string; href?: string } | null;
  /** The clock, for the length of the turn (tests set it). */
  now?: () => number;
}

/**
 * The events of a turn, as the contract says them: each capability as it starts and as it ends
 * (with its level), a draft that waits for the person, the sources, the words as they come, and
 * the end — `done`, `waiting` when a gesture waits for her confirmation, or `failed` with its code.
 */
export async function* toIntelligence(
  events: AsyncIterable<AgentEvent>,
  options: IntelligenceOptions,
): AsyncGenerator<IntelligenceEvent> {
  const now = options.now ?? Date.now;
  const started = now();
  const level = (name: string) => options.tools.find((tool) => tool.name === name)?.autonomy ?? 1;
  let calls = 0;
  let count = 0;
  const running = new Map<string, string[]>();
  const nextId = (name: string) => {
    count += 1;
    const id = `t${count}`;
    running.set(name, [...(running.get(name) ?? []), id]);
    return id;
  };
  const endId = (name: string) => {
    const ids = running.get(name) ?? [];
    const id = ids.shift();
    running.set(name, ids);
    return id ?? nextId(name);
  };
  for await (const event of events) {
    if (event.type === 'text') {
      if (event.delta) yield { type: 'text', delta: event.delta };
    } else if (event.type === 'calling') {
      yield {
        type: 'tool',
        id: nextId(event.name),
        name: event.name,
        level: level(event.name),
        state: 'running',
      };
    } else if (event.type === 'call') {
      calls += 1;
      yield {
        type: 'tool',
        id: endId(event.name),
        name: event.name,
        level: level(event.name),
        state: event.status === 'failed' ? 'failed' : 'done',
        summary: event.status,
      };
      if (event.status === 'draft' && event.draftId) {
        yield {
          type: 'draft',
          draft_id: event.draftId,
          title: event.name,
          ...(options.draftHref ? { href: options.draftHref(event.draftId) } : {}),
        };
      }
      if (event.status === 'confirmation_required') {
        yield { type: 'waiting', reason: 'confirmation_required' };
      }
      if (event.status === 'done') {
        const source = options.sourceOf?.({ name: event.name, output: event.output });
        if (source) yield { type: 'source', ...source };
      }
    } else if (event.type === 'done') {
      yield { type: 'done', tools: calls, ms: Math.max(0, Math.round(now() - started)) };
    } else if (event.type === 'stopped') {
      yield { type: 'failed', reason: event.reason };
    }
  }
}

/**
 * Runs `work` within the person's context (her rights): the whole turn must run inside it, not
 * only its start, since the capabilities it calls are checked as they are called.
 */
export type Within = (work: () => Promise<void>) => Promise<unknown>;

/** One JSON line per event: the body of the drawer's stream. */
export function ndjson(
  events: AsyncIterable<IntelligenceEvent>,
  within?: Within,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const line = (event: IntelligenceEvent) => encoder.encode(`${JSON.stringify(event)}\n`);
  if (within) {
    // Driven from inside her context: each event is pushed as it comes.
    return new ReadableStream<Uint8Array>({
      start(controller) {
        void within(async () => {
          for await (const event of events) controller.enqueue(line(event));
        })
          .catch(() => controller.enqueue(line({ type: 'failed', reason: 'failed' })))
          .finally(() => controller.close());
      },
    });
  }
  const iterator = events[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next();
      if (next.done) controller.close();
      else controller.enqueue(line(next.value));
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

/** The answer of the drawer's address: its stream, never cached. */
export function intelligenceResponse(
  events: AsyncIterable<IntelligenceEvent>,
  within?: Within,
): Response {
  return new Response(ndjson(events, within), {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

/** A turn that cannot start — no model, no budget — said as a stream of one event. */
export async function* refused(reason: string): AsyncGenerator<IntelligenceEvent> {
  yield { type: 'failed', reason };
}
