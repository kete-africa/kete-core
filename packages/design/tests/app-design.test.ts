import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateAppDesign } from '../src/generate.js';
import { semanticMappings } from '../src/semantic.js';

// An app's own design (doctrine D-038): the same three layers, the same contrasts, its own scope.
const designMd = fileURLToPath(new URL('../designs/kete/DESIGN.md', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'kete-design-'));

describe('an app’s own design', () => {
  it('is written as the CSS of its own scope, with its tokens', () => {
    const css = join(out, 'design.gen.css');
    const tokens = join(out, 'tokens.gen.json');
    const result = generateAppDesign({
      name: 'nettio',
      designMd,
      mapping: semanticMappings.kete,
      css,
      tokens,
    });
    expect(result).toEqual({ ok: true, messages: [] });
    const text = readFileSync(css, 'utf8');
    expect(text).toContain("[data-design='nettio'] {");
    expect(text).toContain('--color-canvas: #fbf6f0;');
    expect(text).toContain("[data-design='nettio']:is([data-theme='dark'], [data-theme='night'])");
    expect(JSON.parse(readFileSync(tokens, 'utf8'))).toHaveProperty('color');
    expect(
      generateAppDesign({
        name: 'nettio',
        designMd,
        mapping: semanticMappings.kete,
        css,
        check: true,
      }).ok,
    ).toBe(true);
  });

  it('is refused when a contrast fails, saying which', () => {
    const unreadable = {
      ...semanticMappings.kete,
      colors: {
        ...semanticMappings.kete.colors,
        light: { ...semanticMappings.kete.colors.light, fg: 'clay' },
      },
    };
    const result = generateAppDesign({
      name: 'pale',
      designMd,
      mapping: unreadable,
      css: join(out, 'pale.css'),
    });
    expect(result.ok).toBe(false);
    expect(result.messages.some((m) => m.includes('fg on canvas'))).toBe(true);
  });

  it('never takes the name of Kete’s designs', () => {
    const result = generateAppDesign({
      name: 'workspace',
      designMd,
      mapping: semanticMappings.kete,
      css: join(out, 'x.css'),
    });
    expect(result.ok).toBe(false);
  });
});
