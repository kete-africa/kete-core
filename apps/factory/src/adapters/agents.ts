import { mustRun } from '@kete/sandbox';
import type { CodingAgent } from '../ports.js';

// The coding agents (spec 048), each signed in inside the sandbox only. Codex can use a ChatGPT
// subscription (its auth.json, from `codex login`) or an API key; Claude Code uses an API key.
// The sandbox is the isolation: the agent may run anything inside it, and nothing outside.

/** Codex, signed in with the ChatGPT subscription whose auth.json the operator provided. */
export function codex(options: { authJson: string }): CodingAgent {
  return {
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
  };
}

/** Claude Code, with an API key added to the sandbox's environment file. */
export function claudeCode(options: { apiKey: string }): CodingAgent {
  return {
    async prepare(sandbox) {
      await mustRun(sandbox, 'npm install -g @anthropic-ai/claude-code@latest > /dev/null 2>&1', {
        timeoutSeconds: 300,
      });
      // The key goes through a file, never through a command line.
      await sandbox.writeFile('.agent-key', options.apiKey);
      await mustRun(
        sandbox,
        `printf "export ANTHROPIC_API_KEY='%s'\\n" "$(cat .agent-key)" >> .factory-env && rm .agent-key`,
        { timeoutSeconds: 10 },
      );
    },
    command(promptFile, logFile) {
      return `claude -p "$(cat ${promptFile})" --dangerously-skip-permissions > ${logFile} 2>&1`;
    },
  };
}
