import { actorSchema, isHuman, type Actor, type ActorRef } from '@kete/commands';
import { newId, type DefinedRecord } from '@kete/records';
import type { SqlExecutor } from '@kete/tenancy';
import type { z } from 'zod';

/** Where a field's value came from (CONCEPTION A.3). */
export const provenanceSources = [
  'typed',
  'system',
  'message',
  'photo',
  'voice',
  'document',
  'inferred',
  'import',
] as const;
export type ProvenanceSource = (typeof provenanceSources)[number];

/** What a verification card shows next to each field: from where, by whom, how sure. */
export interface FieldProvenance {
  source: ProvenanceSource;
  by: ActorRef;
  certainty?: 'high' | 'medium' | 'low';
  /** What the value was read from: a file, a message, a transcript (an identifier). */
  evidence?: string;
}

export type DraftStatus = 'prepared' | 'validated' | 'refused';
type Values = Record<string, unknown>;

export interface Draft {
  draftId: string;
  /** A record not created yet, or a change proposed to an existing record. */
  kind: 'record' | 'change';
  recordType: string;
  recordId: string | null;
  baseVersion: string | null;
  /** What was prepared, never changed afterwards. */
  prepared: Values;
  /** What validation will apply: the prepared values, corrected by a person. */
  proposed: Values;
  provenance: Record<string, FieldProvenance>;
  status: DraftStatus;
  preparedBy: ActorRef;
  onBehalfOf: ActorRef | null;
  decidedBy: ActorRef | null;
  decidedAt: Date | null;
  refusalReason: string | null;
  /** Field by field, what the person changed before validating: learning material. */
  corrections: Record<string, { prepared: unknown; validated: unknown }> | null;
  result: unknown;
  createdAt: Date;
}

export class DraftError extends Error {
  constructor(
    readonly code:
      'not_found' | 'already_decided' | 'human_required' | 'invalid_values' | 'invalid_provenance',
    message: string,
    readonly issues?: z.ZodError['issues'],
  ) {
    super(message);
    this.name = 'DraftError';
  }
}

interface DraftRow extends Record<string, unknown> {
  draft_id: string;
  kind: 'record' | 'change';
  record_type: string;
  record_id: string | null;
  base_version: string | null;
  prepared: Values;
  proposed: Values;
  provenance: Record<string, FieldProvenance>;
  status: DraftStatus;
  prepared_by_kind: ActorRef['kind'];
  prepared_by_id: string;
  on_behalf_of_kind: ActorRef['kind'] | null;
  on_behalf_of_id: string | null;
  decided_by_kind: 'person' | null;
  decided_by_id: string | null;
  decided_at: Date | null;
  refusal_reason: string | null;
  corrections: Draft['corrections'];
  result: unknown;
  created_at: Date;
}

const columns = `draft_id, kind, record_type, record_id, base_version, prepared, proposed, provenance,
  status, prepared_by_kind, prepared_by_id, on_behalf_of_kind, on_behalf_of_id, decided_by_kind,
  decided_by_id, decided_at, refusal_reason, corrections, result, created_at`;

function toDraft(row: DraftRow): Draft {
  return {
    draftId: row.draft_id,
    kind: row.kind,
    recordType: row.record_type,
    recordId: row.record_id,
    baseVersion: row.base_version,
    prepared: row.prepared,
    proposed: row.proposed,
    provenance: row.provenance,
    status: row.status,
    preparedBy: { kind: row.prepared_by_kind, id: row.prepared_by_id },
    onBehalfOf:
      row.on_behalf_of_kind && row.on_behalf_of_id
        ? { kind: row.on_behalf_of_kind, id: row.on_behalf_of_id }
        : null,
    decidedBy:
      row.decided_by_kind && row.decided_by_id
        ? { kind: row.decided_by_kind, id: row.decided_by_id }
        : null,
    decidedAt: row.decided_at ? new Date(row.decided_at) : null,
    refusalReason: row.refusal_reason,
    corrections: row.corrections,
    result: row.result,
    createdAt: new Date(row.created_at),
  };
}

function checkActor(actor: Actor): Actor {
  const parsed = actorSchema.safeParse(actor);
  if (!parsed.success) throw new TypeError('The actor is not valid.');
  return parsed.data;
}

