import { checkContrasts, contrastRatio, type ContrastFailure } from './contrast.js';
import { resolvedDesigns } from './designs.gen.js';
import { semanticMappings, type Mode } from './semantic.js';

/** What a client's colors replace in the `workspace` design (doctrine D-035). */
interface BrandColors {
  /** What guides without words: hover lines, the search field, notifications. `#rrggbb`. */
  accent: string;
  /** The fill of primary buttons. Default: the accent. */
  action?: string;
  /** Their hover. Default: the action, 15% darker. */
  actionStrong?: string;
  /** Text on the action. Default: white or near-black, whichever reads better. */
  onAction?: string;
  /** The focus ring. Default: the design's. */
  focus?: string;
}

export interface BrandInput extends BrandColors {
  /** Stable, lowercase: the `data-brand` of the pages that wear it. */
  id: string;
  name: string;
  /** Its logo, by address, for each mode. */
  logo?: { light: string; dark?: string };
  /** Its charter, shown at the bottom of the sidebar. */
  palette?: { value: string; name: string }[];
  /** In light mode, when the workspace is light. Default: the values above. */
  light?: Partial<BrandColors>;
}

type BrandTokens = Record<'accent' | 'action' | 'action-strong' | 'on-action' | 'focus', string>;

export interface Brand {
  id: string;
  name: string;
  logo?: { light: string; dark?: string };
  palette: { value: string; name: string }[];
  tokens: Record<Mode, BrandTokens>;
}

/** A palette that misses the contrasts is refused (D-035); each failure says what and how much. */
export class BrandContrastError extends Error {
  constructor(
    readonly brand: string,
    readonly failures: ContrastFailure[],
  ) {
    super(
      `The brand ${brand} misses its contrasts: ` +
        failures.map((f) => `${f.mode} ${f.fg} on ${f.bg} ${f.ratio}:1 < ${f.min}:1`).join('; '),
    );
    this.name = 'BrandContrastError';
  }
}

const HEX = /^#[0-9a-f]{6}$/i;
const WHITE = '#ffffff';
const NEAR_BLACK = '#1f1f1f';

function darker(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return `#${channels
    .map((c) =>
      Math.round(c * (1 - amount))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

const brandPairs = [
  { fg: 'on-action', bg: 'action', min: 4.5 },
  { fg: 'on-action', bg: 'action-strong', min: 4.5 },
  { fg: 'accent', bg: 'canvas', min: 3 },
  { fg: 'accent', bg: 'surface', min: 3 },
  { fg: 'focus', bg: 'canvas', min: 3 },
  { fg: 'focus', bg: 'surface', min: 3 },
];

/**
 * A client's brand on the `workspace` design: its colors replace the accent, the primary action
 * and the focus, in both modes, once every contrast holds against the design's own surfaces.
 */
export function defineBrand(input: BrandInput): Brand {
  if (!/^[a-z][a-z0-9-]{0,62}$/.test(input.id)) {
    throw new Error(`A brand id is lowercase, with hyphens: ${input.id}`);
  }
  const tokens = {} as Record<Mode, BrandTokens>;
  const failures: ContrastFailure[] = [];
  for (const mode of ['dark', 'light'] as const) {
    const given: BrandColors = mode === 'dark' ? input : { ...input, ...input.light };
    const named = [given.accent, given.action, given.actionStrong, given.onAction, given.focus];
    for (const color of named) {
      if (color !== undefined && !HEX.test(color)) {
        throw new Error(`A brand color is written #rrggbb: ${color}`);
      }
    }
    const design = resolvedDesigns.workspace[mode];
    const action = (given.action ?? given.accent).toLowerCase();
    const onAction =
      given.onAction?.toLowerCase() ??
      (contrastRatio(WHITE, action) >= contrastRatio(NEAR_BLACK, action) ? WHITE : NEAR_BLACK);
    tokens[mode] = {
      accent: given.accent.toLowerCase(),
      action,
      'action-strong': (given.actionStrong ?? darker(action, 0.15)).toLowerCase(),
      'on-action': onAction,
      focus: (given.focus ?? design.focus).toLowerCase(),
    };
    const colors = { ...design, ...tokens[mode] };
    failures.push(...checkContrasts(colors, brandPairs).map((f) => ({ ...f, mode })));
  }
  if (failures.length > 0) throw new BrandContrastError(input.id, failures);
  return {
    id: input.id,
    name: input.name,
    ...(input.logo ? { logo: input.logo } : {}),
    palette: input.palette ?? [],
    tokens,
  };
}

/**
 * The CSS that makes pages with `data-design="workspace" data-brand="<id>"` wear the brand: its
 * default mode on the scope, the other when chosen or preferred — as the design itself does.
 */
export function brandCss(brand: Brand): string {
  const scope = `[data-design='workspace'][data-brand='${brand.id}']`;
  const main = semanticMappings.workspace.defaultMode;
  const other: Mode = main === 'dark' ? 'light' : 'dark';
  const chosen =
    other === 'light' ? `[data-theme='light']` : `:is([data-theme='dark'], [data-theme='night'])`;
  const block = (selector: string, mode: Mode, indent = '') =>
    `${indent}${selector} {\n${Object.entries(brand.tokens[mode])
      .map(([name, value]) => `${indent}  --color-${name}: ${value};`)
      .join('\n')}\n${indent}}`;
  return [
    block(scope, main),
    block(`${scope}${chosen}`, other),
    `@media (prefers-color-scheme: ${other}) {\n${block(`${scope}[data-theme='auto']`, other, '  ')}\n}`,
  ].join('\n');
}
