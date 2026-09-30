/**
 * The lifecycle of every record that commits (CONCEPTION A.2): draft → to verify → validated →
 * (cancelled | archived). Nothing is deleted: it is archived (A.6). A draft has no effect —
 * no totals, no notification, no statistics — until it is validated.
 */
export const recordStates = ['draft', 'to_verify', 'validated', 'cancelled', 'archived'] as const;
export type RecordState = (typeof recordStates)[number];

const next: Record<RecordState, readonly RecordState[]> = {
  // A person may validate what she typed herself; what an agent prepared goes to verification.
  draft: ['to_verify', 'validated', 'archived'],
  // Verified and validated, or sent back to draft for more work.
  to_verify: ['validated', 'draft', 'archived'],
  validated: ['cancelled', 'archived'],
  cancelled: ['archived'],
  archived: [],
};

export function canTransition(from: RecordState, to: RecordState): boolean {
  return next[from].includes(to);
}

export class TransitionError extends Error {
  constructor(
    readonly from: RecordState,
    readonly to: RecordState,
  ) {
    super(`A record cannot go from "${from}" to "${to}".`);
    this.name = 'TransitionError';
  }
}

export function assertTransition(from: RecordState, to: RecordState): void {
  if (!canTransition(from, to)) throw new TransitionError(from, to);
}

/** The states in which a record counts: totals, notifications and statistics ignore the others. */
export function isEffective(state: RecordState): boolean {
  return state === 'validated';
}
