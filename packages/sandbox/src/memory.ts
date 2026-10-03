import type {
  AgentPrompt,
  AgentRunStatus,
  CommandResult,
  Sandbox,
  SandboxProvider,
} from './port.js';

// A sandbox in memory, for tests (spec 047): files are kept in a map; commands are answered by a
// script the test gives — nothing is executed.

export type Script = (
  command: string,
  files: Map<string, Uint8Array>,
) => Partial<CommandResult> | undefined;

export interface MemorySandboxProvider extends SandboxProvider {
  /** Every sandbox created, with the commands it ran, its files, and the prompts its agent got. */
  readonly sandboxes: {
    id: string;
    commands: string[];
    files: Map<string, Uint8Array>;
    state: string;
    template: string | null;
    prompts: AgentPrompt[];
  }[];
}

/**
 * How the provider's agent answers, for tests: the status of a run after its n-th look (finished
 * on the second look by default).
 */
export type AgentScript = (prompt: AgentPrompt, look: number) => AgentRunStatus;

export function memoryProvider(
  script: Script = () => undefined,
  agent: AgentScript = (_p, look) => (look < 2 ? 'running' : 'finished'),
): MemorySandboxProvider {
  const looks = new Map<string, number>();
  const sandboxes: MemorySandboxProvider['sandboxes'] = [];
  const handle = (entry: MemorySandboxProvider['sandboxes'][number]): Sandbox => ({
    id: entry.id,
    async run(command) {
      entry.commands.push(command);
      const answer = script(command, entry.files) ?? {};
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false, ...answer };
    },
    async writeFile(path, content) {
      entry.files.set(
        path,
        typeof content === 'string' ? new TextEncoder().encode(content) : content,
      );
    },
    async readFile(path) {
      const content = entry.files.get(path);
      if (!content) throw new Error(`No file at ${path}`);
      return content;
    },
    async prompt(input) {
      entry.prompts.push(input);
      return { runId: `${entry.id}-run-${entry.prompts.length}` };
    },
    async promptStatus(runId) {
      const look = (looks.get(runId) ?? 0) + 1;
      looks.set(runId, look);
      const index = Number(runId.split('-run-')[1] ?? '1') - 1;
      return agent(entry.prompts[index] ?? { agent: 'codex', prompt: '' }, look);
    },
    async stop() {
      entry.state = 'stopped';
    },
    async destroy() {
      entry.state = 'deleted';
    },
  });
  return {
    sandboxes,
    async create(options = {}) {
      const entry = {
        id: `sbx_${sandboxes.length + 1}`,
        commands: [],
        files: new Map(),
        state: 'ready',
        template: options.template ?? null,
        prompts: [],
      };
      sandboxes.push(entry);
      return handle(entry);
    },
    async open(id) {
      const entry = sandboxes.find((s) => s.id === id && s.state !== 'deleted');
      return entry ? handle(entry) : null;
    },
  };
}
