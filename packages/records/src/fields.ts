import type { z } from 'zod';

/**
 * What every field of a record says about itself (CONCEPTION A.1): its translated label (a message
 * key of the app's catalogs, never a visible string), whether it is personal data, and whether a
 * person must check it when an agent filled it.
 */
export interface FieldMeta {
  /** A translation key, e.g. `deposit.customer_phone`. */
  label: string;
  /** Personal data: redacted from logs and exports, anonymized on erasure. */
  personal?: boolean;
  /** When an agent fills it, a person checks it before validation. */
  verify?: boolean;
}

const metaKey = 'kete';

/** Declares a field with its metadata: `field(z.string(), { label: 'deposit.customer', personal: true })`. */
export function field<T extends z.ZodType>(schema: T, meta: FieldMeta): T {
  return schema.meta({ [metaKey]: meta }) as T;
}

/** What a form, an MCP tool, an export or a verification card needs to know about a field. */
export interface FieldDescriptor extends FieldMeta {
  name: string;
  required: boolean;
}

function metaOf(schema: z.ZodType): FieldMeta | undefined {
  const own = schema.meta() as Record<string, unknown> | undefined;
  const meta = own?.[metaKey] as FieldMeta | undefined;
  if (meta) return meta;
  // An optional or defaulted field keeps the metadata of the schema it wraps.
  const inner = (schema as unknown as { unwrap?: () => z.ZodType }).unwrap?.();
  return inner ? metaOf(inner) : undefined;
}

/** Every field of a record schema, in declaration order, with its metadata. */
export function describeFields(schema: z.ZodObject): FieldDescriptor[] {
  return Object.entries(schema.shape).map(([name, fieldSchema]) => {
    const typed = fieldSchema as z.ZodType;
    const meta = metaOf(typed);
    return {
      name,
      required: !typed.safeParse(undefined).success,
      label: meta?.label ?? name,
      personal: meta?.personal ?? false,
      verify: meta?.verify ?? false,
    };
  });
}

/** Replaces personal fields by a marker, for logs, analytics and anything leaving the service. */
export function redactPersonal<T extends Record<string, unknown>>(
  schema: z.ZodObject,
  value: T,
): T {
  const personal = new Set(
    describeFields(schema)
      .filter((f) => f.personal)
      .map((f) => f.name),
  );
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [
      key,
      personal.has(key) && v != null ? '[personal]' : v,
    ]),
  ) as T;
}
