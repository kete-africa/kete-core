/**
 * The second layer of @kete/design (doctrine D-035): semantic tokens, what a color is *for*. Each
 * design maps them, for each mode, onto its base tokens (the colors of its DESIGN.md). Components
 * use semantic tokens only, so they work in every design, every mode, and every client brand.
 *
 * `pnpm design:generate` resolves this mapping into semantic.gen.css and designs.gen.ts, and
 * fails when a pair below misses its contrast.
 */

export const semanticColors = [
  /** The page. */
  'canvas',
  /** Panels, cards, the sidebar, dialogs. */
  'surface',
  /** Menus, and a card under the pointer. */
  'surface-raised',
  /** A navigation item or a button under the pointer. */
  'surface-hover',
  /** A pressed filter, a selected item. */
  'surface-selected',
  /** The background of a secondary button or a field. */
  'surface-control',
  'fg',
  /** Secondary paragraphs (a dialog's body). */
  'fg-soft',
  /** Captions, section labels. */
  'fg-muted',
  /** 1 px separators, card borders. */
  'line',
  /** Field, menu and dialog borders. */
  'line-strong',
  /** Secondary buttons and filters. */
  'line-control',
  /** The border of a pressed filter. */
  'line-selected',
  /** Menus and dialogs. */
  'line-overlay',
  /** What guides without being text: hover borders, the current item, a search field. */
  'accent',
  /** The fill of the primary action: a client brand replaces it. */
  'action',
  'action-strong',
  'on-action',
  'link',
  'focus',
  /** What an agent did. */
  'agent',
  'on-agent',
  /** A notification (with its undo). */
  'notice',
  'on-notice',
  'notice-line',
  'state-success',
  'state-success-fg',
  'state-success-surface',
  'state-verify',
  'state-verify-fg',
  'state-verify-surface',
  'state-error',
  'state-error-fg',
  'state-error-surface',
  'state-info',
  'state-info-fg',
  'state-info-surface',
] as const;

export type SemanticColor = (typeof semanticColors)[number];
export type Mode = 'light' | 'dark';
export const designNames = ['kete', 'workspace'] as const;
export type DesignName = (typeof designNames)[number];

export interface SemanticMapping {
  /** The mode a page has when it does not choose one. */
  defaultMode: Mode;
  /** Semantic color → the name of a color of the design's DESIGN.md, per mode. */
  colors: Record<Mode, Record<SemanticColor, string>>;
  /** CSS font stacks. */
  fonts: { ui: string; heading: string };
  /** CSS lengths. */
  radius: { control: string; box: string; pill: string; menu: string; overlay: string };
  /** How small section labels are written. */
  label: { transform: 'uppercase' | 'none'; tracking: string };
  /** The height of buttons, fields and navigation items (44 px at least on a touch screen). */
  controlHeight: string;
  /** The gap between the focus ring and what it surrounds. */
  focusOffset: string;
  /** The horizontal padding of buttons. */
  controlPadding: string;
  /** The side of a button that holds only an icon. */
  iconButtonSize: string;
}

const states = (prefix: string): Record<string, string> =>
  Object.fromEntries(
    ['success', 'verify', 'error', 'info'].flatMap((state) => [
      [`state-${state}`, `${prefix}${state}`],
      [`state-${state}-fg`, `${prefix}${state}-ink`],
      [`state-${state}-surface`, `${prefix}${state}-surface`],
    ]),
  );

const archivo = "'Archivo Variable', 'Archivo', system-ui, sans-serif";
const instrument = "'Instrument Sans Variable', 'Instrument Sans', system-ui, sans-serif";
// Segoe UI where the system has it (it is never shipped: a licensed font); elsewhere Inter, free
// and self-hosted.
const workspaceFont =
  "'Segoe UI', 'Inter Variable', 'Inter', system-ui, -apple-system, Arial, sans-serif";

