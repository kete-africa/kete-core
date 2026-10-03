import { inOrganization, organizationPolicySql } from '@kete/tenancy';
import type pg from 'pg';
import type { AppRequest, Progress, RequestStatus } from './request.js';

/**
 * The factory's requests (spec 048): what was asked, where it stands, what it produced — never a
 * secret. Row-level security per organization in the same migration (constitution V).
 */
export function factoryMigrationSql(options: { schema: string; appRole: string }): string {
  const s = options.schema;
  return `
create table if not exists ${s}.factory_requests (
  request_id text primary key,
  organization_id text not null,
  request jsonb not null,
  status text not null default 'queued'
    check (status in ('queued', 'building', 'ready', 'coding', 'review', 'failed')),
  progress jsonb not null default '{"done": []}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
${organizationPolicySql({ schema: s, table: 'factory_requests', appRole: options.appRole })}
grant select, insert, update on ${s}.factory_requests to ${options.appRole};
`;
}

export interface StoredRequest {
  request: AppRequest;
  status: RequestStatus;
  progress: Progress;
}

export function requestStore(pool: pg.Pool) {
  return {
    /** Records a request once: the same id again changes nothing. */
    async add(request: AppRequest): Promise<boolean> {
      return inOrganization(pool, request.organizationId, async (db) => {
        const { rows } = await db.query(
          `insert into factory_requests (request_id, organization_id, request)
           values ($1, $2, $3) on conflict (request_id) do nothing returning request_id`,
          [request.requestId, request.organizationId, JSON.stringify(request)],
        );
        return rows.length > 0;
      });
    },
    async get(organizationId: string, requestId: string): Promise<StoredRequest | null> {
      return inOrganization(pool, organizationId, async (db) => {
        const { rows } = await db.query<{
          request: AppRequest;
          status: RequestStatus;
          progress: Progress;
        }>(`select request, status, progress from factory_requests where request_id = $1`, [
          requestId,
        ]);
        return rows[0] ?? null;
      });
    },
    async save(
      organizationId: string,
      requestId: string,
      status: RequestStatus,
      progress: Progress,
    ): Promise<void> {
      await inOrganization(pool, organizationId, (db) =>
        db.query(
          `update factory_requests set status = $2, progress = $3, updated_at = now()
            where request_id = $1`,
          [requestId, status, JSON.stringify(progress)],
        ),
      );
    },
  };
}

export type RequestStore = ReturnType<typeof requestStore>;
