import { runAgent, type AgentAnswer, type AgentTurn } from './runtime.js';

// Evaluations of an agent (spec 090): cases played through the same turn as in production, each
// with what must hold — the capabilities it calls or never calls, what its words must say or
// never say — and a threshold under which the run fails. Checks are code: a figure, a forbidden
// advice, a tool never offered. A judge model is never needed to know whether a rule was kept.

export interface EvaluationCase {
  /** A short name, for the report. */
  name: string;
  /** What she says, in order; the last one is answered. */
  messages: AgentTurn['messages'];
  expect: {
    /** Capabilities that must have been called. */
    calls?: readonly string[];
    /** Capabilities that must never have been called. */
    neverCalls?: readonly string[];
    /** A gesture that must have been prepared, never done: a draft of this capability. */
    prepares?: readonly string[];
    /** What the words must say: each pattern must match. */
    says?: readonly RegExp[];
    /** What the words must never say: no pattern may match. */
    neverSays?: readonly RegExp[];
  };
}

export interface CaseResult {
  name: string;
  passed: boolean;
  /** Each check that failed, in words. */
  failures: string[];
  answer: Pick<AgentAnswer, 'text' | 'calls'> | null;
}

export interface EvaluationReport {
  /** Cases passed over cases played, from 0 to 1. */
  score: number;
  passed: boolean;
  cases: CaseResult[];
}

/** The checks of one case against one answer. */
export function judge(expect: EvaluationCase['expect'], answer: AgentAnswer): string[] {
  const failures: string[] = [];
  const called = new Set(answer.calls.map((call) => call.name));
  for (const name of expect.calls ?? []) {
    if (!called.has(name)) failures.push(`did not call ${name}`);
  }
  for (const name of expect.neverCalls ?? []) {
    if (called.has(name)) failures.push(`called ${name}`);
  }
  for (const name of expect.prepares ?? []) {
    const call = answer.calls.find((one) => one.name === name);
    if (call?.status !== 'draft') failures.push(`did not prepare ${name}`);
  }
  for (const pattern of expect.says ?? []) {
    if (!pattern.test(answer.text)) failures.push(`does not say ${String(pattern)}`);
  }
  for (const pattern of expect.neverSays ?? []) {
    if (pattern.test(answer.text)) failures.push(`says ${String(pattern)}`);
  }
  return failures;
}

/**
 * Plays every case on the same turn — its model, its instructions, its tools — and scores the
 * run. It fails under the threshold (every case must pass by default). A case that throws is a
 * failed case, not a failed run.
 */
export async function evaluateAgent(options: {
  turn: Omit<AgentTurn, 'messages'>;
  cases: readonly EvaluationCase[];
  /** The share of cases that must pass, from 0 to 1 (default 1). */
  threshold?: number;
}): Promise<EvaluationReport> {
  const cases: CaseResult[] = [];
  for (const one of options.cases) {
    try {
      const answer = await runAgent({ ...options.turn, messages: one.messages });
      const failures = judge(one.expect, answer);
      cases.push({
        name: one.name,
        passed: failures.length === 0,
        failures,
        answer: { text: answer.text, calls: answer.calls },
      });
    } catch (error) {
      cases.push({
        name: one.name,
        passed: false,
        failures: [`failed: ${(error as Error).message}`],
        answer: null,
      });
    }
  }
  const score = cases.length === 0 ? 0 : cases.filter((one) => one.passed).length / cases.length;
  return { score, passed: score >= (options.threshold ?? 1), cases };
}