export const semanticMappings: Record<DesignName, SemanticMapping> = {
  kete: {
    defaultMode: 'light',
    colors: {
      light: {
        canvas: 'sand',
        surface: 'paper',
        'surface-raised': 'paper',
        'surface-hover': 'clay',
        'surface-selected': 'clay',
        'surface-control': 'paper',
        fg: 'ink',
        'fg-soft': 'bark',
        'fg-muted': 'bark',
        line: 'rule',
        'line-strong': 'rule-strong',
        'line-control': 'ink',
        'line-selected': 'ink',
        'line-overlay': 'ink',
        accent: 'primary',
        action: 'primary',
        'action-strong': 'primary-strong',
        'on-action': 'sand',
        link: 'primary',
        focus: 'primary',
        agent: 'ink',
        'on-agent': 'sand',
        notice: 'ink',
        'on-notice': 'sand',
        'notice-line': 'ink',
        ...states(''),
      } as Record<SemanticColor, string>,
      dark: {
        canvas: 'night',
        surface: 'night-surface',
        'surface-raised': 'night-surface',
        'surface-hover': 'night-surface-quiet',
        'surface-selected': 'night-surface-quiet',
        'surface-control': 'night-surface',
        fg: 'night-text',
        'fg-soft': 'night-text-muted',
        'fg-muted': 'night-text-muted',
        line: 'night-rule',
        'line-strong': 'night-rule-strong',
        'line-control': 'night-text',
        'line-selected': 'night-text',
        'line-overlay': 'night-rule-strong',
        accent: 'night-link',
        action: 'primary',
        'action-strong': 'primary-strong',
        'on-action': 'sand',
        link: 'night-link',
        focus: 'night-link',
        agent: 'clay',
        'on-agent': 'ink',
        notice: 'clay',
        'on-notice': 'ink',
        'notice-line': 'clay',
        ...states('night-'),
      } as Record<SemanticColor, string>,
    },
    fonts: { ui: instrument, heading: archivo },
    radius: { control: '2px', box: '0px', pill: '2px', menu: '0px', overlay: '0px' },
    label: { transform: 'uppercase', tracking: '0.12em' },
    controlHeight: '48px',
    focusOffset: '2px',
    controlPadding: '24px',
    iconButtonSize: '44px',
  },
  // copilot-demo's system, dark first (doctrine D-035).
  workspace: {
    defaultMode: 'dark',
    colors: {
      dark: {
        canvas: 'gray-850',
        surface: 'gray-870',
        'surface-raised': 'gray-810',
        'surface-hover': 'gray-800',
        'surface-selected': 'gray-740',
        'surface-control': 'gray-850',
        fg: 'gray-130',
        'fg-soft': 'gray-270',
        'fg-muted': 'gray-400',
        line: 'gray-710',
        'line-strong': 'gray-670',
        'line-control': 'gray-740',
        'line-selected': 'gray-380',
        'line-overlay': 'gray-670',
        accent: 'primary',
        action: 'primary-strong',
        'action-strong': 'primary-deep',
        'on-action': 'white',
        link: 'gray-130',
        focus: 'orange',
        agent: 'gray-130',
        'on-agent': 'gray-870',
        notice: 'gray-800',
        'on-notice': 'gray-130',
        'notice-line': 'primary',
        ...states('dark-'),
      } as Record<SemanticColor, string>,
      light: {
        canvas: 'light-canvas',
        surface: 'white',
        'surface-raised': 'white',
        'surface-hover': 'light-hover',
        'surface-selected': 'light-selected',
        'surface-control': 'white',
        fg: 'light-text',
        'fg-soft': 'light-text-soft',
        'fg-muted': 'light-text-muted',
        line: 'light-line',
        'line-strong': 'light-line-strong',
        'line-control': 'light-line-control',
        'line-selected': 'light-text-muted',
        'line-overlay': 'light-line-strong',
        accent: 'primary-light-mode',
        action: 'primary-strong',
        'action-strong': 'primary-deep',
        'on-action': 'white',
        link: 'light-text',
        focus: 'orange-light-mode',
        agent: 'light-text',
        'on-agent': 'white',
        notice: 'light-text',
        'on-notice': 'light-canvas',
        'notice-line': 'light-text',
        ...states(''),
      } as Record<SemanticColor, string>,
    },
    fonts: { ui: workspaceFont, heading: workspaceFont },
    radius: { control: '5px', box: '5px', pill: '24px', menu: '7px', overlay: '10px' },
    label: { transform: 'none', tracking: '0em' },
    controlHeight: '34px',
    focusOffset: '4px',
    controlPadding: '14px',
    iconButtonSize: '29px',
  },
};

/**
 * The pairs every design must read well, in both modes (WCAG 2.2): 4.5 for text, 3 for what
 * guides without words (the accent) and for the focus.
 */
export const contrastPairs: { fg: SemanticColor; bg: SemanticColor; min: number }[] = [
  { fg: 'fg', bg: 'canvas', min: 4.5 },
  { fg: 'fg', bg: 'surface', min: 4.5 },
  { fg: 'fg', bg: 'surface-raised', min: 4.5 },
  { fg: 'fg', bg: 'surface-hover', min: 4.5 },
  { fg: 'fg', bg: 'surface-selected', min: 4.5 },
  { fg: 'fg', bg: 'surface-control', min: 4.5 },
  { fg: 'fg-soft', bg: 'surface', min: 4.5 },
  { fg: 'fg-soft', bg: 'surface-selected', min: 4.5 },
  { fg: 'fg-muted', bg: 'canvas', min: 4.5 },
  { fg: 'fg-muted', bg: 'surface', min: 4.5 },
  { fg: 'on-action', bg: 'action', min: 4.5 },
  { fg: 'on-action', bg: 'action-strong', min: 4.5 },
  { fg: 'link', bg: 'canvas', min: 4.5 },
  { fg: 'link', bg: 'surface', min: 4.5 },
  { fg: 'on-agent', bg: 'agent', min: 4.5 },
  { fg: 'on-notice', bg: 'notice', min: 4.5 },
  { fg: 'state-success-fg', bg: 'state-success-surface', min: 4.5 },
  { fg: 'state-verify-fg', bg: 'state-verify-surface', min: 4.5 },
  { fg: 'state-error-fg', bg: 'state-error-surface', min: 4.5 },
  { fg: 'state-info-fg', bg: 'state-info-surface', min: 4.5 },
  { fg: 'accent', bg: 'canvas', min: 3 },
  { fg: 'accent', bg: 'surface', min: 3 },
  { fg: 'focus', bg: 'canvas', min: 3 },
  { fg: 'focus', bg: 'surface', min: 3 },
];
