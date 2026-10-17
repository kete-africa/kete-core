import type { AppHolding } from '@kete/center';
import type { SqlExecutor } from '@kete/tenancy';
import { env } from '@/platform/env';

/**
 * The open tasks, as the center holds them (kete-core spec 114): each held by who wrote it, due on
 * its day. A task done is no longer said: the center finishes it.
 */
export async function taskHoldings(db: SqlExecutor): Promise<AppHolding[]> {
  const { rows } = await db.query<{
    task_id: string;
    title: string;
    due_on: string | null;
    created_by: string;
    created_at: Date;
  }>(
    `select task_id, title, to_char(due_on, 'YYYY-MM-DD') as due_on, created_by, created_at
       from tasks where status = 'open' order by created_at limit 500`,
  );
  return rows.map((r) => ({
    kind: 'task',
    ref: r.task_id,
    object: { kind: 'task', id: r.task_id },
    what: r.title,
    holder: { kind: 'person', id: r.created_by },
    since: r.created_at.toISOString(),
    ...(r.due_on ? { due: r.due_on } : {}),
    state: 'held',
    href: `${env.publicUrl}/taches/${r.task_id}`,
  }));
}
