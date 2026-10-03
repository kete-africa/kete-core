import { randomUUID } from 'node:crypto';
import { CommandError, executeCommand, isHuman, type Actor } from '@kete/commands';
import {
  correctDraft,
  DraftError,
  getDraft,
  prepareDraft,
  refuseDraft,
  validateDraft,
  type Draft,
  type FieldProvenance,
} from '@kete/drafts';
import type { Capability } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { z } from 'zod';
import {
  modeFor,
  type CapabilityDefinition,
  type DecisionCapability,
  type DecisionResult,
  type DraftReview,
  type InvocationResult,
} from './capability.js';

/** Who calls, for which organization. */
export interface Caller {
  actor: Actor;
  organizationId: string;
}

export interface CapabilityHost {
  /**
   * Whether the caller holds `permission` in the organization. For an agent acting on behalf of a
   * person, the host checks both: an agent never has more rights than the person (doctrine).
   */
  authorize(caller: Caller, permission: string): Promise<boolean>;
  /** Runs `work` in a transaction of the organization (for example `inOrganization` of @kete/tenancy). */
  transaction<T>(organizationId: string, work: (db: SqlExecutor) => Promise<T>): Promise<T>;
}

export interface Invocation extends Caller {
  name: string;
  input: unknown;
  /** Makes a retried call harmless (default: a new key, each call is new). */
  idempotencyKey?: string;
  /** A person's explicit confirmation, for level 4. */
  confirmed?: boolean;
  /** Where each value came from, when an agent prepares a draft (default: inferred by it). */
  provenance?: Record<string, FieldProvenance>;
}

/** A capability as a tool, for a model or any caller that is not MCP. */
export interface CapabilityTool {
  name: string;
  description: string;
  input: z.ZodObject;
  jsonSchema: Record<string, unknown>;
  autonomy: 1 | 2 | 3 | 4;
  /** The view a copilot shows with the result (MCP Apps). */
  view?: string;
  execute(input: unknown): Promise<InvocationResult>;
}

/** A person's decision on a draft: validate it (with her corrections) or refuse it. */
export type Decision = Caller & {
  draftId: string;
  /** For level 4, given only by the product's own screen, after its confirmation. */
  confirmed?: boolean;
  idempotencyKey?: string;
} & (
    | { action: 'validate'; corrections?: Record<string, unknown> }
    | { action: 'refuse'; reason: string }
  );

export interface CapabilityRegistry {
  /** The capabilities this caller may use, as the `capability.v1` contract describes them. */
  list(caller: Caller): Promise<Capability[]>;
  /** Invokes a capability, under the same rules for every surface. */
  invoke(invocation: Invocation): Promise<InvocationResult>;
  /** The caller's capabilities as tools, for the chat and other model runtimes (@kete/ai). */
  tools(caller: Caller): Promise<CapabilityTool[]>;
  /** Every capability, for a manifest (no filtering by caller). */
  describeAll(): Capability[];
  /** A draft as a view shows it, for a caller allowed to decide it (null otherwise). */
  review(caller: Caller, draftId: string): Promise<DraftReview | null>;
  /**
   * A person decides a draft: the same command as the screen runs, journaled with her as actor.
   * Level 4 needs `confirmed`, which only the product's own screen gives.
   */
  decide(decision: Decision): Promise<DecisionResult>;
}

/** The generic view of a draft to verify (doctrine D-037), served by @kete/views. */
export const DRAFT_REVIEW_VIEW = 'ui://kete/review';

/** A capability's view: its own, or the draft review for a decision. */
function viewOf(definition: CapabilityDefinition): string | undefined {
  return definition.view ?? (definition.autonomy >= 3 ? DRAFT_REVIEW_VIEW : undefined);
}

function viewEntry(definition: CapabilityDefinition): { view?: string } {
  const view = viewOf(definition);
  return view ? { view } : {};
}

