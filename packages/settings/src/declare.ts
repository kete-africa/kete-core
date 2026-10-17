import { z } from 'zod';

// A setting is declared once by its owner — the core for `kete.*`, an app for its product's keys —
// with its schema, its default, the layers where it may be set, who may change it and its words
// (spec 115, FR-001; decision 0013).

/**
 * The layers, from the broadest to the most precise: the most precise wins. An entity or a unit (a
 * subsidiary, a site) is more precise than what the app sets for the whole organization.
 */
export const LAYERS = ['kete', 'organization', 'app', 'entity', 'person', 'device'] as const;
export type Layer = (typeof LAYERS)[number];
/** The layers a value can be set on (`kete` is the declared default). */
export type SettableLayer = Exclude<Layer, 'kete'>;

export interface Words {
  fr: string;
  en: string;
}

export interface SettingDeclaration<T = unknown> {
  /** `kete.locale`, `prd_nettio.pickup_delay_hours`: the owner's prefix, a dot, the name. */
  key: string;
  schema: z.ZodType<T>;
  default: T;
  /** Where it may be set; at least one. */
  layers: readonly SettableLayer[];
  /** The permission that changes it at the organization, entity and app layers. */
  permission?: string;
  /** `internal` by default; `public` is shown to anyone signed in. A secret is never a setting. */
  sensitivity?: 'public' | 'internal';
  label: Words;
  description?: Words;
  /** The words of each choice, for a list or ticks: `{ dark: { fr: 'Sombre', en: 'Dark' } }`. */
  choices?: Readonly<Record<string, Words>>;
  /** Where the screen groups it: `identity`, `language`, `calendar`, `notifications`… */
  group: string;
}

/** A declaration as a manifest says it: its schema as JSON Schema. */
export interface SettingDescription {
  key: string;
  default: unknown;
  layers: SettableLayer[];
  permission?: string;
  sensitivity: 'public' | 'internal';
  label: Words;
  description?: Words;
  choices?: Readonly<Record<string, Words>>;
  group: string;
  schema: Record<string, unknown>;
}

export class SettingError extends Error {
  constructor(
    readonly code:
      | 'invalid_declaration'
      | 'unknown_setting'
      | 'layer_not_allowed'
      | 'invalid_value'
      | 'not_allowed',
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = 'SettingError';
  }
}

const KEY = /^(kete|prd_[a-z0-9_]{2,40})\.[a-z][a-z0-9_]{1,60}$/;

/** A setting's declaration, typed by its schema. */
export function setting<T>(declaration: SettingDeclaration<T>): SettingDeclaration {
  return declaration as SettingDeclaration;
}

export interface SettingsRegistry {
  get(key: string): SettingDeclaration | undefined;
  all(): readonly SettingDeclaration[];
  /** The declarations as JSON Schema, for the app's manifest. */
  describe(): SettingDescription[];
  /** A value checked against its declaration and the layer it is set on. */
  check(key: string, layer: SettableLayer, value: unknown): unknown;
}

/**
 * The settings a product knows: Kete's own and its app's. A key is declared once; a default must
 * fit its schema; a layer must be one of the five settable ones.
 */
export function defineSettings(
  ...groups: readonly (readonly SettingDeclaration[])[]
): SettingsRegistry {
  const byKey = new Map<string, SettingDeclaration>();
  for (const declaration of groups.flat()) {
    const { key } = declaration;
    if (!KEY.test(key)) {
      throw new SettingError('invalid_declaration', `« ${key} » is not a setting's key.`);
    }
    if (byKey.has(key)) throw new SettingError('invalid_declaration', `« ${key} » twice.`);
    if (declaration.layers.length === 0) {
      throw new SettingError('invalid_declaration', `« ${key} » can be set nowhere.`);
    }
    for (const layer of declaration.layers) {
      if (!(LAYERS as readonly string[]).includes(layer) || layer === ('kete' as string)) {
        throw new SettingError('invalid_declaration', `« ${key} »: no layer « ${layer} ».`);
      }
    }
    if ((declaration.sensitivity as string | undefined) === 'secret') {
      throw new SettingError('invalid_declaration', `« ${key} »: a secret is not a setting.`);
    }
    const fits = declaration.schema.safeParse(declaration.default);
    if (!fits.success) {
      throw new SettingError('invalid_declaration', `« ${key} »: its default does not fit.`);
    }
    byKey.set(key, declaration);
  }
  const all = [...byKey.values()];
  return {
    get: (key) => byKey.get(key),
    all: () => all,
    describe: () =>
      all.map((d) => ({
        key: d.key,
        default: d.default,
        layers: [...d.layers],
        ...(d.permission ? { permission: d.permission } : {}),
        sensitivity: d.sensitivity ?? 'internal',
        label: d.label,
        ...(d.description ? { description: d.description } : {}),
        ...(d.choices ? { choices: d.choices } : {}),
        group: d.group,
        schema: z.toJSONSchema(d.schema, { unrepresentable: 'any' }) as Record<string, unknown>,
      })),
    check(key, layer, value) {
      const declaration = byKey.get(key);
      if (!declaration) throw new SettingError('unknown_setting', `No setting « ${key} ».`);
      if (!declaration.layers.includes(layer)) {
        throw new SettingError('layer_not_allowed', `« ${key} » is not set on « ${layer} ».`);
      }
      const parsed = declaration.schema.safeParse(value);
      if (!parsed.success) {
        throw new SettingError(
          'invalid_value',
          `« ${key} » does not take this value.`,
          parsed.error.issues.map((i) => i.message),
        );
      }
      return parsed.data;
    },
  };
}
