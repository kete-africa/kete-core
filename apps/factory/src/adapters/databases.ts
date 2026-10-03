import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { Databases } from '../ports.js';

// Neon (spec 048): each app has its own database on the project's branch, owned by its owner role;
// its application role is created by that owner, without BYPASSRLS. Creating twice is harmless.

export interface NeonOptions {
  apiKey: string;
  projectId: string;
  branch: string;
  fetch?: typeof fetch;
}

const identifier = /^[a-z][a-z0-9_]{2,50}$/;

export function neon(options: NeonOptions): Databases {
  const http = options.fetch ?? fetch;
  async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await http(`https://console.neon.tech/api/v2${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        'content-type': 'application/json',
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Databases ${path}: ${response.status}`);
    return (text ? JSON.parse(text) : null) as T;
  }
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  return {
    async create(name) {
      if (!identifier.test(name)) throw new Error(`Not a database name: ${name}`);
      const project = options.projectId;
      const { branches } = await api<{ branches: { id: string; name: string }[] }>(
        `/projects/${project}/branches`,
      );
      const branch = branches.find((b) => b.name === options.branch)?.id;
      if (!branch) throw new Error(`No branch ${options.branch}`);
      const owner = `${name}_owner`;
      const app = `${name}_app`;
      const roles = (
        await api<{ roles: { name: string }[] }>(`/projects/${project}/branches/${branch}/roles`)
      ).roles.map((r) => r.name);
      if (!roles.includes(owner)) {
        await api(`/projects/${project}/branches/${branch}/roles`, {
          method: 'POST',
          body: JSON.stringify({ role: { name: owner } }),
        });
        await wait(4000);
      }
      const databases = (
        await api<{ databases: { name: string }[] }>(
          `/projects/${project}/branches/${branch}/databases`,
        )
      ).databases.map((d) => d.name);
      if (!databases.includes(name)) {
        await api(`/projects/${project}/branches/${branch}/databases`, {
          method: 'POST',
          body: JSON.stringify({ database: { name, owner_name: owner } }),
        });
        await wait(4000);
      }
      const { uri: ownerUrl } = await api<{ uri: string }>(
        `/projects/${project}/connection_uri?branch_id=${branch}&database_name=${name}&role_name=${owner}&pooled=false`,
      );
      const password = randomBytes(24).toString('base64url');
      const client = new pg.Client({ connectionString: ownerUrl });
      await client.connect();
      try {
        const exists = (await client.query('select 1 from pg_roles where rolname = $1', [app]))
          .rowCount;
        await client.query(
          `${exists ? 'alter' : 'create'} role ${app} with login password '${password}'`,
        );
        await client.query(`grant connect on database ${name} to ${app}`);
        await client.query(`grant usage on schema public to ${app}`);
      } finally {
        await client.end();
      }
      const appUrl = new URL(ownerUrl);
      appUrl.username = app;
      appUrl.password = password;
      return { ownerUrl, appUrl: appUrl.toString() };
    },
  };
}
