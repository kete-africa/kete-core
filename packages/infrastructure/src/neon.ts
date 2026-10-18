import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { Backup, Databases } from './ports.js';

// Neon (spec 121, first in the factory's spec 048): each instance has its own database, owned by
// its owner role; its application role is created by that owner, without BYPASSRLS. Creating twice
// is harmless; so is destroying what is gone.
//
// With `branchPerDatabase` (spec 131: a dedicated instance), each database lives alone on its own
// branch of the project, so it can be backed up and restored alone: a backup is a child branch —
// copy-on-write, no compute — and a restore is Neon's branch restore, at the same address, the
// state just before kept as one more backup. After a restore Neon re-parents the family, so it is
// deleted leaf first.

export interface NeonOptions {
  apiKey: string;
  projectId: string;
  /** The branch the databases are on — or, with `branchPerDatabase`, the one theirs start from. */
  branch: string;
  /** Each database on a branch of its own, so it can be backed up and restored alone. */
  branchPerDatabase?: boolean;
  fetch?: typeof fetch;
  /** Tests: how a SQL client is made; `pg.Client` otherwise. */
  sql?: (connectionString: string) => {
    connect(): Promise<unknown>;
    query(text: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
    end(): Promise<void>;
  };
  /** Tests: Neon applies a role or a database a few seconds after answering. */
  settle?: () => Promise<void>;
  /** Tests: the clock that names a backup. */
  now?: () => Date;
}

const identifier = /^[a-z][a-z0-9_]{2,50}$/;

interface NeonBranch {
  id: string;
  name: string;
  parent_id?: string;
  created_at: string;
}

export function neon(options: NeonOptions): Databases {
  const http = options.fetch ?? fetch;
  const settle = options.settle ?? (() => new Promise((resolve) => setTimeout(resolve, 4000)));
  const now = options.now ?? (() => new Date());
  const client = options.sql ?? ((connectionString: string) => new pg.Client({ connectionString }));
  const project = options.projectId;
  async function api<T>(path: string, init: RequestInit = {}, gone = false): Promise<T | null> {
    const response = await http(`https://console.neon.tech/api/v2${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
    });
    if (gone && response.status === 404) return null;
    const text = await response.text();
    if (!response.ok)
      throw new Error(`Databases ${init.method ?? 'GET'} ${path}: ${response.status}`);
    return (text ? JSON.parse(text) : null) as T;
  }
  const branches = async () =>
    (await api<{ branches: NeonBranch[] }>(`/projects/${project}/branches`))?.branches ?? [];
  async function branchNamed(name: string): Promise<string | null> {
    return (await branches()).find((b) => b.name === name)?.id ?? null;
  }
  async function baseBranch(): Promise<string> {
    const id = await branchNamed(options.branch);
    if (!id) throw new Error(`No branch ${options.branch}`);
    return id;
  }
  /** Until Neon has applied what it was asked: a branch, a restore, a deletion. */
  async function idle(): Promise<void> {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const operations =
        (
          await api<{ operations: { status: string }[] }>(
            `/projects/${project}/operations?limit=20`,
          )
        )?.operations ?? [];
      if (operations.every((o) => ['finished', 'skipped', 'cancelled'].includes(o.status))) return;
      await settle();
    }
    throw new Error('Databases: Neon is still busy.');
  }
  const check = (name: string) => {
    if (!identifier.test(name)) throw new Error(`Not a database name: ${name}`);
  };
  const dedicated = () => {
    if (!options.branchPerDatabase) {
      throw new Error('Databases: backups need a branch per database (branchPerDatabase).');
    }
  };
  const backupPrefix = (name: string) => `${name}--bk-`;
  const stamp = () =>
    now()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d+Z$/, '');
  const backupOf = (b: NeonBranch): Backup => ({ id: b.id, name: b.name, at: b.created_at });

  /** The branch a database is on: its own (made when missing), or the project's. */
  async function branchFor(name: string, make: boolean): Promise<string | null> {
    if (!options.branchPerDatabase) return baseBranch();
    const own = await branchNamed(name);
    if (own || !make) return own;
    const created = await api<{ branch: { id: string } }>(`/projects/${project}/branches`, {
      method: 'POST',
      body: JSON.stringify({
        branch: { parent_id: await baseBranch(), name },
        endpoints: [{ type: 'read_write' }],
      }),
    });
    await idle();
    return created?.branch.id ?? null;
  }

  return {
    async create(name) {
      check(name);
      const branch = await branchFor(name, true);
      if (!branch) throw new Error(`Databases: no branch for ${name}.`);
      const owner = `${name}_owner`;
      const app = `${name}_app`;
      const roles = (
        (await api<{ roles: { name: string }[] }>(`/projects/${project}/branches/${branch}/roles`))
          ?.roles ?? []
      ).map((r) => r.name);
      if (!roles.includes(owner)) {
        await api(`/projects/${project}/branches/${branch}/roles`, {
          method: 'POST',
          body: JSON.stringify({ role: { name: owner } }),
        });
        await settle();
      }
      const databases = (
        (
          await api<{ databases: { name: string }[] }>(
            `/projects/${project}/branches/${branch}/databases`,
          )
        )?.databases ?? []
      ).map((d) => d.name);
      if (!databases.includes(name)) {
        await api(`/projects/${project}/branches/${branch}/databases`, {
          method: 'POST',
          body: JSON.stringify({ database: { name, owner_name: owner } }),
        });
        await settle();
      }
      const found = await api<{ uri: string }>(
        `/projects/${project}/connection_uri?branch_id=${branch}&database_name=${name}&role_name=${owner}&pooled=false`,
      );
      const ownerUrl = found?.uri ?? '';
      const password = randomBytes(24).toString('base64url');
      const sql = client(ownerUrl);
      await sql.connect();
      try {
        const exists = (await sql.query('select 1 from pg_roles where rolname = $1', [app]))
          .rowCount;
        await sql.query(
          `${exists ? 'alter' : 'create'} role ${app} with login password '${password}'`,
        );
        await sql.query(`grant connect on database ${name} to ${app}`);
        await sql.query(`grant usage on schema public to ${app}`);
      } finally {
        await sql.end();
      }
      const appUrl = new URL(ownerUrl);
      appUrl.username = app;
      appUrl.password = password;
      return { ownerUrl, appUrl: appUrl.toString() };
    },

    async destroy(name) {
      check(name);
      if (options.branchPerDatabase) {
        // Its branch and its backups — the whole family, leaf first: a branch with children stays.
        for (let round = 0; round < 20; round += 1) {
          const all = await branches();
          const family = all.filter(
            (b) => b.name === name || b.name.startsWith(backupPrefix(name)),
          );
          if (family.length === 0) return;
          const leaves = family.filter((b) => !all.some((c) => c.parent_id === b.id));
          for (const leaf of leaves) {
            await api(`/projects/${project}/branches/${leaf.id}`, { method: 'DELETE' }, true);
          }
          await idle();
        }
        throw new Error(`Databases: ${name}'s branches are still there.`);
      }
      const branch = await baseBranch();
      const owner = `${name}_owner`;
      const app = `${name}_app`;
      // The application role first, by its owner, while the database is still there — Neon gives
      // an address even for a database that is gone, so its list says whether it is.
      const present = (
        (
          await api<{ databases: { name: string }[] }>(
            `/projects/${project}/branches/${branch}/databases`,
          )
        )?.databases ?? []
      ).some((d) => d.name === name);
      const found = present
        ? await api<{ uri: string }>(
            `/projects/${project}/connection_uri?branch_id=${branch}&database_name=${name}&role_name=${owner}&pooled=false`,
            {},
            true,
          )
        : null;
      if (found?.uri) {
        const sql = client(found.uri);
        await sql.connect();
        try {
          const exists = (await sql.query('select 1 from pg_roles where rolname = $1', [app]))
            .rowCount;
          if (exists) {
            // Since PostgreSQL 16 its creator administers the role without holding its privileges:
            // it takes them first, so what the role was granted can go with it.
            await sql.query(`grant ${app} to ${owner}`);
            await sql.query(`drop owned by ${app}`);
            await sql.query(`drop role ${app}`);
          }
        } finally {
          await sql.end();
        }
      }
      const dropped = await api(
        `/projects/${project}/branches/${branch}/databases/${name}`,
        { method: 'DELETE' },
        true,
      );
      // The owner goes once Neon has applied the database's removal: while it works, it refuses.
      if (dropped) await settle();
      for (let attempt = 1; ; attempt += 1) {
        try {
          await api(
            `/projects/${project}/branches/${branch}/roles/${owner}`,
            { method: 'DELETE' },
            true,
          );
          break;
        } catch (error) {
          const busy = error instanceof Error && /: 42[23]$/.test(error.message);
          if (!busy || attempt >= 6) throw error;
          await settle();
        }
      }
    },

    async backup(name) {
      check(name);
      dedicated();
      const branch = await branchFor(name, false);
      if (!branch) throw new Error(`Databases: no database ${name}.`);
      // A child branch without compute: what the database is now, copy-on-write.
      const made = await api<{ branch: NeonBranch }>(`/projects/${project}/branches`, {
        method: 'POST',
        body: JSON.stringify({
          branch: { parent_id: branch, name: `${backupPrefix(name)}${stamp()}` },
        }),
      });
      await idle();
      if (!made) throw new Error('Databases: no backup made.');
      return backupOf(made.branch);
    },

    async backups(name) {
      check(name);
      dedicated();
      return (await branches())
        .filter((b) => b.name.startsWith(backupPrefix(name)))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(backupOf);
    },

    async restore(name, backupId) {
      check(name);
      dedicated();
      const all = await branches();
      const own = all.find((b) => b.name === name);
      const source = all.find((b) => b.id === backupId && b.name.startsWith(backupPrefix(name)));
      if (!own) throw new Error(`Databases: no database ${name}.`);
      if (!source) throw new Error(`Databases: no backup ${backupId} of ${name}.`);
      const before = `${backupPrefix(name)}${stamp()}-before`;
      await api(`/projects/${project}/branches/${own.id}/restore`, {
        method: 'POST',
        body: JSON.stringify({ source_branch_id: source.id, preserve_under_name: before }),
      });
      await idle();
      const kept = (await branches()).find((b) => b.name === before);
      if (!kept) throw new Error('Databases: the state before the restore was not kept.');
      return { before: backupOf(kept) };
    },
  };
}
