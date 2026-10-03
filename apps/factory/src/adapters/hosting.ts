import type { Hosting } from '../ports.js';

// Coolify (spec 048): each app is a private GitHub application deployed from its `dev` branch, its
// image built from its Dockerfile, its secrets set as environment variables (build secrets for the
// packages token). The factory's own token is reserved to it, revocable alone.

export interface CoolifyOptions {
  url: string;
  token: string;
  projectId: string;
  serverId: string;
  environment: string;
  /** The GitHub App Coolify uses to read the organization's repositories. */
  githubAppId: string;
  fetch?: typeof fetch;
}

export function coolify(options: CoolifyOptions): Hosting {
  const http = options.fetch ?? fetch;
  const base = `${options.url.replace(/\/$/, '')}/api/v1`;
  async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await http(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Hosting ${method} ${path}: ${response.status}`);
    return (text ? JSON.parse(text) : null) as T;
  }
  return {
    async ensureApp({ name, repository, domain, description }) {
      const apps = await call<{ name: string; uuid: string }[]>('GET', '/applications');
      const existing = apps.find((app) => app.name === name);
      if (existing) return { id: existing.uuid };
      const created = await call<{ uuid: string }>('POST', '/applications/private-github-app', {
        project_uuid: options.projectId,
        server_uuid: options.serverId,
        environment_name: options.environment,
        github_app_uuid: options.githubAppId,
        git_repository: repository,
        git_branch: 'dev',
        build_pack: 'dockerfile',
        dockerfile_location: '/Dockerfile',
        base_directory: '/',
        ports_exposes: '3000',
        domains: domain,
        name,
        description,
        instant_deploy: false,
      });
      await call('PATCH', `/applications/${created.uuid}`, { use_build_secrets: true });
      return { id: created.uuid };
    },
    async setEnv(id, runtime, build) {
      const current = new Set(
        (await call<{ key: string }[]>('GET', `/applications/${id}/envs`)).map((e) => e.key),
      );
      const put = async (key: string, value: string, buildtime: boolean) =>
        call(current.has(key) ? 'PATCH' : 'POST', `/applications/${id}/envs`, {
          key,
          value,
          is_literal: true,
          is_preview: false,
          is_buildtime: buildtime,
          is_runtime: !buildtime,
        });
      for (const [key, value] of Object.entries(runtime)) await put(key, value, false);
      for (const [key, value] of Object.entries(build)) await put(key, value, true);
    },
    async deploy(id) {
      await call('POST', `/deploy?uuid=${encodeURIComponent(id)}`);
    },
  };
}
