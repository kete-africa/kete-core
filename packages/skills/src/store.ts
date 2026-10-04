import { newId } from '@kete/records';
import { organizationPolicySql, type SqlExecutor } from '@kete/tenancy';
import { z } from 'zod';
import { readSkillArchive, skillArchive, skillVersion, SkillError, type Skill } from './skill.js';

// An organization's skills in its Postgres: each kept with every version it had, opened to whom
// the product says (`everyone`, `unit:sav`, `user:usr_…`), switched on or off. A version is the
// skill's .zip, so what is kept is exactly what Claude, ChatGPT or a provider's sandbox takes.

export interface SkillsMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

/** The skills tables, each with its row-level security in the same migration (constitution). */
export function skillsMigrationSql(options: SkillsMigrationOptions): string {
  const s = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const policy = (table: string) => organizationPolicySql({ schema: s, table, appRole: app });
  return `
create table ${s}.kete_skills (
  organization_id text not null,
  skill_id text not null,
  name text not null check (name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(name) <= 64),
  description text not null check (length(description) between 1 and 1024),
  audience text[] not null default '{everyone}' check (cardinality(audience) between 1 and 200),
  enabled boolean not null default true,
  current_version text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, skill_id),
  unique (organization_id, name)
);
${policy('kete_skills')}
grant select, insert, update, delete on ${s}.kete_skills to ${app};

create table ${s}.kete_skill_versions (
  organization_id text not null,
  skill_id text not null,
  version text not null,
  archive bytea not null,
  size integer not null,
  note text check (length(note) <= 500),
  created_by text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, skill_id, version),
  foreign key (organization_id, skill_id)
    references ${s}.kete_skills (organization_id, skill_id) on delete cascade
);
${policy('kete_skill_versions')}
grant select, insert, delete on ${s}.kete_skill_versions to ${app};
`;
}

export const audienceKey = z.string().regex(/^[a-z]+(:[A-Za-z0-9_.-]{1,80})?$/);
const audience = z.array(audienceKey).min(1).max(200);

export interface StoredSkill {
  skillId: string;
  name: string;
  description: string;
  audience: string[];
  enabled: boolean;
  version: string;
  createdBy: string;
  updatedAt: string;
}

export interface SkillVersion {
  version: string;
  size: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
  current: boolean;
}

type Row = {
  skill_id: string;
  name: string;
  description: string;
  audience: string[];
  enabled: boolean;
  current_version: string;
  created_by: string;
  updated_at: Date;
};
const stored = (r: Row): StoredSkill => ({
  skillId: r.skill_id,
  name: r.name,
  description: r.description,
  audience: r.audience,
  enabled: r.enabled,
  version: r.current_version,
  createdBy: r.created_by,
  updatedAt: r.updated_at.toISOString(),
});
const COLUMNS = `skill_id, name, description, audience, enabled, current_version, created_by, updated_at`;

/**
 * Keeps a skill: a new one, or a new version of the one with its name — the same content is the
 * same version, kept once. The new version becomes the current one.
 */