function checkValues(
  definition: DefinedRecord<z.ZodObject> | undefined,
  values: Values,
  complete: boolean,
): Values {
  if (!definition) return values;
  const schema = complete ? definition.schema : definition.schema.partial();
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    throw new DraftError(
      'invalid_values',
      `The values do not fit a ${definition.type}.`,
      parsed.error.issues,
    );
  }
  return parsed.data as Values;
}

export interface PrepareInput {
  organizationId: string;
  /** Who prepared it: usually an agent, on behalf of a person. */
  actor: Actor;
  recordType: string;
  /** The record a change proposal targets; absent for a new record. */
  recordId?: string;
  /** The record's version the proposal was made against, to detect a stale proposal. */
  baseVersion?: string;
  values: Values;
  provenance: Record<string, FieldProvenance>;
  /** When given, the values are checked against the record's schema (a draft may be incomplete). */
  definition?: DefinedRecord<z.ZodObject>;
}

/**
 * Prepares a draft (CONCEPTION A.2): a record not created yet, or a change proposed to an existing
 * one. It has no effect — no total, no notification, no statistic — until a person validates it.
 */
export async function prepareDraft(db: SqlExecutor, input: PrepareInput): Promise<Draft> {
  const actor = checkActor(input.actor);
  const values = checkValues(input.definition, input.values, false);
  for (const [name, provenance] of Object.entries(input.provenance)) {
    if (!(name in values) || !provenanceSources.includes(provenance.source)) {
      throw new DraftError('invalid_provenance', `The provenance of "${name}" is not valid.`);
    }
  }
  const { rows } = await db.query<DraftRow>(
    `insert into kete_drafts (draft_id, organization_id, kind, record_type, record_id, base_version,
       prepared, proposed, provenance, prepared_by_kind, prepared_by_id, prepared_channel,
       on_behalf_of_kind, on_behalf_of_id)
     values ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13)
     returning ${columns}`,
    [
      newId('drf'),
      input.organizationId,
      input.recordId ? 'change' : 'record',
      input.recordType,
      input.recordId ?? null,
      input.baseVersion ?? null,
      JSON.stringify(values),
      JSON.stringify(input.provenance),
      actor.kind,
      actor.id,
      actor.channel,
      actor.onBehalfOf?.kind ?? null,
      actor.onBehalfOf?.id ?? null,
    ],
  );
  return toDraft(rows[0] as DraftRow);
}

/** A draft of the active organization, or null. */
export async function getDraft(db: SqlExecutor, draftId: string): Promise<Draft | null> {
  const { rows } = await db.query<DraftRow>(
    `select ${columns} from kete_drafts where draft_id = $1`,
    [draftId],
  );
  return rows[0] ? toDraft(rows[0]) : null;
}

export interface DraftQuery {
  status?: DraftStatus;
  recordType?: string;
  /** Default 50, at most 500. */
  limit?: number;
}

/** The active organization's drafts, newest first: by default, those waiting for a person. */
export async function listDrafts(db: SqlExecutor, query: DraftQuery = {}): Promise<Draft[]> {
  const { rows } = await db.query<DraftRow>(
    `select ${columns} from kete_drafts
      where status = $1 and ($2::text is null or record_type = $2)
      order by created_at desc, draft_id desc limit $3`,
    [
      query.status ?? 'prepared',
      query.recordType ?? null,
      Math.min(Math.max(query.limit ?? 50, 1), 500),
    ],
  );
  return rows.map(toDraft);
}

async function waitingDraft(db: SqlExecutor, draftId: string): Promise<Draft> {
  const decided = new DraftError('already_decided', 'This draft was already validated or refused.');
  const current = await getDraft(db, draftId);
  if (!current) throw new DraftError('not_found', 'No such draft in this organization.');
  if (current.status !== 'prepared') throw decided;
  // Locked for the decision. A decided draft is invisible to FOR UPDATE (the frozen policy), so an
  // empty result here means another person decided it meanwhile.
  const { rows } = await db.query<DraftRow>(
    `select ${columns} from kete_drafts where draft_id = $1 and status = 'prepared' for update`,
    [draftId],
  );
  if (!rows[0]) throw decided;
  return toDraft(rows[0]);
}

