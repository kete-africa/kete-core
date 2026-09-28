/**
 * DESIGN.md is the source of truth of the design system.
 * Lints it (no error, no warning) and generates the Tailwind 4 theme from it.
 * `--check` fails if the committed theme no longer matches DESIGN.md.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', '..', 'packages', 'design');
const source = join(dir, 'DESIGN.md');
const target = join(dir, 'theme.gen.css');
const cli = (args: string[]) =>
  execFileSync('pnpm', ['exec', 'designmd', ...args, source], {
    cwd: dir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

const lint = JSON.parse(cli(['lint'])) as {
  summary: { errors: number; warnings: number };
  findings: { severity: string; rule: string; path?: string; message: string }[];
};
const problems = lint.findings.filter((f) => f.severity === 'error' || f.severity === 'warning');
if (problems.length > 0) {
  for (const p of problems) console.error(`${p.severity} ${p.rule} ${p.path ?? ''}: ${p.message}`);
  process.exit(1);
}

const theme =
  '/* Generated from DESIGN.md by `pnpm design:generate`. Do not edit. */\n' +
  cli(['export', '--format', 'css-tailwind']).trimEnd() +
  '\n';

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    current = '';
  }
  if (current !== theme) {
    console.error('theme.gen.css is out of date. Run `pnpm design:generate`.');
    process.exit(1);
  }
  console.log('DESIGN.md lints clean and theme.gen.css is up to date.');
} else {
  writeFileSync(target, theme);
  console.log('DESIGN.md lints clean; generated theme.gen.css.');
}