function reviewOf(definition: DecisionCapability<z.ZodObject, unknown>, draft: Draft): DraftReview {
  return {
    draftId: draft.draftId,
    capability: definition.name,
    description: definition.description,
    autonomy: definition.autonomy,
    recordType: draft.recordType,
    status: draft.status,
    values: draft.proposed,
    provenance: draft.provenance,
    schema: z.toJSONSchema(definition.input) as Record<string, unknown>,
  };
}

function describe(definition: CapabilityDefinition): Capability {
  // A read changes nothing: it is reversible by nature, with nothing to undo.
  const reversibility: { reversible: boolean; inverse?: string | undefined } =
    definition.autonomy === 1 ? { reversible: true } : definition.command.reversibility;
  return {
    name: definition.name,
    description: definition.description,
    autonomy: definition.autonomy,
    reversible: reversibility.reversible,
    ...(reversibility.inverse ? { inverse: reversibility.inverse } : {}),
    permission: definition.permission,
    ...viewEntry(definition),
    ...(definition.classification ? { classification: definition.classification } : {}),
    input: z.toJSONSchema(definition.input) as Record<string, unknown>,
    ...(definition.output
      ? { output: z.toJSONSchema(definition.output) as Record<string, unknown> }
      : {}),
  };
}

/**
 * The capabilities of a product, invoked the same way from every surface — MCP, the chat, another
 * app, a worker — with the same rights, the same journal and the same autonomy rules.
 */
