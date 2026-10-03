import { mustRun, type Sandbox } from '@kete/sandbox';
import type { CodingAgent } from '../ports.js';

// The coding agents (spec 048). The sandbox is the isolation: the agent may run anything inside
// it, and nothing outside. Two ways to run one:
// - the sandbox provider's own agent, signed in once by the account's owner (a ChatGPT
//   subscription, for instance), passed to the sandbox by a template that gives nothing else;
// - an agent the factory installs and signs in itself, with credentials it writes to a file.

const LOG = '/tmp/kete-agent.log';
const DONE = '/tmp/kete-agent.done';

/** The provider's own agent: started and followed through the provider. */
export function integratedAgent(options: {
  agent: 'codex' | 'claude-code';
  model?: string;
  reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
  /** The provider's template holding the agent's sign-in only. */
  template: string;
}): CodingAgent {
  return {
    template: options.template,
    async start(sandbox, prompt) {
      if (!sandbox.prompt) throw new Error('This sandbox provider runs no agent of its own.');
      const { runId } = await sandbox.prompt({
        agent: options.agent,
        ...(options.model ? { model: options.model } : {}),
        ...(options.reasoningEffort ? { reasoningEffort: options.reasoningEffort } : {}),
        prompt: `The repository is cloned in ~/app: work there, and only there.\n\n${prompt}`,
      });
      return runId;
    },
    async status(sandbox, run) {
      const status = await sandbox.promptStatus?.(run);
      if (status === 'finished') return 'finished';
      if (status === 'failed' || status === 'interrupted') return 'failed';
      return 'running';
    },
    async log(sandbox, run) {
      return `run ${run}: ${(await sandbox.promptStatus?.(run)) ?? 'unknown'}`;
    },
  };
}

/** An agent the factory runs as a shell command, in the background, its log and exit in files. */
function shellAgent(options: {
  prepare(sandbox: Sandbox): Promise<void>;
  command(promptFile: string, logFile: string): string;
}): CodingAgent {
  return {
    async start(sandbox, prompt) {
      await options.prepare(sandbox);
      await sandbox.writeFile('prompt.md', prompt);
      await mustRun(
        sandbox,
        `cd app && ([ -f ../.agent-env ] && . ../.agent-env; ${options.command('../prompt.md', LOG)}; echo $? > ${DONE}) > /dev/null 2>&1 &`,
        { timeoutSeconds: 30 },
      );
      return 'shell';
    },
    async status(sandbox) {
      const done = await sandbox.run(`cat ${DONE} 2>/dev/null || echo running`, {
        timeoutSeconds: 20,
      });
      const value = done.stdout.trim();
      return value === 'running' ? 'running' : value === '0' ? 'finished' : 'failed';
    },
    async log(sandbox) {
      return (await sandbox.run(`tail -c 3000 ${LOG}`, { timeoutSeconds: 20 })).stdout;
    },
  };
}

/** Codex, signed in with the auth.json of a ChatGPT subscription the operator provided. */
export function codex(options: { authJson: string }): CodingAgent {
  return shellAgent({
    async prepare(sandbox) {
      await mustRun(sandbox, 'npm install -g @openai/codex@latest > /dev/null 2>&1', {
        timeoutSeconds: 300,
      });
      await mustRun(sandbox, 'mkdir -p ~/.codex && chmod 700 ~/.codex', { timeoutSeconds: 10 });
      await sandbox.writeFile('.codex/auth.json', options.authJson);
      await mustRun(sandbox, 'chmod 600 ~/.codex/auth.json', { timeoutSeconds: 10 });
    },
    command(promptFile, logFile) {
      return `codex exec --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check "$(cat ${promptFile})" > ${logFile} 2>&1`;
    },
  });
}

/** Claude Code, with an API key in the agent's own environment file. */
export function claudeCode(options: { apiKey: string }): CodingAgent {
  return shellAgent({
    async prepare(sandbox) {
      await mustRun(sandbox, 'npm install -g @anthropic-ai/claude-code@latest > /dev/null 2>&1', {
        timeoutSeconds: 300,
      });
      // The key goes through a file, never through a command line.
      await sandbox.writeFile('.agent-key', options.apiKey);
      await mustRun(
        sandbox,
        `printf "export ANTHROPIC_API_KEY='%s'\\n" "$(cat .agent-key)" > .agent-env && chmod 600 .agent-env && rm .agent-key`,
        { timeoutSeconds: 10 },
      );
    },
    command(promptFile, logFile) {
      return `claude -p "$(cat ${promptFile})" --dangerously-skip-permissions > ${logFile} 2>&1`;
    },
  });
}
