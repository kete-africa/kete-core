import type { SqlExecutor } from '@kete/tenancy';
import type { ActorKind, ActorRef, Channel } from './actor.js';

/** One entry of the command journal, as a person or an agent reads it. */
export interface JournalEntry {
  commandId: string;
  name: string;
  summary: string | null;
  reason: string | null;
  actor: { kind: ActorKind; id: string };
  onBehalfOf: { kind: ActorKind; id: string } | null;
  /** The agents that asked, from the first to the last (doctrine D-039); empty when none did. */
  delegatedBy: ActorRef[];
  traceId: string | null;
  channel: Channel;
  reversible: boolean;
  inverse: string | null;
  createdAt: Date;
}

export interface JournalQuery {
  /** Default 50, at most 500. */
  limit?: number;
  /** Only this command. */
  name?: string;
  /** Only the gestures of one delegated task (doctrine D-039). */
  traceId?: string;
}

/** The active organization's latest commands, newest first (RLS keeps other organizations out). */
export async function readJournal(
  db: SqlExecutor,
  query: JournalQuery = {},
): Promise<JournalEntry[]> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
  const { rows } = await db.query<{
    command_id: string;
    name: string;
    summary: string | null;
    reason: string | null;
    actor_kind: ActorKind;
    actor_id: string;
    on_behalf_of_kind: ActorKind | null;
    on_behalf_of_id: string | null;
    delegated_by: ActorRef[] | null;
    trace_id: string | null;
    channel: Channel;
    reversible: boolean;
    inverse: string | null;
    created_at: Date;
  }>(
    `select command_id, name, summary, reason, actor_kind, actor_id, on_behalf_of_kind,
            on_behalf_of_id, delegated_by, trace_id, channel, reversible, inverse, created_at
       from kete_commands
      where ($1::text is null or name = $1)
        and ($3::text is null or trace_id = $3)
      order by created_at desc, command_id desc
      limit $2`,
    [query.name ?? null, limit, query.traceId ?? null],
  );
  return rows.map((row) => ({
    commandId: row.command_id,
    name: row.name,
    summary: row.summary,
    reason: row.reason,
    actor: { kind: row.actor_kind, id: row.actor_id },
    onBehalfOf:
      row.on_behalf_of_kind && row.on_behalf_of_id
        ? { kind: row.on_behalf_of_kind, id: row.on_behalf_of_id }
        : null,
    delegatedBy: row.delegated_by ?? [],
    traceId: row.trace_id,
    channel: row.channel,
    reversible: row.reversible,
    inverse: row.inverse,
    createdAt: new Date(row.created_at),
  }));
}
