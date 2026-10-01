import { describe, expect, it } from 'vitest';
import {
  brandCss,
  BrandContrastError,
  checkContrasts,
  contrastPairs,
  contrastRatio,
  defineBrand,
  designNames,
  resolvedDesigns,
  semanticColors,
  semanticMappings,
} from '../src/index.js';

describe('contrast', () => {
  it('computes the WCAG ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('reports a pair that misses its minimum, never rounded up to pass', () => {
    const failures = checkContrasts({ fg: '#777777', bg: '#ffffff' }, [
      { fg: 'fg', bg: 'bg', min: 4.5 },
    ]);
    expect(failures).toEqual([{ fg: 'fg', bg: 'bg', ratio: 4.47, min: 4.5 }]);
  });
});

describe('the two designs', () => {
  it('define every semantic color, in both modes', () => {
    for (const design of designNames) {
      for (const mode of ['light', 'dark'] as const) {
        expect(Object.keys(resolvedDesigns[design][mode]).sort()).toEqual(
          [...semanticColors].sort(),
        );
      }
    }
  });

  it('meet every contrast, in both modes', () => {
    for (const design of designNames) {
      for (const mode of ['light', 'dark'] as const) {
        expect(checkContrasts(resolvedDesigns[design][mode], contrastPairs)).toEqual([]);
      }
    }
  });
});

describe('the workspace design', () => {
  it('is the copilot-demo system, dark first', () => {
    const dark = resolvedDesigns.workspace.dark;
    expect(dark.canvas).toBe('#282828');
    expect(dark.surface).toBe('#242424');
    expect(dark['surface-hover']).toBe('#343434');
    expect(dark['surface-selected']).toBe('#424242');
    expect(dark.fg).toBe('#dedede');
    expect(dark['fg-muted']).toBe('#999999');
    expect(dark.line).toBe('#494949');
    expect(dark['line-selected']).toBe('#9d9d9d');
    expect(dark.accent).toBe('#1ca18c');
    expect(dark.focus).toBe('#f99d32');
    const workspace = semanticMappings.workspace;
    expect(workspace.defaultMode).toBe('dark');
    expect(workspace.radius).toEqual({
      control: '5px',
      box: '5px',
      pill: '24px',
      menu: '7px',
      overlay: '10px',
    });
    expect(workspace.controlHeight).toBe('34px');
    expect(workspace.fonts.ui.startsWith("'Segoe UI'")).toBe(true);
  });
});

describe('client brands', () => {
  it('replace the accent and the action, keep the focus of the workspace, in both modes', () => {
    const brand = defineBrand({
      id: 'atelier-bleu',
      name: 'Atelier Bleu',
      accent: '#3B82F6',
      action: '#1D4ED8',
      palette: [{ value: '#3B82F6', name: 'Bleu' }],
    });
    expect(brand.tokens.dark).toMatchObject({
      accent: '#3b82f6',
      action: '#1d4ed8',
      'on-action': '#ffffff',
      focus: resolvedDesigns.workspace.dark.focus,
    });
    expect(brand.tokens.light.focus).toBe(resolvedDesigns.workspace.light.focus);
    const css = brandCss(brand);
    expect(css).toContain("[data-design='workspace'][data-brand='atelier-bleu'] {");
    expect(css).toContain(
      "[data-design='workspace'][data-brand='atelier-bleu'][data-theme='light'] {",
    );
    expect(css).toContain('@media (prefers-color-scheme: light)');
  });

  it('choose the text on the action that reads', () => {
    const brand = defineBrand({
      id: 'soleil',
      name: 'Soleil',
      accent: '#F2C94C',
      light: { accent: '#8A6D00' },
    });
    expect(brand.tokens.dark['on-action']).toBe('#1f1f1f');
    expect(brand.tokens.light.accent).toBe('#8a6d00');
  });

  it('are refused when a palette misses its contrasts, with every failure said', () => {
    const refuse = () => defineBrand({ id: 'sombre', name: 'Sombre', accent: '#2A2A2A' });
    expect(refuse).toThrow(BrandContrastError);
    try {
      refuse();
    } catch (error) {
      const failures = (error as BrandContrastError).failures;
      expect(failures.some((f) => f.mode === 'dark' && f.fg === 'accent')).toBe(true);
      expect(failures.every((f) => f.ratio < f.min)).toBe(true);
    }
  });

  it('are refused when they are not written as expected', () => {
    expect(() => defineBrand({ id: 'Bad Id', name: 'x', accent: '#1F6F5C' })).toThrow();
    expect(() => defineBrand({ id: 'x', name: 'x', accent: 'green' })).toThrow();
  });
});
