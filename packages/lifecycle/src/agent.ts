import { nextRun, type Routine } from '@kete/time';

// An agent at work (spec 105; doctrine D-045, D-053): its six states and what moves it between
// them, the budget it may spend, what wakes it — a routine or an app's event — and the autonomy it
// earns gesture by gesture, by proofs: what people accepted of its work, untouched. It proposes a
// higher level; its owner raises it.

export type AgentState = 'asleep' | 'working' | 'waiting' | 'blocked' | 'paused' | 'stopped';

/**
 * trigger: a routine or an event woke it. needs_person: it waits for her answer or her decision.
 * answered: she answered. blocked: something it needs is missing. unblocked: it is there again.
 * done: its run ended. pause, resume, stop: its owner's gestures. budget_exhausted: it spent all.
 */
export type AgentSignal =
  | 'trigger'
  | 'needs_person'
  | 'answered'
  | 'blocked'
  | 'unblocked'
  | 'done'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'budget_exhausted';

const moves: Partial<Record<AgentState, Partial<Record<AgentSignal, AgentState>>>> = {
  asleep: { trigger: 'working' },
  working: {
    needs_person: 'waiting',
    blocked: 'blocked',
    done: 'asleep',
    budget_exhausted: 'paused',
  },
  waiting: { answered: 'working' },
  blocked: { unblocked: 'working' },
  paused: { resume: 'asleep' },
};

/** Where a signal moves it; a signal that means nothing in its state leaves it there. Stopped is final. */
export function nextState(state: AgentState, signal: AgentSignal): AgentState {
  if (state === 'stopped') return 'stopped';
  if (signal === 'stop') return 'stopped';
  if (signal === 'pause') return 'paused';
  return moves[state]?.[signal] ?? state;
}

/** What it may still spend, in the unit its budget is counted in (tokens, francs). */
export function budgetOf(
  spent: number,
  limit: number,
): {
  left: number;
  ratio: number;
  state: 'ok' | 'low' | 'exhausted';
} {
  const ratio = limit > 0 ? spent / limit : 1;
  return {
    left: Math.max(limit - spent, 0),
    ratio,
    state: ratio >= 1 ? 'exhausted' : ratio >= 0.8 ? 'low' : 'ok',
  };
}

/** What wakes it: a routine, or an app's event — of a type, with what its data must say. */
export type Trigger =
  | { kind: 'routine'; routine: Routine }
  | { kind: 'event'; type: string; when?: Record<string, string | number | boolean> };

/** Whether an event wakes it. */
export function wokenBy(
  triggers: readonly Trigger[],
  event: { type: string; data?: Record<string, unknown> },
): boolean {
  return triggers.some(
    (trigger) =>
      trigger.kind === 'event' &&
      trigger.type === event.type &&
      Object.entries(trigger.when ?? {}).every(([key, value]) => event.data?.[key] === value),
  );
}

/** When its routines wake it next, after a moment; null without a routine. */
export function nextWake(
  triggers: readonly Trigger[],
  after: number,
  offsetMinutes = 0,
): number | null {
  const runs = triggers.flatMap((trigger) =>
    trigger.kind === 'routine' ? [nextRun(trigger.routine, after, offsetMinutes)] : [],
  );
  return runs.length ? Math.min(...runs) : null;
}

/** What a person did with a piece of its work. */
export interface Decision {
  gesture: string;
  outcome: 'accepted' | 'corrected' | 'refused';
}

export interface AutonomyProof {
  gesture: string;
  /** The decisions weighed: the last `needed`. */
  weighed: number;
  accepted: number;
  corrected: number;
  refused: number;
  /** Whether it may propose the level above to its owner. */
  eligible: boolean;
}

/**
 * Whether its work on one gesture earned the level above: the last `needed` decisions, none
 * refused, few corrected. A proof is a proposal to its owner — never a level it takes.
 */
export function autonomyProof(
  decisions: readonly Decision[],
  gesture: string,
  options: { needed?: number; maxCorrected?: number } = {},
): AutonomyProof {
  const needed = options.needed ?? 20;
  const recent = decisions.filter((d) => d.gesture === gesture).slice(-needed);
  const count = (outcome: Decision['outcome']) =>
    recent.filter((d) => d.outcome === outcome).length;
  const corrected = count('corrected');
  const refused = count('refused');
  return {
    gesture,
    weighed: recent.length,
    accepted: count('accepted'),
    corrected,
    refused,
    eligible:
      recent.length >= needed &&
      refused === 0 &&
      corrected / needed <= (options.maxCorrected ?? 0.1),
  };
}
