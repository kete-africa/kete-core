import type { CommandResult, Sandbox, SandboxProvider } from './port.js';

// A sandbox in memory, for tests (spec 047): files are kept in a map; commands are answered by a
// script the test gives — nothing is executed.

export type Script = (
  command: string,
  files: Map<string, Uint8Array>,
) => Partial<CommandResult> | undefined;

export interface MemorySandboxProvider extends SandboxProvider {
  /** Every sandbox created, with the commands it ran and its files. */
  readonly sandboxes: {
    id: string;
    commands: string[];
    files: Map<string, Uint8Array>;
    state: string;
  }[];
}

export function memoryProvider(script: Script = () => undefined): MemorySandboxProvider {
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
    async stop() {
      entry.state = 'stopped';
    },
    async destroy() {
      entry.state = 'deleted';
    },
  });
  return {
    sandboxes,
    async create() {
      const entry = {
        id: `sbx_${sandboxes.length + 1}`,
        commands: [],
        files: new Map(),
        state: 'ready',
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