export async function saveSkill(
  db: SqlExecutor,
  input: {
    organizationId: string;
    skill: Skill;
    by: string;
    audience?: string[];
    note?: string;
  },
): Promise<{ skill: StoredSkill; created: boolean; newVersion: boolean }> {
  const { skill, organizationId } = input;
  const version = skillVersion(skill);
  const archive = skillArchive(skill);
  const existing = await db.query<Row>(`select ${COLUMNS} from kete_skills where name = $1`, [
    skill.name,
  ]);
  const skillId = existing.rows[0]?.skill_id ?? newId('skl');
  if (!existing.rows[0]) {
    await db.query(
      `insert into kete_skills
         (organization_id, skill_id, name, description, audience, current_version, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        organizationId,
        skillId,
        skill.name,
        skill.description,
        audience.parse(input.audience ?? ['everyone']),
        version,
        input.by,
      ],
    );
  }
  const inserted = await db.query(
    `insert into kete_skill_versions (organization_id, skill_id, version, archive, size, note, created_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (organization_id, skill_id, version) do nothing returning version`,
    [
      organizationId,
      skillId,
      version,
      Buffer.from(archive),
      archive.byteLength,
      input.note ?? null,
      input.by,
    ],
  );
  if (existing.rows[0]) {
    await db.query(
      `update kete_skills set current_version = $2, description = $3, updated_at = now()
        where skill_id = $1`,
      [skillId, version, skill.description],
    );
  }
  return {
    skill: (await getStoredSkill(db, skillId)) as StoredSkill,
    created: !existing.rows[0],
    newVersion: inserted.rows.length > 0,
  };
}

export async function getStoredSkill(
  db: SqlExecutor,
  skillId: string,
): Promise<StoredSkill | null> {
  const { rows } = await db.query<Row>(`select ${COLUMNS} from kete_skills where skill_id = $1`, [
    skillId,
  ]);
  return rows[0] ? stored(rows[0]) : null;
}

/** The organization's skills; only those a reader's keys open, when keys are given. */
export async function listSkills(
  db: SqlExecutor,
  options: { readerKeys?: string[]; enabledOnly?: boolean } = {},
): Promise<StoredSkill[]> {
  const { rows } = await db.query<Row>(
    `select ${COLUMNS} from kete_skills
      where ($1::text[] is null or audience && $1::text[]) and (not $2 or enabled)
      order by name`,
    [options.readerKeys ?? null, options.enabledOnly ?? false],
  );
  return rows.map(stored);
}

/** A skill's content: its current version, or the version asked. */
export async function readStoredSkill(
  db: SqlExecutor,
  skillId: string,
  version?: string,
): Promise<Skill | null> {
  const { rows } = await db.query<{ archive: Buffer }>(
    `select v.archive from kete_skill_versions v join kete_skills s using (organization_id, skill_id)
      where v.skill_id = $1 and v.version = coalesce($2, s.current_version)`,
    [skillId, version ?? null],
  );
  if (!rows[0]) return null;
  const [skill] = readSkillArchive(new Uint8Array(rows[0].archive));
  return skill ?? null;
}

/** The skills a reader may use, as the model reads them: enabled, opened by one of her keys. */
export async function skillsFor(db: SqlExecutor, readerKeys: string[]): Promise<Skill[]> {
  const { rows } = await db.query<{ archive: Buffer }>(
    `select v.archive from kete_skills s
       join kete_skill_versions v on v.organization_id = s.organization_id
        and v.skill_id = s.skill_id and v.version = s.current_version
      where s.enabled and s.audience && $1::text[] order by s.name`,
    [readerKeys],
  );
  return rows.flatMap((r) => readSkillArchive(new Uint8Array(r.archive)));
}

export async function skillVersions(db: SqlExecutor, skillId: string): Promise<SkillVersion[]> {
  const { rows } = await db.query<{
    version: string;
    size: number;
    note: string | null;
    created_by: string;
    created_at: Date;
    current: boolean;
  }>(
    `select v.version, v.size, v.note, v.created_by, v.created_at, v.version = s.current_version as current
       from kete_skill_versions v join kete_skills s using (organization_id, skill_id)
      where v.skill_id = $1 order by v.created_at desc`,
    [skillId],
  );
  return rows.map((r) => ({
    version: r.version,
    size: r.size,
    note: r.note,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
    current: r.current,
  }));
}

/** Opens a skill to others, switches it off, or brings back one of its versions. */
export async function updateSkill(
  db: SqlExecutor,
  skillId: string,
  change: { audience?: string[]; enabled?: boolean; version?: string },
): Promise<StoredSkill | null> {
  if (change.version) {
    const known = await db.query(
      `select 1 from kete_skill_versions where skill_id = $1 and version = $2`,
      [skillId, change.version],
    );
    if (!known.rows.length) throw new SkillError(`No version ${change.version} of this skill`);
  }
  await db.query(
    `update kete_skills set
       audience = coalesce($2, audience), enabled = coalesce($3, enabled),
       current_version = coalesce($4, current_version), updated_at = now()
     where skill_id = $1`,
    [
      skillId,
      change.audience ? audience.parse(change.audience) : null,
      change.enabled ?? null,
      change.version ?? null,
    ],
  );
  return getStoredSkill(db, skillId);
}

export async function removeSkill(db: SqlExecutor, skillId: string): Promise<boolean> {
  const { rows } = await db.query(
    `delete from kete_skills where skill_id = $1 returning skill_id`,
    [skillId],
  );
  return rows.length > 0;
}