export function createCapabilityRegistry(
  definitions: readonly CapabilityDefinition[],
  host: CapabilityHost,
): CapabilityRegistry {
  const byName = new Map<string, CapabilityDefinition>();
  for (const definition of definitions) {
    if (byName.has(definition.name)) throw new Error(`Duplicate capability: ${definition.name}`);
    byName.set(definition.name, definition);
  }
  // A draft knows its record type; one decision capability per record type finds its command.
  const byRecordType = new Map<string, DecisionCapability<z.ZodObject, unknown>>();
  for (const definition of definitions) {
    if (definition.autonomy !== 3 && definition.autonomy !== 4) continue;
    const decision = definition as DecisionCapability<z.ZodObject, unknown>;
    if (byRecordType.has(decision.draft.recordType)) {
      throw new Error(`Two capabilities prepare drafts of ${decision.draft.recordType}.`);
    }
    byRecordType.set(decision.draft.recordType, decision);
  }

  async function allowed(caller: Caller): Promise<CapabilityDefinition[]> {
    const checks = await Promise.all(
      definitions.map(async (d) => ((await host.authorize(caller, d.permission)) ? d : null)),
    );
    return checks.filter((d): d is CapabilityDefinition => d !== null);
  }

  async function invoke(invocation: Invocation): Promise<InvocationResult> {
    const definition = byName.get(invocation.name);
    if (!definition) return { status: 'refused', reason: 'unknown_capability' };
    if (!(await host.authorize(invocation, definition.permission))) {
      return { status: 'refused', reason: 'not_allowed' };
    }
    const parsed = definition.input.safeParse(invocation.input);
    if (!parsed.success) {
      return { status: 'refused', reason: 'invalid_input', issues: parsed.error.issues };
    }
    const { actor, organizationId } = invocation;
    const mode = modeFor(definition, actor, invocation.confirmed === true);
    if (mode === 'confirm') {
      return {
        status: 'confirmation_required',
        message: `${definition.name} cannot be undone: it needs the person's explicit confirmation.`,
      };
    }
    return host.transaction(organizationId, async (db) => {
      if (definition.autonomy === 1) {
        return {
          status: 'done',
          output: await definition.run(parsed.data, { db, organizationId, actor }),
        };
      }
      if (mode === 'draft' && definition.autonomy !== 2) {
        const values = definition.draft.values?.(parsed.data) ?? parsed.data;
        const by = { kind: actor.kind, id: actor.id };
        const provenance =
          invocation.provenance ??
          Object.fromEntries(
            Object.keys(values).map((field) => [field, { source: 'inferred' as const, by }]),
          );
        const draft = await prepareDraft(db, {
          organizationId,
          actor,
          recordType: definition.draft.recordType,
          values,
          provenance,
          ...(definition.draft.definition ? { definition: definition.draft.definition } : {}),
        });
        return {
          status: 'draft',
          draftId: draft.draftId,
          message: 'A draft was prepared; it waits for a person to verify and validate it.',
          review: reviewOf(definition as DecisionCapability<z.ZodObject, unknown>, draft),
        };
      }
      const result = await executeCommand(db, definition.command, {
        organizationId,
        actor,
        idempotencyKey: invocation.idempotencyKey ?? `cap-${randomUUID()}`,
        input: parsed.data,
      });
      const inverse = definition.command.reversibility.inverse;
      return {
        status: 'done',
        output: result.output,
        commandId: result.commandId,
        ...(definition.autonomy === 2 && inverse ? { undo: inverse } : {}),
      };
    });
  }

  return {
    async list(caller) {
      return (await allowed(caller)).map(describe);
    },
    invoke,
    async tools(caller) {
      return (await allowed(caller)).map((definition) => ({
        name: definition.name,
        description: definition.description,
        input: definition.input,
        jsonSchema: z.toJSONSchema(definition.input) as Record<string, unknown>,
        autonomy: definition.autonomy,
        ...viewEntry(definition),
        execute: (input) => invoke({ ...caller, name: definition.name, input }),
      }));
    },
    describeAll: () => definitions.map(describe),
    review,
    decide,
  };

  async function review(caller: Caller, draftId: string): Promise<DraftReview | null> {
    return host.transaction(caller.organizationId, async (db) => {
      const draft = await getDraft(db, draftId);
      const definition = draft ? byRecordType.get(draft.recordType) : undefined;
      if (!draft || !definition) return null;
      if (!(await host.authorize(caller, definition.permission))) return null;
      return reviewOf(definition, draft);
    });
  }

  async function decide(decision: Decision): Promise<DecisionResult> {
    const { actor, organizationId, draftId } = decision;
    if (!isHuman(actor)) return { status: 'not_possible', reason: 'not_a_person' };
    return host.transaction(organizationId, async (db): Promise<DecisionResult> => {
      const draft = await getDraft(db, draftId);
      const definition = draft ? byRecordType.get(draft.recordType) : undefined;
      if (!draft || !definition) return { status: 'not_possible', reason: 'not_found' };
      if (!(await host.authorize(decision, definition.permission))) {
        return { status: 'not_possible', reason: 'not_allowed' };
      }
      if (draft.status !== 'prepared') return { status: 'not_possible', reason: 'already_decided' };
      try {
        if (decision.action === 'refuse') {
          const refused = await refuseDraft(db, { draftId, actor, reason: decision.reason });
          return { status: 'refused', review: reviewOf(definition, refused) };
        }
        if (definition.autonomy === 4 && decision.confirmed !== true) {
          return { status: 'open_in_app', review: reviewOf(definition, draft) };
        }
        if (decision.corrections && Object.keys(decision.corrections).length > 0) {
          const parsed = definition.input.partial().safeParse(decision.corrections);
          if (!parsed.success) {
            return { status: 'not_possible', reason: 'invalid_input', issues: parsed.error.issues };
          }
          await correctDraft(db, { draftId, actor, changes: parsed.data });
        }
        const { draft: validated, result } = await validateDraft(db, {
          draftId,
          actor,
          apply: async (values) =>
            (
              await executeCommand(db, definition.command, {
                organizationId,
                actor,
                idempotencyKey: decision.idempotencyKey ?? `draft-${draftId}`,
                input: values,
              })
            ).output,
        });
        return { status: 'validated', review: reviewOf(definition, validated), output: result };
      } catch (error) {
        if (error instanceof DraftError && error.code === 'already_decided') {
          return { status: 'not_possible', reason: 'already_decided' };
        }
        if (error instanceof CommandError && error.code === 'invalid_input') {
          return {
            status: 'not_possible',
            reason: 'invalid_input',
            ...(error.issues ? { issues: error.issues } : {}),
          };
        }
        throw error;
      }
    });
  }
}
