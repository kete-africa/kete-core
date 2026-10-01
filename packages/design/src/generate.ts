/**
 * The generator of a design's layers (doctrine D-035, D-038), for Kete's two designs and for an
 * app's own: lint its DESIGN.md (no error, no warning), export its base tokens (W3C Design Tokens),
 * resolve its semantic mapping per mode, check every contrast pair, and write the CSS that makes
 * a page wear it. Node only: `@kete/design/generate`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { checkContrasts } from './contrast.js';
import {
  contrastPairs,
  semanticColors,
  type Mode,
  type SemanticColor,
  type SemanticMapping,
} from './semantic.js';

// The DESIGN.md linter and exporter (Google's design.md), run with this Node. Its package exports
// an import condition only, so it is found where Node would look for it.
function designmdCli(): string {
  const paths = createRequire(import.meta.url).resolve.paths('@google/design.md') ?? [];
  for (const base of paths) {
    const manifest = join(base, '@google', 'design.md', 'package.json');
    if (!existsSync(manifest)) continue;
    const { bin } = JSON.parse(readFileSync(manifest, 'utf8')) as { bin: Record<string, string> };
    return join(base, '@google', 'design.md', bin['designmd'] ?? 'dist/index.js');
  }
  throw new Error('@google/design.md is not installed.');
}
const designmd = designmdCli();

function cli(args: string[], source: string): string {
  return execFileSync(process.execPath, [designmd, ...args, source], { encoding: 'utf8' });
}

export interface ReadDesign {
  /** The W3C Design Tokens of its DESIGN.md. */
  tokens: string;
  /** Its Tailwind 4 theme (`@theme`), as exported. */
  tailwind: string;
  /** Its type scale, to set over the shared one (`--text-*`, weights, tracking). */
  typeScale: string[];
  /** Every semantic color, per mode, as #rrggbb. */
  resolved: Record<Mode, Record<SemanticColor, string>>;
  /** Lint warnings, unknown colors and missed contrasts: a design with any is refused. */
  failures: string[];
}

/** Reads a design: its DESIGN.md and its semantic mapping. */
export function readDesign(name: string, designMd: string, mapping: SemanticMapping): ReadDesign {
  const failures: string[] = [];
  const lint = JSON.parse(cli(['lint'], designMd)) as {
    findings: { severity: string; rule: string; path?: string; message: string }[];
  };
  for (const p of lint.findings.filter((f) => f.severity === 'error' || f.severity === 'warning')) {
    failures.push(`${name}: ${p.severity} ${p.rule} ${p.path ?? ''}: ${p.message}`);
  }
  const tokens = cli(['export', '--format', 'dtcg'], designMd);
  const tailwind = cli(['export', '--format', 'css-tailwind'], designMd);
  const colorGroup = (JSON.parse(tokens) as { color: Record<string, unknown> }).color;
  const base = Object.fromEntries(
    Object.entries(colorGroup)
      .filter(([key]) => !key.startsWith('$'))
      .map(([key, token]) => [key, (token as { $value: { hex: string } }).$value.hex]),
  );
  const resolved = { light: {}, dark: {} } as Record<Mode, Record<SemanticColor, string>>;
  for (const mode of ['light', 'dark'] as const) {
    for (const semantic of semanticColors) {
      const color = mapping.colors[mode][semantic];
      const hex = base[color];
      if (!hex) failures.push(`${name} ${mode}: ${semantic} maps to ${color}, not in DESIGN.md.`);
      else resolved[mode][semantic] = hex;
    }
    for (const f of checkContrasts(resolved[mode], contrastPairs)) {
      failures.push(`${name} ${mode}: ${f.fg} on ${f.bg} is ${f.ratio}:1, needs ${f.min}:1.`);
    }
  }
  const typeScale = tailwind
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^--(text|font-weight|tracking)-/.test(line));
  return { tokens: tokens.trimEnd() + '\n', tailwind, typeScale, resolved, failures };
}

