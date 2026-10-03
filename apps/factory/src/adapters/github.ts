import { createSign } from 'node:crypto';
import { createRequire } from 'node:module';
import type Sodium from 'libsodium-wrappers';
import type { CodeHost } from '../ports.js';

// libsodium-wrappers' ES module imports a file of another package, which pnpm's strict layout does
// not expose: the factory failed at start. Its CommonJS build resolves it.
const sodium = createRequire(import.meta.url)('libsodium-wrappers') as typeof Sodium;

/** Seals a value for a repository's public key (base64): only GitHub opens it. */
export async function sealForGitHub(value: string, publicKey: string): Promise<string> {
  await sodium.ready;
  const sealed = sodium.crypto_box_seal(
    sodium.from_string(value),
    sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL),
  );
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}

// GitHub, through a GitHub App installed on the organization (spec 048): short-lived installation
// tokens, never a person's token. The App's private key is read from a file by the caller.

export interface GitHubAppOptions {
  appId: string;
  installationId: string;
  privateKey: string;
  owner: string;
  fetch?: typeof fetch;
}

function appJwt(appId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  // Issued a minute early (clock drift), valid nine minutes (GitHub allows ten).
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: appId })}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(privateKey)
    .toString('base64url');
  return `${unsigned}.${signature}`;
}

export function githubApp(options: GitHubAppOptions): CodeHost {
  const http = options.fetch ?? fetch;
  let cached: { token: string; expiresAt: number } | null = null;

  async function installationToken(): Promise<string> {
    if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token;
    const response = await http(
      `https://api.github.com/app/installations/${options.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${appJwt(options.appId, options.privateKey)}`,
          accept: 'application/vnd.github+json',
        },
      },
    );
    if (!response.ok) throw new Error(`GitHub installation token: ${response.status}`);
    const answer = (await response.json()) as { token: string; expires_at: string };
    cached = { token: answer.token, expiresAt: Date.parse(answer.expires_at) };
    return answer.token;
  }

  async function api<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: T }> {
    const response = await http(`https://api.github.com${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await installationToken()}`,
        accept: 'application/vnd.github+json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    return { status: response.status, data: (text ? JSON.parse(text) : null) as T };
  }

  return {
    async ensureRepository(name, description) {
      const found = await api<{ full_name: string }>('GET', `/repos/${options.owner}/${name}`);
      if (found.status === 200) return { fullName: found.data.full_name };
      const created = await api<{ full_name: string }>('POST', `/orgs/${options.owner}/repos`, {
        name,
        description,
        private: true,
        auto_init: false,
        has_wiki: false,
      });
      if (created.status !== 201) throw new Error(`GitHub repository ${name}: ${created.status}`);
      return { fullName: created.data.full_name };
    },
    pushToken: installationToken,
    async setSecret(fullName, name, value) {
      const key = await api<{ key: string; key_id: string }>(
        'GET',
        `/repos/${fullName}/actions/secrets/public-key`,
      );
      if (key.status !== 200) throw new Error(`GitHub secret key: ${key.status}`);
      // A sealed box for the repository's key: only GitHub can open it.
      const put = await api('PUT', `/repos/${fullName}/actions/secrets/${name}`, {
        encrypted_value: await sealForGitHub(value, key.data.key),
        key_id: key.data.key_id,
      });
      if (put.status !== 201 && put.status !== 204)
        throw new Error(`GitHub secret ${name}: ${put.status}`);
    },
    async openPullRequest(fullName, pull) {
      const created = await api<{ html_url: string }>('POST', `/repos/${fullName}/pulls`, pull);
      if (created.status === 201) return { url: created.data.html_url };
      // Already open: the same pull request.
      const owner = fullName.split('/')[0];
      const open = await api<{ html_url: string }[]>(
        'GET',
        `/repos/${fullName}/pulls?head=${owner}:${encodeURIComponent(pull.head)}&state=open`,
      );
      const existing = open.data?.[0];
      if (!existing) throw new Error(`GitHub pull request: ${created.status}`);
      return { url: existing.html_url };
    },
  };
}
