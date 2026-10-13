import type { CapabilityRegistry, Invocation } from './registry.js';

// A person's gesture on a screen (spec 093): the same capability an agent would call, under her
// rights. A broken rule of the business comes back as its code, never as a crash: the screen says
// what happened, why and what to do; an agent reads the code as is.

/**
 * A rule of the business a gesture broke: a code the screens word in clear and an agent reads as
 * is. Thrown by a domain function or a command; the command's transaction rolls back.
 */
export class RuleError extends Error {
  constructor(
    readonly code: string,
    /** Facts the message names: a label, an amount. Never a secret. */
    readonly facts: Record<string, string | number> = {},
  ) {
    super(code);
    this.name = 'RuleError';
  }
}

/** What a gesture gave a screen: its output, or the code of what stopped it. */
export type Outcome<T> =
  { ok: true; output: T } | { ok: false; code: string; facts: Record<string, string | number> };

/**
 * Runs a person's gesture through the registry and answers with its outcome: `done` is its
 * output; a refusal (`not_allowed`, `invalid_input`, `unknown_capability`) or a broken rule is its
 * code. The screen's own dialog has already confirmed what cannot be undone (`confirmed`).
 * Anything else that throws is a fault, and is thrown.
 */
export async function performGesture<T = unknown>(
  registry: Pick<CapabilityRegistry, 'invoke'>,
  invocation: Invocation,
  /** Runs the gesture with her rights (`asPerson`); default: as is. */
  within: <R>(work: () => Promise<R>) => Promise<R> = (work) => work(),
): Promise<Outcome<T>> {
  try {
    const result = await within(() => registry.invoke({ confirmed: true, ...invocation }));
    if (result.status === 'done') return { ok: true, output: result.output as T };
    if (result.status === 'refused') return { ok: false, code: result.reason, facts: {} };
    return { ok: false, code: 'not_possible', facts: {} };
  } catch (error) {
    if (error instanceof RuleError) return { ok: false, code: error.code, facts: error.facts };
    throw error;
  }
}
