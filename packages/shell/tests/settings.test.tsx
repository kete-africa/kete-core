import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  controlOf,
  sayValue,
  SettingsPanel,
  type SettingRow,
  type SettingsWords,
} from '../src/index.js';

// Spec 116: « Réglages », the same panel in every app, drawn from the settings' declarations.

const hour = { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' };
const hours = {
  type: 'object',
  properties: { from: hour, to: hour },
  required: ['from', 'to'],
  additionalProperties: false,
};

const words: SettingsWords = {
  mine: 'Pour moi',
  mineHint: 'Elles vous suivent dans toutes les apps Kete.',
  organization: 'Pour l’organisation',
  organizationHint: 'Pour toute l’organisation, dans cette app.',
  group: (group) => ({ display: 'Affichage', language: 'Langue et monnaie' })[group] ?? group,
  from: (layer) =>
    ({
      kete: 'Valeur de Kete',
      organization: 'Réglé par l’organisation',
      app: 'Réglé pour cette app',
      entity: 'Réglé pour ce site',
      person: 'Votre préférence',
      device: 'Cet appareil',
    })[layer],
  inherit: 'Reprendre la valeur héritée',
  none: 'Aucune',
  yes: 'Oui',
  no: 'Non',
  part: (name) => ({ from: 'De', to: 'À' })[name] ?? name,
  elsewhere: (row) =>
    row.layers?.includes('app') ? 'Un administrateur le règle' : 'Se règle dans le Compte Kete',
  saving: 'Enregistrement…',
  saved: 'Enregistré',
  failed: (code) => `Refusé (${code})`,
};

const ok = async () => ({ ok: true as const });

describe('a setting’s control, read from its schema', () => {
  it('fits a list, a tick, a number, a text, ticks and hours', () => {
    expect(controlOf({ type: 'string', enum: ['dark', 'light', 'auto'] })).toEqual({
      kind: 'choice',
      options: ['dark', 'light', 'auto'],
      nullable: false,
    });
    expect(controlOf({ type: 'boolean' })).toEqual({ kind: 'tick' });
    expect(controlOf({ type: 'integer', minimum: 1, maximum: 720 })).toEqual({
      kind: 'number',
      integer: true,
      min: 1,
      max: 720,
    });
    expect(
      controlOf({
        anyOf: [
          { type: 'string', const: '' },
          { type: 'string', format: 'email' },
        ],
      }),
    ).toMatchObject({ kind: 'text', input: 'email' });
    expect(
      controlOf({ type: 'array', items: { type: 'string', enum: ['email', 'whatsapp'] } }),
    ).toEqual({ kind: 'ticks', options: ['email', 'whatsapp'], numeric: false });
    expect(
      controlOf({ type: 'array', items: { type: 'integer' } }, { 1: 'Lundi', 2: 'Mardi' }),
    ).toEqual({ kind: 'ticks', options: ['1', '2'], numeric: true });
    expect(controlOf({ anyOf: [hours, { type: 'null' }] })).toEqual({
      kind: 'parts',
      parts: ['from', 'to'],
      input: 'time',
      nullable: true,
    });
  });

  it('shows what no control fits, never sets it here', () => {
    expect(controlOf({ type: 'array', items: hours })).toEqual({ kind: 'shown' });
    expect(controlOf({ type: 'object', additionalProperties: { type: 'string' } })).toEqual({
      kind: 'shown',
    });
  });
});

describe('the panel', () => {
  const rows: SettingRow[] = [
    {
      key: 'kete.theme',
      label: 'Thème',
      group: 'display',
      schema: { type: 'string', enum: ['dark', 'light', 'auto'] },
      choices: { dark: 'Sombre', light: 'Clair', auto: 'Comme l’appareil' },
      value: 'dark',
      from: 'person',
      editable: 'person',
    },
    {
      key: 'kete.currency',
      label: 'Devise',
      group: 'language',
      schema: { type: 'string', pattern: '^[A-Z]{3}$' },
      value: 'XOF',
      from: 'organization',
      editable: 'app',
    },
    {
      key: 'kete.working_hours',
      label: 'Heures ouvrées',
      group: 'calendar',
      schema: hours,
      value: { from: '08:00', to: '18:00' },
      from: 'kete',
    },
  ];

  it('puts her preferences first, then the organization’s, each with where its value comes from', () => {
    const html = renderToStaticMarkup(
      <SettingsPanel rows={rows} words={words} onSave={ok} onClear={ok} />,
    );
    expect(html.indexOf('Pour moi')).toBeLessThan(html.indexOf('Pour l’organisation'));
    expect(html).toContain('Votre préférence');
    expect(html).toContain('Réglé par l’organisation');
    expect(html).toContain('<option value="dark" selected="">Sombre</option>');
    // Her own value can go back to what she inherits; the organization's is not this layer's.
    expect(html.match(/Reprendre la valeur héritée/g)).toHaveLength(1);
    // A setting set elsewhere is shown, in words, with where it is set.
    expect(html).toContain('08:00 – 18:00');
    expect(html).toContain('Se règle dans le Compte Kete');
  });

  it('says a value in words', () => {
    const theme = rows[0] as SettingRow;
    expect(sayValue({ ...theme, value: 'auto' }, words)).toBe('Comme l’appareil');
    expect(sayValue({ ...theme, value: [1, 2], choices: { 1: 'Lundi', 2: 'Mardi' } }, words)).toBe(
      'Lundi, Mardi',
    );
    expect(sayValue({ ...theme, value: null }, words)).toBe('Aucune');
    expect(sayValue({ ...theme, value: true }, words)).toBe('Oui');
  });
});
