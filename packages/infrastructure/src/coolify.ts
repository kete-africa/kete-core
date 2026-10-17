import type { HostedStatus, Hosting } from './ports.js';

// Coolify (spec 121, first in the factory's spec 048): each instance is a private GitHub
// application deployed from its `dev` branch, its image built from its Dockerfile, its secrets set
// as environment variables (build secrets for the packages token). The token used is reserved to
// its caller, revocable alone.

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

/** Coolify's word for an application's state, said as the port's. */
export function hostedStatusOf(status: string | undefined): HostedStatus {
  const word = (status ?? '').toLowerCase();
  if (word.startsWith('running')) return 'running';
  if (word.startsWith('starting') || word.startsWith('restarting')) return 'starting';
  if (word.startsWith('exited') || word.startsWith('stopped')) return 'stopped';
  if (word.startsWith('degraded') || word.includes('failed')) return 'failed';
  return 'unknown';
}

export function coolify(options: CoolifyOptions): Hosting {
  const http = options.fetch ?? fetch;
  const base = `${options.url.replace(/\/$/, '')}/api/v1`;
  async function call<T>(
    method: string,
    path: string,
    body?: unknown,
    gone = false,
  ): Promise<T | null> {
    const response = await http(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${options.token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (gone && response.status === 404) return null;
    const text = await response.text();
    if (!response.ok) throw new Error(`Hosting ${method} ${path}: ${response.status}`);
    return (text ? JSON.parse(text) : null) as T;
  }
  return {
    async ensureApp({ name, repository, domain, description }) {
      const apps = (await call<{ name: string; uuid: string }[]>('GET', '/applications')) ?? [];
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
        // The port says a host (`kya.kete.software`); Coolify serves an address.
        domains: /^https?:\/\//.test(domain) ? domain : `https://${domain}`,
        name,
        description,
        instant_deploy: false,
      });
      if (!created) throw new Error('Hosting: no application created.');
      await call('PATCH', `/applications/${created.uuid}`, { use_build_secrets: true });
      return { id: created.uuid };
    },
    async setEnv(id, runtime, build) {
      const current = new Set(
        ((await call<{ key: string }[]>('GET', `/applications/${id}/envs`)) ?? []).map(
          (e) => e.key,
        ),
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
    async status(id) {
      const app = await call<{ status?: string }>('GET', `/applications/${id}`, undefined, true);
      return app ? hostedStatusOf(app.status) : 'unknown';
    },
    async destroy(id) {
      await call(
        'DELETE',
        `/applications/${encodeURIComponent(id)}?delete_configurations=true&delete_volumes=true&docker_cleanup=true&delete_connected_networks=true`,
        undefined,
        true,
      );
    },
  };
}
