import type { Sandbox, SandboxProvider } from '@kete/sandbox';
import type { AppRequest, Progress, RequestStatus } from './request.js';

// What the factory needs from the outside world (spec 048), as ports: each one has its adapter
// (src/adapters) and a fake in the tests. Vendor names stay in the adapters.

export interface CodeHost {
  /** Creates the private repository if it does not exist yet. */
  ensureRepository(name: string, description: string): Promise<{ fullName: string }>;
  /** A short-lived token to push over https, for one step. */
  pushToken(): Promise<string>;
  /** Sets an Actions secret of the repository (encrypted for it). */
  setSecret(fullName: string, name: string, value: string): Promise<void>;
  openPullRequest(
    fullName: string,
    pull: { head: string; base: string; title: string; body: string },
  ): Promise<{ url: string }>;
}

export interface Databases {
  /** A database of its own, with an owner role and an application role (no BYPASSRLS). */
  create(name: string): Promise<{ ownerUrl: string; appUrl: string }>;
}

export interface Identity {
  /** Registers the app at the Compte Kete: people sign in to it. Its secret is given once. */
  registerApp(input: { name: string; redirectUri: string }): Promise<{
    clientId: string;
    clientSecret: string;
  }>;
}

export interface Hosting {
  ensureApp(input: {
    name: string;
    repository: string;
    domain: string;
    description: string;
  }): Promise<{ id: string }>;
  setEnv(id: string, runtime: Record<string, string>, build: Record<string, string>): Promise<void>;
  deploy(id: string): Promise<void>;
}

/** The agent that codes the first version, inside a sandbox. */
export interface CodingAgent {
  /** Installs and signs the agent in, inside the sandbox (its credentials never leave it). */
  prepare(sandbox: Sandbox): Promise<void>;
  /** The shell command that runs it on a prompt file, writing its log to a file. */
  command(promptFile: string, logFile: string): string;
}

export interface FactoryConfig {
  /** The domain the apps are served under: `<repository>.<appsDomain>`. */
  appsDomain: string;
  /** read:packages token for Kete's private packages (installs and CI). */
  packagesToken: string;
  accountUrl: string;
  enterpriseApiUrl: string;
  environment: 'staging' | 'production';
  operatorsOrganizationId: string;
  /** The organization of the repositories, e.g. `kete-africa`. */
  repositoryOwner: string;
}

export interface Ports {
  code: CodeHost;
  databases: Databases;
  identity: Identity;
  hosting: Hosting;
  sandboxes: SandboxProvider;
  agent: CodingAgent;
  /** Tells Kete Enterprise where the request stands, signed. */
  report(request: AppRequest, status: RequestStatus, progress: Progress): Promise<void>;
  config: FactoryConfig;
}
