// The port of an isolated computer (spec 047): where an agent runs code, browses or builds, and
// where the app factory codes a new app — never on Kete's own servers. One adapter per provider.

export interface CommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface RunOptions {
  /** Working directory, relative to the sandbox's home. */
  cwd?: string;
  /** Seconds before the command is stopped (1 to 600; default 120). */
  timeoutSeconds?: number;
}

export interface Sandbox {
  readonly id: string;
  /** Runs a shell command and waits for it. */
  run(command: string, options?: RunOptions): Promise<CommandResult>;
  /** Writes a file (text or bytes); its folders are created. */
  writeFile(path: string, content: string | Uint8Array): Promise<void>;
  /** Reads a file as bytes. */
  readFile(path: string): Promise<Uint8Array>;
  /** Pauses it (kept, not billed); `resume` brings it back. */
  stop(): Promise<void>;
  /** Deletes it and everything in it. */
  destroy(): Promise<void>;
}

export interface CreateOptions {
  /** Seconds after which the sandbox stops by itself (a safety net; default one hour). */
  ttlSeconds?: number;
  /** Environment variables of the machine: never a secret of Kete's own. */
  env?: Record<string, string>;
  size?: 'small' | 'default' | 'large';
  /** The same key never creates two sandboxes. */
  idempotencyKey?: string;
}

export interface SandboxProvider {
  create(options?: CreateOptions): Promise<Sandbox>;
  /** A sandbox created earlier, by its id; null when it no longer exists. */
  open(id: string): Promise<Sandbox | null>;
}

export class SandboxError extends Error {
  constructor(
    readonly code: 'unavailable' | 'refused' | 'not_found' | 'timeout' | 'failed',
    message: string,
  ) {
    super(message);
    this.name = 'SandboxError';
  }
}

/** Runs a command and throws when it fails: for steps that must succeed. */
export async function mustRun(
  sandbox: Sandbox,
  command: string,
  options?: RunOptions,
): Promise<CommandResult> {
  const result = await sandbox.run(command, options);
  if (result.timedOut) throw new SandboxError('timeout', `Timed out: ${command}`);
  if (result.exitCode !== 0) {
    throw new SandboxError(
      'failed',
      `Exit ${result.exitCode}: ${command}\n${result.stderr.slice(-2000)}`,
    );
  }
  return result;
}
