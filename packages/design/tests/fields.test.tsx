import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CheckField,
  ChoiceField,
  ErrorNote,
  InfoNote,
  SelectField,
  TextAreaField,
} from '../src/index.js';

// Spec 093: the form pieces every app needed beside TextField, on semantic tokens only.

const noop = () => undefined;
const BASE_COLOR =
  /\b(?:bg|text|border|outline|ring|fill|stroke|divide|shadow)-(?:primary|primary-strong|ember|ochre|root|ink|bark|clay|sand|paper|rule|rule-strong|success|verify|error|info|night)(?:-[a-z]+)*\b/;

const all = (
  <form>
    <SelectField
      label="Pays"
      hint="Celui du numéro"
      options={[
        { value: 'TG', label: 'Togo' },
        { value: 'BJ', label: 'Bénin' },
      ]}
      defaultValue="TG"
    />
    <SelectField label="Rôle" error="Choisissez un rôle" options={[]} />
    <CheckField label="Livraison" hint="À domicile" checked onChange={noop} />
    <ChoiceField
      label="Canal"
      value="whatsapp"
      options={[
        { value: 'whatsapp', label: 'WhatsApp', hint: 'Son numéro' },
        { value: 'telegram', label: 'Telegram' },
      ]}
      onChange={noop}
    />
    <TextAreaField label="Note" value="" error="Trop long" onChange={noop} />
    <ErrorNote>La caisse est fermée.</ErrorNote>
    <InfoNote>Aucun prix n’est encore fixé.</InfoNote>
  </form>
);

describe('form fields', () => {
  const html = renderToStaticMarkup(all);

  it('use semantic tokens only', () => {
    expect(html).not.toMatch(BASE_COLOR);
  });

  it('label each control and tie its hint or its error to it', () => {
    expect(html).toMatch(
      /<label for="([^"]+)"[^>]*>Pays<\/label><select id="\1"[^>]*aria-describedby="\1-hint"/,
    );
    expect(html).toMatch(/<select id="([^"]+)" aria-invalid="true" aria-describedby="\1-error"/);
    expect(html).toContain('<legend');
    expect(html).toContain('type="radio"');
    expect(html).toMatch(/<textarea[^>]*aria-invalid="true"/);
  });

  it('announce what stopped a gesture, and say nothing when there is nothing', () => {
    expect(html).toContain('role="alert"');
    expect(renderToStaticMarkup(<ErrorNote>{null}</ErrorNote>)).toBe('');
  });
});
