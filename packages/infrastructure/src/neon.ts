import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { Databases } from './ports.js';

// Neon (spec 121, first in the factory's spec 048): each instance has its own database on the
// project's branch, owned by its owner role; its application role is created by that owner,
// without BYPASSRLS. Creating twice is harmless; so is destroying what is gone.

export interface NeonOptions {
  apiKey: string;
  projectId: string;
  branch: string;
  fetch?: typeof fetch;
  /** Tests: how a SQL client is made; `pg.Client` otherwise. */
  sql?: (connectionString: string) => {
    connect(): Promise<unknown>;
    query(text: string, params?: unknown[]): Promise<{ rowCount: number | null }>;
    end(): Promise<void>;
  };
  /** Tests: Neon applies a role or a database a few seconds after answering. */
  settle?: () => Promise<void>;
}

const identifier = /^[a-z][a-z0-9_]{2,50}$/;

export function neon(options: NeonOptions): Databases {
  const http = options.fetch ?? fetch;
  const settle = options.settle ?? (() => new Promise((resolve) => setTimeout(resolve, 4000)));
  const client = options.sql ?? ((connectionString: string) => new pg.Client({ connectionString }));
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
  async function branchId(): Promise<string> {
    const listed = await api<{ branches: { id: string; name: string }[] }>(
      `/projects/${options.projectId}/branches`,
    );
    const id = listed?.branches.find((b) => b.name === options.branch)?.id;
    if (!id) throw new Error(`No branch ${options.branch}`);
    return id;
  }
  const check = (name: string) => {
    if (!identifier.test(name)) throw new Error(`Not a database name: ${name}`);
  };

  return {
    async create(name) {
      check(name);
      const project = options.projectId;
      const branch = await branchId();
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
      const project = options.projectId;
      const branch = await branchId();
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
  };
}