/** The semantic colors as CSS variables. */
export const colorVariables = (values: Record<string, string>, indent: string): string =>
  semanticColors.map((name) => `${indent}--color-${name}: ${values[name]};`).join('\n');

/** What Tailwind turns into utilities (font-ui, rounded-box…). */
export const themedVariables = (mapping: SemanticMapping): string[] => [
  `--font-ui: ${mapping.fonts.ui};`,
  `--font-heading: ${mapping.fonts.heading};`,
  ...Object.entries(mapping.radius).map(([name, value]) => `--radius-${name}: ${value};`),
];

/** What components read as plain variables. */
export const plainVariables = (mapping: SemanticMapping): string[] => [
  `--label-transform: ${mapping.label.transform};`,
  `--label-tracking: ${mapping.label.tracking};`,
  `--control-height: ${mapping.controlHeight};`,
  `--focus-offset: ${mapping.focusOffset};`,
  `--control-padding: ${mapping.controlPadding};`,
  `--icon-button-size: ${mapping.iconButtonSize};`,
];

export const cssLines = (list: string[], indent: string): string =>
  list.map((line) => indent + line).join('\n');

/**
 * A design's rules: its default mode on its scope (with `extra`, its own variables), the other
 * mode when the page chooses it or the device prefers it.
 */
export function designRules(
  mapping: SemanticMapping,
  resolved: Record<Mode, Record<SemanticColor, string>>,
  scope: string,
  extra: string[],
): string {
  const other: Mode = mapping.defaultMode === 'light' ? 'dark' : 'light';
  const chosen =
    other === 'dark' ? `:is([data-theme='dark'], [data-theme='night'])` : `[data-theme='light']`;
  const block = (selector: string, mode: Mode, indent: string, more: string[] = []) =>
    `${indent}${selector} {\n${cssLines([...more, `color-scheme: ${mode};`], indent + '  ')}\n${colorVariables(resolved[mode], indent + '  ')}\n${indent}}`;
  return [
    ...(scope ? [block(scope, mapping.defaultMode, '  ', extra)] : []),
    block(`${scope}${chosen}`, other, '  '),
    `  @media (prefers-color-scheme: ${other}) {\n${block(`${scope}[data-theme='auto']`, other, '    ')}\n  }`,
  ].join('\n\n');
}

/**
 * An app's own design (D-038): reads its DESIGN.md and mapping, refuses it on any failure, and
 * writes the CSS that makes `<html data-design="<name>">` wear it — after @kete/design's styles —
 * and its W3C Design Tokens. `check` compares instead of writing.
 */
export function generateAppDesign(options: {
  name: string;
  designMd: string;
  mapping: SemanticMapping;
  css: string;
  tokens?: string;
  check?: boolean;
}): { ok: boolean; messages: string[] } {
  if (
    !/^[a-z][a-z0-9-]{0,40}$/.test(options.name) ||
    ['kete', 'workspace'].includes(options.name)
  ) {
    return {
      ok: false,
      messages: [`A design of its own has its own lowercase name: ${options.name}`],
    };
  }
  const design = readDesign(options.name, options.designMd, options.mapping);
  if (design.failures.length > 0) return { ok: false, messages: design.failures };
  const css = `/* Generated from ${options.designMd.replaceAll('\\', '/').split('/').slice(-2).join('/')} by @kete/design. Do not edit. */
@layer base {
${designRules(options.mapping, design.resolved, `[data-design='${options.name}']`, [
  ...themedVariables(options.mapping),
  ...plainVariables(options.mapping),
  ...design.typeScale,
])}
}
`;
  const outputs = [
    { path: options.css, text: css },
    ...(options.tokens ? [{ path: options.tokens, text: design.tokens }] : []),
  ];
  const messages: string[] = [];
  for (const { path, text } of outputs) {
    if (options.check) {
      let current = '';
      try {
        current = readFileSync(path, 'utf8');
      } catch {
        current = '';
      }
      if (current !== text) messages.push(`${path} is out of date.`);
    } else {
      writeFileSync(path, text);
    }
  }
  return { ok: messages.length === 0, messages };
}
