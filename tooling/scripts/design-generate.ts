/**
 * The designs of @kete/design (doctrine D-035), in three layers:
 * 1. base tokens — each design's DESIGN.md (designs/<name>/DESIGN.md), linted without error or
 *    warning, exported as W3C Design Tokens (tokens.gen.json); the `kete` design's also as the
 *    Tailwind 4 theme its apps use (theme.gen.css);
 * 2. semantic tokens — src/semantic.ts maps them per mode; resolved into semantic.gen.css and
 *    src/designs.gen.ts, and every contrast pair checked;
 * 3. components — src/, which use semantic tokens only.
 * The generator itself is @kete/design/generate, which an app's own design uses too (D-038).
 * `--check` fails if a generated file no longer matches, or a contrast is missed.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  colorVariables,
  cssLines,
  designRules,
  plainVariables,
  readDesign,
  themedVariables,
  type ReadDesign,
} from '../../packages/design/src/generate.js';
import {
  designNames,
  semanticMappings,
  type DesignName,
} from '../../packages/design/src/semantic.js';

const dir = join(import.meta.dirname, '..', '..', 'packages', 'design');
const check = process.argv.includes('--check');
const header = (what: string) => `Generated from ${what} by \`pnpm design:generate\`. Do not edit.`;

const designs = Object.fromEntries(
  designNames.map((name) => [
    name,
    readDesign(name, join(dir, 'designs', name, 'DESIGN.md'), semanticMappings[name]),
  ]),
) as Record<DesignName, ReadDesign>;

const failures = designNames.flatMap((name) => designs[name].failures);
if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}

const kete = semanticMappings.kete;
const workspace = semanticMappings.workspace;
const resolved = Object.fromEntries(designNames.map((name) => [name, designs[name].resolved]));

const outputs: { path: string; text: string }[] = [
  ...designNames.map((name) => ({
    path: join('designs', name, 'tokens.gen.json'),
    text: designs[name].tokens,
  })),
  {
    path: 'theme.gen.css',
    text: `/* ${header('designs/kete/DESIGN.md')} */\n${designs.kete.tailwind.trimEnd()}\n`,
  },
  {
    path: 'semantic.gen.css',
    text: `/* ${header('src/semantic.ts and the designs')} */
/* The kete design, light: the default of every page. */
@theme {
${colorVariables(designs.kete.resolved.light, '  ')}
${cssLines(themedVariables(kete), '  ')}
}

@layer base {
  :root {
${cssLines([...plainVariables(kete), 'color-scheme: light;'], '    ')}
  }

${designRules(kete, designs.kete.resolved, '', [])}

  /* The workspace design: dark unless the page chooses light. */
${designRules(workspace, designs.workspace.resolved, "[data-design='workspace']", [
  ...themedVariables(workspace),
  ...plainVariables(workspace),
  ...designs.workspace.typeScale,
])}
}
`,
  },
  {
    path: join('src', 'designs.gen.ts'),
    text: `// ${header('src/semantic.ts and the designs')}
import type { DesignName, Mode, SemanticColor } from './semantic.js';

/** Every semantic color of every design, per mode, as #rrggbb. */
export const resolvedDesigns: Record<DesignName, Record<Mode, Record<SemanticColor, string>>> = ${JSON.stringify(resolved, null, 2)};
`,
  },
];

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
