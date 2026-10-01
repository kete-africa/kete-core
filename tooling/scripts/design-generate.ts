/**
 * The designs of @kete/design (doctrine D-035), in three layers:
 * 1. base tokens — each design's DESIGN.md (designs/<name>/DESIGN.md), linted without error or
 *    warning, exported as W3C Design Tokens (tokens.gen.json); the `kete` design's also as the
 *    Tailwind 4 theme its apps use (theme.gen.css);
 * 2. semantic tokens — src/semantic.ts maps them per mode; resolved into semantic.gen.css and
 *    src/designs.gen.ts, and every contrast pair checked;
 * 3. components — src/, which use semantic tokens only.
 * `--check` fails if a generated file no longer matches, or a contrast is missed.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkContrasts } from '../../packages/design/src/contrast.js';
import {
  contrastPairs,
  designNames,
  semanticColors,
  semanticMappings,
  type DesignName,
  type Mode,
  type SemanticMapping,
} from '../../packages/design/src/semantic.js';

const dir = join(import.meta.dirname, '..', '..', 'packages', 'design');
const check = process.argv.includes('--check');
const header = (what: string) => `Generated from ${what} by \`pnpm design:generate\`. Do not edit.`;

const cli = (args: string[], source: string) =>
  execFileSync('pnpm', ['exec', 'designmd', ...args, source], {
    cwd: dir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

const outputs: { path: string; text: string }[] = [];
const failures: string[] = [];
const resolved = {} as Record<DesignName, Record<Mode, Record<string, string>>>;
/** The workspace's type scale, over the kete one its utilities share. */
let workspaceType: string[] = [];

for (const design of designNames) {
  const source = join('designs', design, 'DESIGN.md');

  const lint = JSON.parse(cli(['lint'], source)) as {
    findings: { severity: string; rule: string; path?: string; message: string }[];
  };
  for (const p of lint.findings.filter((f) => f.severity === 'error' || f.severity === 'warning')) {
    failures.push(`${design}: ${p.severity} ${p.rule} ${p.path ?? ''}: ${p.message}`);
  }

  const tokens = cli(['export', '--format', 'dtcg'], source);
  outputs.push({ path: join('designs', design, 'tokens.gen.json'), text: tokens.trimEnd() + '\n' });
  const colorGroup = (JSON.parse(tokens) as { color: Record<string, unknown> }).color;
  const base = Object.fromEntries(
    Object.entries(colorGroup)
      .filter(([name]) => !name.startsWith('$'))
      .map(([name, token]) => [name, (token as { $value: { hex: string } }).$value.hex]),
  );

  if (design === 'kete') {
    outputs.push({
      path: 'theme.gen.css',
      text: `/* ${header('designs/kete/DESIGN.md')} */\n${cli(['export', '--format', 'css-tailwind'], source).trimEnd()}\n`,
    });
  }

  if (design === 'workspace') {
    workspaceType = cli(['export', '--format', 'css-tailwind'], source)
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^--(text|font-weight|tracking)-/.test(line));
  }

  const mapping = semanticMappings[design];
  resolved[design] = { light: {}, dark: {} };
  for (const mode of ['light', 'dark'] as const) {
    for (const semantic of semanticColors) {
      const name = mapping.colors[mode][semantic];
      const hex = base[name];
      if (!hex) failures.push(`${design} ${mode}: ${semantic} maps to ${name}, not in DESIGN.md.`);
      else resolved[design][mode][semantic] = hex;
    }
    for (const f of checkContrasts(resolved[design][mode], contrastPairs)) {
      failures.push(`${design} ${mode}: ${f.fg} on ${f.bg} is ${f.ratio}:1, needs ${f.min}:1.`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

const colors = (values: Record<string, string>, indent: string) =>
  semanticColors.map((name) => `${indent}--color-${name}: ${values[name]};`).join('\n');
/** What Tailwind turns into utilities (font-ui, rounded-box…). */
const themed = (mapping: SemanticMapping) => [
  `--font-ui: ${mapping.fonts.ui};`,
  `--font-heading: ${mapping.fonts.heading};`,
  ...Object.entries(mapping.radius).map(([name, value]) => `--radius-${name}: ${value};`),
];
/** What components read as plain variables. */
const plain = (mapping: SemanticMapping) => [
  `--label-transform: ${mapping.label.transform};`,
  `--label-tracking: ${mapping.label.tracking};`,
  `--control-height: ${mapping.controlHeight};`,
  `--focus-offset: ${mapping.focusOffset};`,
  `--control-padding: ${mapping.controlPadding};`,
  `--icon-button-size: ${mapping.iconButtonSize};`,
];
const lines = (list: string[], indent: string) => list.map((line) => indent + line).join('\n');

/** A design's rules: its default mode on its scope, the other mode when chosen or preferred. */
function designRules(design: DesignName, scope: string, extra: string[]): string {
  const mapping = semanticMappings[design];
  const other: Mode = mapping.defaultMode === 'light' ? 'dark' : 'light';
  const chosen =
    other === 'dark' ? `:is([data-theme='dark'], [data-theme='night'])` : `[data-theme='light']`;
  const block = (selector: string, mode: Mode, indent: string, more: string[] = []) =>
    `${indent}${selector} {
${lines([...more, `color-scheme: ${mode};`], indent + '  ')}
${colors(resolved[design][mode], indent + '  ')}
${indent}}`;
  return [
    ...(scope ? [block(scope, mapping.defaultMode, '  ', extra)] : []),
    block(`${scope}${chosen}`, other, '  '),
    `  @media (prefers-color-scheme: ${other}) {
${block(`${scope}[data-theme='auto']`, other, '    ')}
  }`,
  ].join('\n\n');
}

const kete = semanticMappings.kete;
const workspace = semanticMappings.workspace;

outputs.push({
  path: 'semantic.gen.css',
  text: `/* ${header('src/semantic.ts and the designs')} */
/* The kete design, light: the default of every page. */
@theme {
${colors(resolved.kete.light, '  ')}
${lines(themed(kete), '  ')}
}

@layer base {
  :root {
${lines([...plain(kete), 'color-scheme: light;'], '    ')}
  }

${designRules('kete', '', [])}

  /* The workspace design: dark unless the page chooses light. */
${designRules('workspace', "[data-design='workspace']", [
  ...themed(workspace),
  ...plain(workspace),
  ...workspaceType,
])}
}
`,
});

outputs.push({
  path: join('src', 'designs.gen.ts'),
  text: `// ${header('src/semantic.ts and the designs')}
import type { DesignName, Mode, SemanticColor } from './semantic.js';

/** Every semantic color of every design, per mode, as #rrggbb. */
export const resolvedDesigns: Record<DesignName, Record<Mode, Record<SemanticColor, string>>> = ${JSON.stringify(resolved, null, 2)};
`,
});

let stale = false;
for (const { path, text } of outputs) {
  const target = join(dir, path);
  if (check) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      current = '';
    }
    if (current !== text) {
      console.error(`packages/design/${path.replaceAll('\\', '/')} is out of date.`);
      stale = true;
    }
  } else {
    writeFileSync(target, text);
  }
}
if (stale) {
  console.error('Run `pnpm design:generate`.');
  process.exit(1);
}
console.log(
  check
    ? 'Both designs lint clean, meet their contrasts, and their generated files are up to date.'
    : 'Both designs lint clean and meet their contrasts; generated their files.',
);
