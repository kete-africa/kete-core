import { isHuman, type Actor, type CommandDefinition, type CommandResult } from '@kete/commands';
import type { FieldProvenance } from '@kete/drafts';
import type { DefinedRecord } from '@kete/records';
import type { SqlExecutor } from '@kete/tenancy';
import type { z } from 'zod';

/**
 * The autonomy scale (doctrine PRINCIPES): how far an agent may go alone with a capability.
 * 1 — read, analyze, signal: autonomous.
 * 2 — act reversibly: autonomous, with a notification and "Annuler".
 * 3 — prepare a decision that commits: a draft, a person validates.
 * 4 — irreversible, money, external: always a person, with confirmation.
 */
export type Autonomy = 1 | 2 | 3 | 4;

export interface CapabilityContext {
  /** The caller's transaction, with its organization set (see @kete/tenancy). */
  db: SqlExecutor;
  organizationId: string;
  actor: Actor;
}

interface Common<Input extends z.ZodObject> {
  /** snake_case, a valid tool name everywhere: `quotes_prepare`, `people_search`. */
  name: string;
  /** What it does and when to use it, for a person and for a model. */
  description: string;
  /** `resource:action`, checked by the host for every caller (and for whom an agent acts). */
  permission: string;
  input: Input;
  output?: z.ZodType;
  /**
   * The view a copilot shows with the result (MCP Apps, doctrine D-037): `ui://kete/review` for a
   * draft (the default at levels 3 and 4), or a view of the product.
   */
  view?: string;
}

/** Level 1: reads, analyzes or signals. Runs for anyone allowed. */
export interface ReadCapability<Input extends z.ZodObject, Output> extends Common<Input> {
  autonomy: 1;
  run(input: z.output<Input>, context: CapabilityContext): Promise<Output>;
}

/** Level 2: a reversible command; an agent may run it, and the result says how to undo it. */
export interface ReversibleCapability<Input extends z.ZodObject, Output> extends Common<Input> {
  autonomy: 2;
  command: CommandDefinition<Input, Output>;
}

/**
 * Levels 3 and 4: a decision that commits. An agent only prepares a draft of `recordType`; a person
 * runs the command (level 4 also needs her explicit confirmation).
 */
export interface DecisionCapability<Input extends z.ZodObject, Output> extends Common<Input> {
  autonomy: 3 | 4;
  command: CommandDefinition<Input, Output>;
  draft: {
    recordType: string;
    definition?: DefinedRecord<z.ZodObject>;
    /** The draft's values from the input (default: the input itself). */
    values?(input: z.output<Input>): Record<string, unknown>;
  };
}

export type CapabilityDefinition<Input extends z.ZodObject = z.ZodObject, Output = unknown> =
  | ReadCapability<Input, Output>
  | ReversibleCapability<Input, Output>
  | DecisionCapability<Input, Output>;

const capabilityName = /^[a-z][a-z0-9_]{0,62}$/;
const permissionPattern = /^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/;
const viewPattern = /^ui:\/\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9/_-]*$/;

/** Declares a capability; its shape is checked once, at start-up. */
export function defineCapability<Input extends z.ZodObject, Output>(
  definition: CapabilityDefinition<Input, Output>,
): CapabilityDefinition<Input, Output> {
  if (!capabilityName.test(definition.name)) {
    throw new Error(
      `A capability is named in snake_case, like "quotes_prepare": ${definition.name}`,
    );
  }
  if (!permissionPattern.test(definition.permission)) {
    throw new Error(`A permission reads "resource:action": ${definition.permission}`);
  }
  if (definition.view !== undefined && !viewPattern.test(definition.view)) {
    throw new Error(`A view is an MCP Apps resource, like "ui://kete/review": ${definition.view}`);
  }
  if (definition.autonomy === 2 && !definition.command.reversibility.reversible) {
    throw new Error(
      `${definition.name}: level 2 is for reversible gestures only; an irreversible command is level 3 or 4.`,
    );
  }
  return definition;
}

/**
 * What a view needs to show a draft to a person: its values, where each one comes from, and how
 * far the decision goes.
 */
export interface DraftReview {
  draftId: string;
  /** The capability that prepared it, and what it does. */
  capability: string;
  description: string;
  /** 3: the person validates it in the view. 4: in the product's own screen, with confirmation. */
  autonomy: 3 | 4;
  recordType: string;
  status: 'prepared' | 'validated' | 'refused';
  values: Record<string, unknown>;
  provenance: Record<string, FieldProvenance>;
  /** The input's JSON Schema: titles, types and required fields, for a generic view. */
  schema: Record<string, unknown>;
}

/** What a person's decision on a draft gave. */
export type DecisionResult =
  | { status: 'validated'; review: DraftReview; output: unknown }
  | { status: 'refused'; review: DraftReview }
  /** Level 4 is decided in the product's own screen, with its confirmation. */
  | { status: 'open_in_app'; review: DraftReview }
  | {
      status: 'not_possible';
      reason: 'not_found' | 'not_allowed' | 'already_decided' | 'invalid_input' | 'not_a_person';
      issues?: z.ZodError['issues'];
    };

/** What happened when a capability was invoked. */
export type InvocationResult<Output = unknown> =
  | {
      status: 'done';
      output: Output;
      /** The journaled command, when the capability ran one. */
      commandId?: string;
      /** How to undo it (level 2): the inverse command's name. */
      undo?: string;
    }
  | {
      status: 'draft';
      draftId: string;
      /** For a model to tell the person: a draft waits for her validation. */
      message: string;
      /** What a view shows of it (MCP Apps, doctrine D-037). */
      review: DraftReview;
    }
  | { status: 'confirmation_required'; message: string }
  | {
      status: 'refused';
      reason: 'unknown_capability' | 'not_allowed' | 'invalid_input';
      issues?: z.ZodError['issues'];
    };

/** What happens for this actor: run, prepare a draft, or ask for confirmation. */
export function modeFor(
  definition: CapabilityDefinition,
  actor: Actor,
  confirmed: boolean,
): 'run' | 'command' | 'draft' | 'confirm' {
  if (definition.autonomy === 1) return 'run';
  if (definition.autonomy === 2) return 'command';
  if (!isHuman(actor)) return 'draft';
  if (definition.autonomy === 4 && !confirmed) return 'confirm';
  return 'command';
}

export type { CommandResult, FieldProvenance };
