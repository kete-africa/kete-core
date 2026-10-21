import { formatMoney } from '@kete/records';

// A draft anyone can read (spec 139, FR-013): each field with its label, its value as people read
// it — money with its currency, a date in their language, a reference by its name, lines one by
// one — and where it came from. The product gives its words; nothing raw is ever shown.

type Json = Record<string, unknown>;

export interface DraftToDescribe {
  /** The input's JSON Schema (a capability's), for titles, types and order. */
  schema: Json;
  values: Json;
  provenance?: Record<string, { source?: string; certainty?: string } | undefined>;
}

export interface DescribedField {
  key: string;
  label: string;
  /** As a person reads it; lines of a list on their own lines. */
  value: string;
  /** Where it came from (`typed`, `message`, `photo`…), when known. */
  source: string | null;
  /** The agent was not sure: a person checks it. */
  uncertain: boolean;
}

export interface DescribeOptions {
  /** `fr`, `en`: numbers, money and dates in that language. */
  locale: string;
  /** The product's label for a field (its catalog), else the schema's title, else the key; a field
   * inside another is named by its path (`lines.total`). */
  label?: (key: string, title: string | undefined) => string | undefined;
  /** A reference's name (`prj_…`, `pty_…`), when the product knows it. */
  name?: (id: string) => string | undefined;
  words?: { yes: string; no: string };
}

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isMoney = (value: unknown): value is { amount: number; currency: string } =>
  isObject(value) &&
  typeof value.amount === 'number' &&
  typeof value.currency === 'string' &&
  /^[A-Z]{3}$/.test(value.currency);
const reference = /^[a-z]{2,5}_[0-9A-Za-z_-]{6,}$/;
const humanized = (key: string) => {
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A field's label: `path` names it for the product (`lines.total`), `own` is its own key. */
function labelOf(
  path: string,
  schema: Json | undefined,
  options: DescribeOptions,
  own = path,
): string {
  const title = typeof schema?.title === 'string' ? schema.title : undefined;
  return options.label?.(path, title) ?? title ?? humanized(own);
}

function valueOf(
  value: unknown,
  schema: Json | undefined,
  options: DescribeOptions,
  path: string,
): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'boolean') {
    return value ? (options.words?.yes ?? '✓') : (options.words?.no ?? '—');
  }
  if (typeof value === 'number') return new Intl.NumberFormat(options.locale).format(value);
  if (typeof value === 'string') {
    const format = schema?.format;
    if (format === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Intl.DateTimeFormat(options.locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(`${value}T00:00:00Z`),
      );
    }
    if (format === 'date-time' && !Number.isNaN(Date.parse(value))) {
      return new Intl.DateTimeFormat(options.locale, {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(value));
    }
    if (reference.test(value)) return options.name?.(value) ?? value;
    return value;
  }
  if (isMoney(value)) return formatMoney(value, options.locale);
  const items = isObject(schema?.items) ? schema.items : undefined;
  if (Array.isArray(value)) {
    return value.map((item) => valueOf(item, items, options, path)).join('\n');
  }
  if (isObject(value)) {
    const properties = isObject(schema?.properties) ? schema.properties : {};
    return Object.entries(value)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => {
        const inner = isObject(properties[k]) ? properties[k] : undefined;
        const at = `${path}.${k}`;
        return `${labelOf(at, inner, options, k)} : ${valueOf(v, inner, options, at)}`;
      })
      .join(' · ');
  }
  return String(value);
}

/** The fields of a draft as a person reads them, in the schema's order. */
export function describeDraft(draft: DraftToDescribe, options: DescribeOptions): DescribedField[] {
  const properties = isObject(draft.schema.properties) ? draft.schema.properties : {};
  const keys = [
    ...Object.keys(properties).filter((key) => key in draft.values),
    ...Object.keys(draft.values).filter((key) => !(key in properties)),
  ];
  return keys.map((key) => {
    const schema = isObject(properties[key]) ? properties[key] : undefined;
    const provenance = draft.provenance?.[key];
    return {
      key,
      label: labelOf(key, schema, options),
      value: valueOf(draft.values[key], schema, options, key),
      source: provenance?.source ?? null,
      uncertain: provenance?.certainty === 'low',
    };
  });
}
