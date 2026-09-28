import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button, KeteBand, KeteMark, Panel, Tag, TextField } from '../src/index.js';

describe('components', () => {
  it('renders buttons as real buttons, never submitting by accident', () => {
    const html = renderToStaticMarkup(<Button>Valider</Button>);
    expect(html).toContain('<button type="button"');
    expect(html).toContain('bg-primary');
  });

  it('gives every state tag a word and a square marker', () => {
    const html = renderToStaticMarkup(<Tag tone="error">Refusé</Tag>);
    expect(html).toContain('Refusé');
    expect(html).toContain('bg-error');
    expect(html).not.toContain('bg-primary');
  });

  it('associates a field with its label and its error', () => {
    const html = renderToStaticMarkup(
      <TextField label="Téléphone" error="Il manque 2 chiffres" defaultValue="+228 90" />,
    );
    const id = /<input id="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`for="${id}"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(`aria-describedby="${id}-error"`);
  });

  it('keeps decorative marks out of the accessibility tree', () => {
    expect(renderToStaticMarkup(<KeteMark />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<KeteBand />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<Panel title="Produits">x</Panel>)).toContain('<h2');
  });
});
