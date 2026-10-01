import { randomUUID } from 'node:crypto';
import { executeCommand, type Actor } from '@kete/commands';
import { prepareDraft, type FieldProvenance } from '@kete/drafts';
import type { Capability } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { z } from 'zod';
import { modeFor, type CapabilityDefinition, type InvocationResult } from './capability.js';

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
  execute(input: unknown): Promise<InvocationResult>;
}

export interface CapabilityRegistry {
  /** The capabilities this caller may use, as the `capability.v1` contract describes them. */
  list(caller: Caller): Promise<Capability[]>;
  /** Invokes a capability, under the same rules for every surface. */
  invoke(invocation: Invocation): Promise<InvocationResult>;
  /** The caller's capabilities as tools, for the chat and other model runtimes (@kete/ai). */
  tools(caller: Caller): Promise<CapabilityTool[]>;
  /** Every capability, for a manifest (no filtering by caller). */
  describeAll(): Capability[];
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
        execute: (input) => invoke({ ...caller, name: definition.name, input }),
      }));
    },
    describeAll: () => definitions.map(describe),
  };
}
