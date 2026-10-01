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
  if (definition.autonomy === 2 && !definition.command.reversibility.reversible) {
    throw new Error(
      `${definition.name}: level 2 is for reversible gestures only; an irreversible command is level 3 or 4.`,
    );
  }
  return definition;
}

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
