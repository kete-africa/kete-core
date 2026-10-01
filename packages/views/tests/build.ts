import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export default function setup(): void {
  execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    stdio: 'inherit',
    // Vitest runs under NODE_ENV=test: the page must be the production build.
    env: { ...process.env, NODE_ENV: 'production' },
    shell: process.platform === 'win32',
  });
}
