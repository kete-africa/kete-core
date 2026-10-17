import { LAYERS, type Layer, type SettableLayer, type SettingsRegistry } from './declare.js';

// Resolution (spec 115, FR-003): for each setting, the most precise layer that holds a valid value
// wins; Kete's declared default otherwise. A value that no longer fits its schema, or sits on a layer
// its declaration does not allow, is skipped — never an error at the reader.

export type LayerValues = Partial<Record<SettableLayer, Readonly<Record<string, unknown>>>>;

export interface Resolved {
  /** The value of a setting; its declared default when no layer holds one. */
  value<T = unknown>(key: string): T;
  /** The layer the value comes from: `kete` for the default. */
  from(key: string): Layer;
  /** Every setting, with its value and where it comes from. */
  all(): { key: string; value: unknown; from: Layer }[];
}

const PRECISE_FIRST = [...LAYERS].reverse().filter((l): l is SettableLayer => l !== 'kete');

export function resolve(registry: SettingsRegistry, layers: LayerValues): Resolved {
  const found = new Map<string, { value: unknown; from: Layer }>();
  for (const declaration of registry.all()) {
    let chosen: { value: unknown; from: Layer } = { value: declaration.default, from: 'kete' };
    for (const layer of PRECISE_FIRST) {
      const values = layers[layer];
      if (!values || !Object.hasOwn(values, declaration.key)) continue;
      if (!declaration.layers.includes(layer)) continue;
      const parsed = declaration.schema.safeParse(values[declaration.key]);
      if (!parsed.success) continue;
      chosen = { value: parsed.data, from: layer };
      break;
    }
    found.set(declaration.key, chosen);
  }
  return {
    value<T>(key: string) {
      const entry = found.get(key);
      if (!entry) throw new Error(`No setting « ${key} ».`);
      return entry.value as T;
    },
    from(key) {
      const entry = found.get(key);
      if (!entry) throw new Error(`No setting « ${key} ».`);
      return entry.from;
    },
    all: () => [...found].map(([key, entry]) => ({ key, ...entry })),
  };
}
