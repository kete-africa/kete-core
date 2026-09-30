import { createHash } from 'node:crypto';
import { uuidv7 } from '@kete/sdk';
import { ORGANIZATION_SETTING, type SqlExecutor } from '@kete/tenancy';
import type { z } from 'zod';
import { actorSchema, type Actor } from './actor.js';

/**
 * Whether a command can be undone, and by which command (CONCEPTION 7). It sets how far an agent
 * may act alone: reversible gestures may run with a notification and "Annuler"; irreversible,
 * financial or external ones go through a draft and a person's validation.
 */
export type Reversibility =
  { reversible: true; inverse: string } | { reversible: false; inverse?: undefined };

export interface CommandContext {
  /** The caller's transaction, with the organization set: the change and its journal entry commit together. */
  db: SqlExecutor;
  organizationId: string;
  actor: Actor;
  commandId: string;
}

export interface CommandDefinition<Input extends z.ZodType, Output> {
  /** A named gesture, never a generic update: `create-deposit`, `mark-ready`, `cancel-deposit`. */
  name: string;
  input: Input;
  reversibility: Reversibility;
  handler(input: z.output<Input>, context: CommandContext): Promise<Output>;
  /** A short sentence for the journal, readable by a person or an agent. */
  summarize?(input: z.output<Input>, output: Output): string;
  /** Whether the input is kept in the journal (default true). Turn off for bulky or secret input. */
  journalInput?: boolean;
}

const commandName = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function defineCommand<Input extends z.ZodType, Output>(
  definition: CommandDefinition<Input, Output>,
): CommandDefinition<Input, Output> {
  if (!commandName.test(definition.name)) {
    throw new Error(`A command is named in kebab case, like "create-deposit": ${definition.name}`);
  }
  if (definition.reversibility.reversible && !commandName.test(definition.reversibility.inverse)) {
    throw new Error(`The inverse of ${definition.name} must be a command name.`);
  }
  return definition;
}

export interface CommandRequest {
  organizationId: string;
  actor: Actor;
  /** The same key replays the same result; a different input with the same key is refused. */
  idempotencyKey: string;
  input: unknown;
  /** Why, when a person says it. */
  reason?: string;
}

export interface CommandResult<Output> {
  commandId: string;
  output: Output;
  /** True when the key had already been used: nothing ran again. */
  replayed: boolean;
}

export class CommandError extends Error {
  constructor(
    readonly code:
      | 'invalid_input'
      | 'invalid_actor'
      | 'invalid_idempotency_key'
      | 'organization_mismatch'
      | 'idempotency_conflict',
    message: string,
    readonly issues?: z.ZodError['issues'],
  ) {
    super(message);
    this.name = 'CommandError';
  }
}

/** A stable JSON rendering (sorted keys), so the same input always hashes the same. */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
}

function hashOf(name: string, input: unknown): string {
  return createHash('sha256')
    .update(`${name}\n${canonical(input)}`)
    .digest('hex');
}

interface JournalRow extends Record<string, unknown> {
  command_id: string;
  name: string;
  input_hash: string;
  output: unknown;
}

/**
 * Runs a command in the caller's transaction (organization set, see `@kete/tenancy`): validates the
 * actor and the input, replays a result already produced for the same idempotency key, otherwise
 * runs the handler and appends the journal entry — who, on behalf of whom, through which channel,
 * why, and whether it can be undone. A failing handler leaves nothing behind (a savepoint).
 */
export async function executeCommand<Input extends z.ZodType, Output>(
  db: SqlExecutor,
  definition: CommandDefinition<Input, Output>,
  request: CommandRequest,
): Promise<CommandResult<Output>> {
  const actor = actorSchema.safeParse(request.actor);
  if (!actor.success) {
    throw new CommandError('invalid_actor', 'The actor is not valid.', actor.error.issues);
  }
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(request.idempotencyKey)) {
    throw new CommandError(
      'invalid_idempotency_key',
      'An idempotency key has 8 to 128 characters: letters, digits, "_", ".", ":" or "-".',
    );
  }
  const parsed = definition.input.safeParse(request.input);
  if (!parsed.success) {
    throw new CommandError(
      'invalid_input',
      `The input of ${definition.name} is not valid.`,
      parsed.error.issues,
    );
  }

  const { rows: settings } = await db.query<{ organization: string | null }>(
    `select current_setting($1, true) as organization`,
    [ORGANIZATION_SETTING],
  );
  if (settings[0]?.organization !== request.organizationId) {
    throw new CommandError(
      'organization_mismatch',
      'A command runs inside a transaction of its own organization (see @kete/tenancy).',
    );
  }

  // One command at a time per key: a concurrent retry waits here, then replays.
  await db.query(`select pg_advisory_xact_lock(hashtextextended($1, 0))`, [
    `kete.command:${request.organizationId}:${request.idempotencyKey}`,
  ]);
  const inputHash = hashOf(definition.name, parsed.data);
  const { rows: previous } = await db.query<JournalRow>(
    `select command_id, name, input_hash, output from kete_commands
      where organization_id = $1 and idempotency_key = $2`,
    [request.organizationId, request.idempotencyKey],
  );
  const done = previous[0];
  if (done) {
    if (done.name !== definition.name || done.input_hash !== inputHash) {
      throw new CommandError(
        'idempotency_conflict',
        'This idempotency key was already used for another command or another input.',
      );
    }
    return { commandId: done.command_id, output: done.output as Output, replayed: true };
  }

  const commandId = `cmd_${uuidv7()}`;
  await db.query('savepoint kete_command');
  try {
    const output = await definition.handler(parsed.data, {
      db,
      organizationId: request.organizationId,
      actor: actor.data,
      commandId,
    });
    const onBehalfOf = actor.data.onBehalfOf;
    await db.query(
      `insert into kete_commands (command_id, organization_id, name, idempotency_key, input_hash,
         input, output, summary, reason, actor_kind, actor_id, on_behalf_of_kind, on_behalf_of_id,
         channel, reversible, inverse)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        commandId,
        request.organizationId,
        definition.name,
        request.idempotencyKey,
        inputHash,
        definition.journalInput === false ? null : JSON.stringify(parsed.data),
        output === undefined ? null : JSON.stringify(output),
        definition.summarize?.(parsed.data, output) ?? null,
        request.reason ?? null,
        actor.data.kind,
        actor.data.id,
        onBehalfOf?.kind ?? null,
        onBehalfOf?.id ?? null,
        actor.data.channel,
        definition.reversibility.reversible,
        definition.reversibility.inverse ?? null,
      ],
    );
    await db.query('release savepoint kete_command');
    return { commandId, output, replayed: false };
  } catch (error) {
    await db.query('rollback to savepoint kete_command');
    throw error;
  }
}
