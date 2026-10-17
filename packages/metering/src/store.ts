import { newId } from '@kete/records';
import { ACTIVE_ORGANIZATION_SQL, type SqlExecutor } from '@kete/tenancy';
import { MeterError, type Meters } from './meters.js';

// Who consumed what (spec 120): each measure in an append-only journal, with its certainty — known
// (counted), estimated (computed from a known rate) or unavailable (the source did not say) — so a
// total never passes a guess off as a count, nor a gap as a zero.

export interface MeteringMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

export function meteringMigrationSql(options: MeteringMigrationOptions): string {
  const s = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${s}.kete_measures (
  measure_id text primary key,
  organization_id text not null,
  meter text not null check (meter ~ '^[a-z][a-z0-9_]{0,30}\\.[a-z][a-z0-9_]{0,40}$'),
  quantity numeric check (quantity is null or quantity >= 0),
  certainty text not null check (certainty in ('known', 'estimated', 'unavailable')),
  subject_kind text check (subject_kind in ('person', 'agent', 'project', 'app', 'instance')),
  subject_id text check (subject_id is null or length(subject_id) between 1 and 128),
  source text not null check (source ~ '^[a-z][a-z0-9_.-]{0,40}$'),
  period_start timestamptz not null,
  period_end timestamptz not null,
  reason text check (reason is null or length(reason) <= 300),
  key text check (key is null or length(key) between 1 and 200),
  recorded_at timestamptz not null default now(),
  check ((certainty = 'unavailable') = (quantity is null)),
  check (period_end >= period_start),
  check ((subject_kind is null) = (subject_id is null)),
  unique (organization_id, key)
);
create index kete_measures_by_period on ${s}.kete_measures (organization_id, meter, period_start);
alter table ${s}.kete_measures enable row level security;
create policy kete_measures_isolation on ${s}.kete_measures as permissive for all to ${app}
  using (${organization}) with check (${organization});

grant usage on schema ${s} to ${app};
revoke all on ${s}.kete_measures from ${app};
grant select, insert on ${s}.kete_measures to ${app};
`;
}

export type Certainty = 'known' | 'estimated' | 'unavailable';

/** Who or what consumed: a person, an agent, a project, an app, an instance. */
export interface Subject {
  kind: 'person' | 'agent' | 'project' | 'app' | 'instance';
  id: string;
}

interface MeasureBase {
  meter: string;
  subject?: Subject;
  /** Who reported it: `kete-ai`, `sandbox`, the provisioner's adapter. */
  source: string;
  from: Date;
  /** The end of the period measured; the start for an instant. */
  to?: Date;
  /** Sent twice — a retried job — it is kept once. */
  key?: string;
}

/**
 * Records what was consumed, counted or estimated. Kept once per `key`. False when that key was
 * already kept.
 */
export async function measure(
  db: SqlExecutor,
  organizationId: string,
  meters: Meters,
  input: MeasureBase & { quantity: number; certainty: 'known' | 'estimated' },
): Promise<boolean> {
  meters.require(input.meter);
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new MeterError('invalid_measure', `« ${input.meter} »: a quantity of ${input.quantity}.`);
  }
  return insert(db, organizationId, { ...input, reason: null });
}

/** Says that a source could not tell what was consumed over a period: a gap, never a zero. */
export async function unavailable(
  db: SqlExecutor,
  organizationId: string,
  meters: Meters,
  input: MeasureBase & { reason: string },
): Promise<boolean> {
  meters.require(input.meter);
  return insert(db, organizationId, { ...input, quantity: null, certainty: 'unavailable' });
}

async function insert(
  db: SqlExecutor,
  organizationId: string,
  input: MeasureBase & { quantity: number | null; certainty: Certainty; reason: string | null },
): Promise<boolean> {
  const to = input.to ?? input.from;
  if (to < input.from)
    throw new MeterError('invalid_measure', 'A period that ends before it starts.');
  const { rows } = await db.query(
    `insert into kete_measures (measure_id, organization_id, meter, quantity, certainty,
       subject_kind, subject_id, source, period_start, period_end, reason, key)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (organization_id, key) do nothing returning measure_id`,
    [
      newId('msr'),
      organizationId,
      input.meter,
      input.quantity,
      input.certainty,
      input.subject?.kind ?? null,
      input.subject?.id ?? null,
      input.source,
      input.from,
      to,
      input.reason ? input.reason.slice(0, 300) : null,
      input.key ?? null,
    ],
  );
  return rows.length > 0;
}

/** A total, with how sure it is: `unavailable` when a gap lies in the period — then at least. */
export interface Consumption {
  meter: string;
  subject: Subject | null;
  quantity: number;
  certainty: Certainty;
  /** The periods a source could not tell, within the window. */
  gaps: number;
}

/**
 * What was consumed between `from` (included) and `to` (excluded), by meter — and by subject when
 * asked. Known when every measure was counted; estimated when one was; unavailable when a source
 * could not tell (the quantity is then what is known, at least).
 */
export async function consumption(
  db: SqlExecutor,
  query: { from: Date; to: Date; meter?: string; bySubject?: boolean },
): Promise<Consumption[]> {
  const subject = query.bySubject ? ', subject_kind, subject_id' : '';
  const { rows } = await db.query<{
    meter: string;
    subject_kind?: Subject['kind'] | null;
    subject_id?: string | null;
    quantity: string | null;
    estimated: string;
    gaps: string;
  }>(
    `select meter${subject},
            sum(quantity) as quantity,
            count(*) filter (where certainty = 'estimated') as estimated,
            count(*) filter (where certainty = 'unavailable') as gaps
       from kete_measures
      where period_start >= $1 and period_start < $2 and ($3::text is null or meter = $3)
      group by meter${subject}
      order by meter${subject}`,
    [query.from, query.to, query.meter ?? null],
  );
  return rows.map((r) => {
    const gaps = Number(r.gaps);
    return {
      meter: r.meter,
      subject: r.subject_kind && r.subject_id ? { kind: r.subject_kind, id: r.subject_id } : null,
      quantity: Number(r.quantity ?? 0),
      certainty: gaps > 0 ? 'unavailable' : Number(r.estimated) > 0 ? 'estimated' : 'known',
      gaps,
    };
  });
}