function requireHuman(actor: Actor): Actor {
  const checked = checkActor(actor);
  if (!isHuman(checked)) {
    throw new DraftError('human_required', 'The AI prepares; only a person decides.');
  }
  return checked;
}

export interface CorrectInput {
  draftId: string;
  actor: Actor;
  /** The fields to change; each one's provenance becomes the corrector's. */
  changes: Values;
  definition?: DefinedRecord<z.ZodObject>;
}

/** Corrects a waiting draft: what a person typed replaces what was prepared, field by field. */
export async function correctDraft(db: SqlExecutor, input: CorrectInput): Promise<Draft> {
  const actor = checkActor(input.actor);
  const draft = await waitingDraft(db, input.draftId);
  const proposed = checkValues(input.definition, { ...draft.proposed, ...input.changes }, false);
  const provenance = { ...draft.provenance };
  const by = { kind: actor.kind, id: actor.id };
  for (const name of Object.keys(input.changes)) {
    provenance[name] = { source: isHuman(actor) ? 'typed' : 'inferred', by };
  }
  const { rows } = await db.query<DraftRow>(
    `update kete_drafts set proposed = $2, provenance = $3, updated_at = now()
      where draft_id = $1 returning ${columns}`,
    [input.draftId, JSON.stringify(proposed), JSON.stringify(provenance)],
  );
  return toDraft(rows[0] as DraftRow);
}

function correctionsOf(prepared: Values, proposed: Values): Draft['corrections'] {
  const corrections: NonNullable<Draft['corrections']> = {};
  for (const name of new Set([...Object.keys(prepared), ...Object.keys(proposed)])) {
    if (JSON.stringify(prepared[name]) !== JSON.stringify(proposed[name])) {
      corrections[name] = { prepared: prepared[name] ?? null, validated: proposed[name] ?? null };
    }
  }
  return Object.keys(corrections).length > 0 ? corrections : null;
}

export interface ValidateInput<Result> {
  draftId: string;
  /** A person: the AI prepares, a person decides. */
  actor: Actor;
  /**
   * Applies the draft by running the same use case as the screen — typically a command of
   * `@kete/commands` — in the same transaction. If it fails, the draft stays waiting.
   */
  apply(values: Values, draft: Draft): Promise<Result>;
  /** When given, the values must now be a complete record. */
  definition?: DefinedRecord<z.ZodObject>;
}

/**
 * Validates a draft: a person's decision, traced (who, when, which version), applied through the
 * same use case as the screen. What the person corrected is kept as learning material.
 */
export async function validateDraft<Result>(
  db: SqlExecutor,
  input: ValidateInput<Result>,
): Promise<{ draft: Draft; result: Result }> {
  const actor = requireHuman(input.actor);
  const draft = await waitingDraft(db, input.draftId);
  const values = checkValues(input.definition, draft.proposed, true);
  await db.query('savepoint kete_draft');
  try {
    const result = await input.apply(values, draft);
    const { rows } = await db.query<DraftRow>(
      `update kete_drafts
          set status = 'validated', decided_by_kind = 'person', decided_by_id = $2,
              decided_at = now(), corrections = $3, result = $4, updated_at = now()
        where draft_id = $1 returning ${columns}`,
      [
        input.draftId,
        actor.id,
        JSON.stringify(correctionsOf(draft.prepared, draft.proposed)),
        result === undefined ? null : JSON.stringify(result),
      ],
    );
    await db.query('release savepoint kete_draft');
    return { draft: toDraft(rows[0] as DraftRow), result };
  } catch (error) {
    await db.query('rollback to savepoint kete_draft');
    throw error;
  }
}

/** Refuses a draft: a person's decision, with the reason, traced. Nothing is applied. */
export async function refuseDraft(
  db: SqlExecutor,
  input: { draftId: string; actor: Actor; reason: string },
): Promise<Draft> {
  const actor = requireHuman(input.actor);
  await waitingDraft(db, input.draftId);
  const { rows } = await db.query<DraftRow>(
    `update kete_drafts
        set status = 'refused', decided_by_kind = 'person', decided_by_id = $2, decided_at = now(),
            refusal_reason = $3, updated_at = now()
      where draft_id = $1 returning ${columns}`,
    [input.draftId, actor.id, input.reason.slice(0, 1000)],
  );
  return toDraft(rows[0] as DraftRow);
}
