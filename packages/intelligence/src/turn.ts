import type { IntelligenceEvent } from '@kete/sdk';

// The screen half of Kete Intelligence (spec 101): the stream read line by line, and a turn
// rebuilt from its events — what the drawer draws. Pure: no React, no word.

export interface TurnTool {
  id: string;
  name: string;
  level: number;
  state: 'running' | 'done' | 'failed';
  /** What it was called with, as the stream said it. */
  input?: string;
  summary?: string;
}

/** A question and everything its answer showed, as the events came. */
export interface Turn {
  id: string;
  question: string;
  /** What it does now, when the product said it. */
  status?: string;
  plan: { step: string; state: 'waiting' | 'running' | 'done' | 'skipped' }[];
  tools: TurnTool[];
  drafts: { id: string; title: string; href?: string }[];
  sources: { label: string; href?: string }[];
  text: string;
  /** running while it answers; then done, waiting for her, stopped by her, or failed. */
  state: 'running' | 'done' | 'waiting' | 'stopped' | 'failed';
  /** A code: why it waits or failed. */
  reason?: string;
  /** How long it took and how many capabilities it called, once done. */
  ms?: number;
  /** When it was asked, in milliseconds: the drawer counts the seconds. */
  startedAt?: number;
}

export function newTurn(id: string, question: string, startedAt?: number): Turn {
  return {
    id,
    question,
    plan: [],
    tools: [],
    drafts: [],
    sources: [],
    text: '',
    state: 'running',
    ...(startedAt !== undefined ? { startedAt } : {}),
  };
}

/** The turn after one more event. */
export function reduceTurn(turn: Turn, event: IntelligenceEvent): Turn {
  switch (event.type) {
    case 'status':
      return { ...turn, status: event.text };
    case 'plan':
      return { ...turn, plan: event.steps.map((step) => ({ step, state: 'waiting' })) };
    case 'step':
      return {
        ...turn,
        plan: turn.plan.map((item, index) =>
          index === event.index
            ? { ...item, state: event.state === 'running' ? 'running' : event.state }
            : item,
        ),
      };
    case 'tool': {
      const tool: TurnTool = {
        id: event.id,
        name: event.name,
        level: event.level,
        state: event.state,
        ...(event.input ? { input: event.input } : {}),
        ...(event.summary ? { summary: event.summary } : {}),
      };
      const known = turn.tools.some((item) => item.id === event.id);
      return {
        ...turn,
        tools: known
          ? turn.tools.map((item) => (item.id === event.id ? tool : item))
          : [...turn.tools, tool],
      };
    }
    case 'draft':
      return {
        ...turn,
        drafts: [
          ...turn.drafts,
          { id: event.draft_id, title: event.title, ...(event.href ? { href: event.href } : {}) },
        ],
      };
    case 'source':
      return {
        ...turn,
        sources: [
          ...turn.sources,
          { label: event.label, ...(event.href ? { href: event.href } : {}) },
        ],
      };
    case 'text':
      return { ...turn, text: turn.text + event.delta };
    case 'waiting':
      return { ...turn, state: 'waiting', reason: event.reason };
    case 'done':
      return {
        ...turn,
        state: turn.state === 'waiting' ? 'waiting' : 'done',
        ...(event.ms !== undefined ? { ms: event.ms } : {}),
      };
    case 'failed':
      return { ...turn, state: 'failed', reason: event.reason };
  }
}

/** The events of a stream of JSON lines, as they arrive; a line that is not an event is skipped. */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<IntelligenceEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const parse = (line: string): IntelligenceEvent | null => {
    if (!line.trim()) return null;
    try {
      const event = JSON.parse(line) as { type?: unknown };
      return typeof event.type === 'string' ? (event as IntelligenceEvent) : null;
    } catch {
      return null;
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const event = parse(line);
      if (event) yield event;
    }
  }
  const last = parse(buffer);
  if (last) yield last;
}
