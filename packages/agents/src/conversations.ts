import './quiet.js';
import {
  ACTIVE_ORGANIZATION_SQL,
  checkOrganizationId,
  ORGANIZATION_SETTING,
  organizationPolicySql,
} from '@kete/tenancy';
import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import type { Pool, PoolClient } from 'pg';
import { RUNTIME_TABLES, runtimeTablesSql } from './runtime-tables.js';

// Where an agent's conversations are kept (spec 089): the runtime's own tables, each given its
// organization and its row-level security, read and written by the application role only. The
// runtime knows nothing of organizations: it is handed a pool whose every statement runs inside
// one.

export interface AgentConversationsMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
const checked = (name: string) => {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
};

/**
 * The runtime's conversation tables, each with its organization and its row-level security in
 * the same migration. A row is written with the organization of its transaction, and cannot be
 * written outside one.
 */
export function agentConversationsMigrationSql(
  options: AgentConversationsMigrationOptions,
): string {
  const s = checked(options.schema ?? 'public');
  const app = checked(options.appRole);
  return [
    runtimeTablesSql(s),
    ...RUNTIME_TABLES.map(
      (table) => `
alter table ${s}.${table}
  add column organization_id text not null default ${ACTIVE_ORGANIZATION_SQL}
  check (organization_id ~ '^[A-Za-z0-9_-]{1,128}$');
create index ${table}_organization on ${s}.${table} (organization_id);
${organizationPolicySql({ schema: s, table, appRole: app })}
grant select, insert, update, delete on ${s}.${table} to ${app};`,
    ),
  ].join('\n');
}

const opens = /^\s*(begin|start\s+transaction)\b/i;
const closes = /^\s*(commit|end|rollback(?!\s+to\b))\b/i;
const textOf = (query: unknown): string =>
  typeof query === 'string' ? query : String((query as { text?: unknown } | null)?.text ?? '');

/**
 * A view of the app's pool where every statement runs inside one organization: the setting is
 * local to each transaction, as `inOrganization` sets it, so nothing is left on a connection —
 * whatever pools them. A statement outside a transaction gets one of its own.
 */
export function organizationPool(pool: Pool, organizationId: string): Pool {
  checkOrganizationId(organizationId);
  const enter = `select set_config('${ORGANIZATION_SETTING}', $1, true)`;

  const within = (client: PoolClient): PoolClient => {
    const raw = client.query.bind(client) as (...args: unknown[]) => Promise<unknown>;
    let open = false;
    const query = async (...args: unknown[]): Promise<unknown> => {
      const sql = textOf(args[0]);
      if (opens.test(sql)) {
        const begun = await raw(...args);
        await raw(enter, [organizationId]);
        open = true;
        return begun;
      }
      if (closes.test(sql)) {
        open = false;
        return raw(...args);
      }
      if (open) return raw(...args);
      await raw('begin');
      try {
        await raw(enter, [organizationId]);
        const result = await raw(...args);
        await raw('commit');
        return result;
      } catch (error) {
        await raw('rollback').catch(() => undefined);
        throw error;
      }
    };
    return new Proxy(client, {
      get(target, key) {
        if (key === 'query') return query;
        const value: unknown = Reflect.get(target, key, target);
        return typeof value === 'function'
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    });
  };

  const connect = async (): Promise<PoolClient> => within(await pool.connect());
  const query = async (...args: unknown[]): Promise<unknown> => {
    const client = await connect();
    try {
      return await (client.query as (...values: unknown[]) => Promise<unknown>)(...args);
    } finally {
      client.release();
    }
  };
  return new Proxy(pool, {
    get(target, key) {
      if (key === 'connect') return connect;
      if (key === 'query') return query;
      // The pool is the app's: whoever holds this view does not close it.
      if (key === 'end') return () => Promise.resolve();
      const value: unknown = Reflect.get(target, key, target);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

export interface AgentThread {
  threadId: string;
  title: string;
  updatedAt: string;
}

export interface AgentSaid {
  role: 'user' | 'assistant';
  text: string;
  at: string;
}

/** An organization's conversations with its agents. */
export interface AgentConversations {
  /** The runtime's own memory, for the runtime (`runAgent`, `streamAgent`). */
  readonly memory: Memory;
  /** How the runtime names a person of this organization. */
  resourceOf(personId: string): string;
  /** Her conversations, the latest first. */
  list(personId: string, options?: { limit?: number }): Promise<AgentThread[]>;
  /** What was said in one of her conversations; empty for a conversation that is not hers. */
  read(threadId: string, personId: string, options?: { limit?: number }): Promise<AgentSaid[]>;
  /** Erases one of her conversations for good. Returns whether it was hers. */
  erase(threadId: string, personId: string): Promise<boolean>;
  /** Erases all her conversations for good, when she asks to be forgotten. Returns how many. */
  eraseAll(personId: string): Promise<number>;
}

/**
 * The conversations of one organization, on the app's pool as the application role. A person only
 * reads her own; another organization reads nothing, whatever identifier it gives.
 */
export function agentConversations(options: {
  pool: Pool;
  organizationId: string;
  /** Default `public`. */
  schema?: string;
  /** How many of the last messages the agent is given back (default 20). */
  lastMessages?: number;
}): AgentConversations {
  const organizationId = checkOrganizationId(options.organizationId);
  const schema = checked(options.schema ?? 'public');
  const memory = new Memory({
    storage: new PostgresStore({
      id: `kete-agents-${organizationId}`,
      pool: organizationPool(options.pool, organizationId),
      schemaName: schema,
      // The tables are a migration's, run by the owner: the application role creates nothing.
      disableInit: true,
    }),
    options: { lastMessages: options.lastMessages ?? 20, semanticRecall: false },
  });
  // A person may belong to two organizations: the runtime keys her memory by this name, unique
  // across the deployment.
  const resourceOf = (personId: string) => `${organizationId}/${personId}`;
  const mine = (threadId: string, personId: string) =>
    memory.getThreadById({ threadId, resourceId: resourceOf(personId) });
  return {
    memory,
    resourceOf,
    async list(personId, { limit = 30 } = {}) {
      const { threads } = await memory.listThreads({
        filter: { resourceId: resourceOf(personId) },
        perPage: Math.min(Math.max(limit, 1), 100),
        orderBy: { field: 'updatedAt', direction: 'DESC' },
      });
      return threads.map((thread) => ({
        threadId: thread.id,
        title: thread.title ?? '',
        updatedAt: new Date(thread.updatedAt).toISOString(),
      }));
    },
    async read(threadId, personId, { limit = 100 } = {}) {
      if (!(await mine(threadId, personId))) return [];
      const { messages } = await memory.recall({
        threadId,
        resourceId: resourceOf(personId),
        perPage: Math.min(Math.max(limit, 1), 500),
      });
      return messages.flatMap((message): AgentSaid[] => {
        if (message.role !== 'user' && message.role !== 'assistant') return [];
        const text = message.content.parts
          .flatMap((part) => (part.type === 'text' ? [part.text] : []))
          .join('');
        return text
          ? [{ role: message.role, text, at: new Date(message.createdAt).toISOString() }]
          : [];
      });
    },
    async erase(threadId, personId) {
      if (!(await mine(threadId, personId))) return false;
      await memory.deleteThread(threadId);
      return true;
    },
    async eraseAll(personId) {
      const { threads } = await memory.listThreads({
        filter: { resourceId: resourceOf(personId) },
        perPage: false,
      });
      for (const thread of threads) await memory.deleteThread(thread.id);
      return threads.length;
    },
  };
}
