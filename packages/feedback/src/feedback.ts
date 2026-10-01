import { actorSchema, type Actor } from '@kete/commands';
import { newId } from '@kete/records';
import { ACTIVE_ORGANIZATION_SQL, type SqlExecutor } from '@kete/tenancy';
import { z } from 'zod';

import { feedbackKinds, type FeedbackKind } from './kinds.js';

export { feedbackKinds, type FeedbackKind };

/** What a person tells: what goes wrong, an idea, or what works; where she was. */
export const feedbackInput = z.object({
  kind: z.enum(feedbackKinds),
  message: z.string().trim().min(1).max(2000),
  /** The screen she was on (a path, never a full address with its query). */
  page: z.string().max(300).optional(),
});

export interface Feedback {
  feedbackId: string;
  kind: FeedbackKind;
  message: string;
  page: string | null;
  personId: string;
  createdAt: Date;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

/**
 * The SQL creating the feedback table, with its RLS policy in the same migration (constitution V).
 * The application role adds and reads; a feedback is never changed.
 */
export function feedbackMigrationSql(options: { schema?: string; appRole: string }): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const t = `${schema}.kete_feedback`;
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${t} (
  feedback_id text primary key,
  organization_id text not null,
  person_id text not null,
  kind text not null check (kind in ('problem', 'idea', 'praise')),
  message text not null check (length(message) between 1 and 2000),
  page text,
  created_at timestamptz not null default now()
);
create index kete_feedback_recent on ${t} (organization_id, created_at desc);

alter table ${t} enable row level security;
create policy kete_feedback_isolation on ${t} as permissive for all to ${app}
  using (${organization})
  with check (${organization});
grant usage on schema ${schema} to ${app};
revoke all on ${t} from ${app};
grant select, insert on ${t} to ${app};
`;
}

export class FeedbackError extends Error {
  constructor(
    readonly code: 'invalid_input' | 'not_a_person',
    readonly issues?: z.ZodError['issues'],
  ) {
    super(code);
    this.name = 'FeedbackError';
  }
}

/** Keeps a person's feedback, in her organization (the transaction's, see @kete/tenancy). */
export async function submitFeedback(
  db: SqlExecutor,
  submission: { organizationId: string; actor: Actor; input: unknown },
): Promise<{ feedbackId: string }> {
  const actor = actorSchema.parse(submission.actor);
  if (actor.kind !== 'person') throw new FeedbackError('not_a_person');
  const parsed = feedbackInput.safeParse(submission.input);
  if (!parsed.success) throw new FeedbackError('invalid_input', parsed.error.issues);
  const feedbackId = newId('fbk');
  await db.query(
    `insert into kete_feedback (feedback_id, organization_id, person_id, kind, message, page)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      feedbackId,
      submission.organizationId,
      actor.id,
      parsed.data.kind,
      parsed.data.message,
      parsed.data.page?.split('?')[0] ?? null,
    ],
  );
  return { feedbackId };
}

/** The organization's latest feedback, newest first. */
export async function listFeedback(db: SqlExecutor, limit = 50): Promise<Feedback[]> {
  const { rows } = await db.query<{
    feedback_id: string;
    kind: FeedbackKind;
    message: string;
    page: string | null;
    person_id: string;
    created_at: Date;
  }>(
    `select feedback_id, kind, message, page, person_id, created_at from kete_feedback
      order by created_at desc limit $1`,
    [Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((row) => ({
    feedbackId: row.feedback_id,
    kind: row.kind,
    message: row.message,
    page: row.page,
    personId: row.person_id,
    createdAt: row.created_at,
  }));
}

/**
 * `POST` a feedback, as a web-standard handler: the host says who calls (her session) and runs
 * the work in her organization's transaction.
 */
export function createFeedbackHandler(options: {
  caller(request: Request): Promise<{ organizationId: string; actor: Actor } | null>;
  transaction<T>(organizationId: string, work: (db: SqlExecutor) => Promise<T>): Promise<T>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') return new Response(null, { status: 405 });
    const caller = await options.caller(request);
    if (!caller) return Response.json({ error: 'unauthenticated' }, { status: 401 });
    const input: unknown = await request.json().catch(() => null);
    try {
      const saved = await options.transaction(caller.organizationId, (db) =>
        submitFeedback(db, { ...caller, input }),
      );
      return Response.json(saved, { status: 201 });
    } catch (error) {
      if (error instanceof FeedbackError) {
        return Response.json({ error: error.code }, { status: 422 });
      }
      throw error;
    }
  };
}
