import type { Gesture, Policy, PolicyDecision } from '@kete/sdk';
import type { Entity, PolicyEngine } from './engine.js';

// A table of gestures and the effect each must have (spec 112): what catches a contradiction
// between two policies, in the tests and when an administrator saves a policy — Cedar's symbolic
// analysis is not in its WebAssembly build (first-check.md).

export interface Expectation {
  /** What the case says, as a person reads it: « l'agent écrit à 21 h ». */
  name: string;
  gesture: Gesture;
  effect: PolicyDecision['effect'];
}

export interface Mismatch {
  name: string;
  expected: PolicyDecision['effect'];
  got: PolicyDecision;
}

/** The cases whose decision is not the expected one, under the given policies. */
export function unmet(
  engine: PolicyEngine,
  policies: readonly Policy[],
  entities: readonly Entity[],
  expectations: readonly Expectation[],
): Mismatch[] {
  return expectations.flatMap((expectation) => {
    const got = engine.decide({ policies, gesture: expectation.gesture, entities });
    return got.effect === expectation.effect
      ? []
      : [{ name: expectation.name, expected: expectation.effect, got }];
  });
}
