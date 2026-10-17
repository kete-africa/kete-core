import { CheckField, Panel, Tag } from '@kete/design';
import { useId, useState, type ReactNode } from 'react';

// « Réglages » (kete-core spec 116; decision 0013; doctrine D-060): the same panel in every Kete
// app, drawn from the settings' declarations. Each setting shows its value, where that value comes
// from, and — when this screen may set it — the control its schema calls for: her own preferences
// (they follow her in every app) apart from what is set for the whole organization.

/** Where a value comes from, from the broadest to the most precise. */
export type SettingLayer = 'kete' | 'organization' | 'app' | 'entity' | 'person' | 'device';
/** The layers a screen sets a value on. */
export type EditableLayer = 'person' | 'app' | 'entity';

/** A setting as the panel shows it: its declaration in her language, its value and its origin. */
export interface SettingRow {
  key: string;
  label: string;
  description?: string;
  group: string;
  /** Its schema, as JSON Schema (`describe()` of @kete/settings). */
  schema: Record<string, unknown>;
  /** The words of each choice, in her language. */
  choices?: Readonly<Record<string, string>>;
  value: unknown;
  from: SettingLayer;
  /** The layer this screen sets it on, for her; absent: shown here, set elsewhere. */
  editable?: EditableLayer;
  /** Where it may be set at all, so the panel can say where when it is not here. */
  layers?: readonly SettingLayer[];
}

/** Every word the panel shows, from the product's catalogs. */
export interface SettingsWords {
  /** « Pour moi », and what it means: they follow her in every app. */
  mine: string;
  mineHint: string;
  /** « Pour l'organisation », and what it means. */
  organization: string;
  organizationHint: string;
  group: (group: string) => string;
  /** « Valeur de Kete », « Réglé par l'organisation », « Votre préférence »… */
  from: (layer: SettingLayer) => string;
  /** Takes a value back to what it inherits. */
  inherit: string;
  /** The empty choice of a setting that may hold nothing. */
  none: string;
  yes: string;
  no: string;
  /** A part of a value: `from` and `to` of hours. */
  part: (name: string) => string;
  /** Said under a setting set elsewhere: in the Compte Kete, by an administrator. */
  elsewhere: (row: SettingRow) => string;
  saving: string;
  saved: string;
  failed: (code: string) => string;
}

export type SettingResult = { ok: true } | { ok: false; error: string };

type Schema = Record<string, unknown>;

/** The control a setting's schema calls for. */
export type SettingControl =
  | { kind: 'choice'; options: string[]; nullable: boolean }
  | { kind: 'tick' }
  | { kind: 'number'; min?: number; max?: number; integer: boolean }
  | { kind: 'text'; input: 'text' | 'email' | 'time'; maxLength?: number; nullable: boolean }
  | { kind: 'ticks'; options: string[]; numeric: boolean }
  | { kind: 'parts'; parts: string[]; input: 'text' | 'time'; nullable: boolean }
  | { kind: 'shown' };

const isSchema = (value: unknown): value is Schema =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isHour = (schema: Schema) =>
  typeof schema.pattern === 'string' && schema.pattern.includes(':[0-5]');
const stringsOf = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((v) => typeof v === 'string') ? (value as string[]) : null;

/** Reads a schema into a control; what no control fits is shown, never set here. */
export function controlOf(
  schema: Schema,
  choices?: Readonly<Record<string, string>>,
): SettingControl {
  let inner = schema;
  let nullable = false;
  if (Array.isArray(schema.anyOf)) {
    const branches = schema.anyOf.filter(isSchema);
    // An empty text allowed beside a format (`'' | email`) is the format's own field.
    const others = branches.filter((b) => b.type !== 'null' && b.const !== '');
    nullable = branches.some((b) => b.type === 'null');
    if (others.length !== 1 || !others[0]) return { kind: 'shown' };
    inner = others[0];
  }
  const options = stringsOf(inner.enum);
  if (options) return { kind: 'choice', options, nullable };
  if (nullable && inner.type !== 'object' && inner.type !== 'string') return { kind: 'shown' };
  switch (inner.type) {
    case 'boolean':
      return { kind: 'tick' };
    case 'integer':
    case 'number':
      return {
        kind: 'number',
        integer: inner.type === 'integer',
        ...(typeof inner.minimum === 'number' ? { min: inner.minimum } : {}),
        ...(typeof inner.maximum === 'number' ? { max: inner.maximum } : {}),
      };
    case 'string':
      return {
        kind: 'text',
        input: inner.format === 'email' ? 'email' : isHour(inner) ? 'time' : 'text',
        ...(typeof inner.maxLength === 'number' ? { maxLength: inner.maxLength } : {}),
        nullable,
      };
    case 'array': {
      const items = isSchema(inner.items) ? inner.items : {};
      const listed = stringsOf(items.enum);
      if (listed) return { kind: 'ticks', options: listed, numeric: false };
      if ((items.type === 'integer' || items.type === 'number') && choices) {
        return { kind: 'ticks', options: Object.keys(choices), numeric: true };
      }
      return { kind: 'shown' };
    }
    case 'object': {
      const properties = isSchema(inner.properties) ? inner.properties : null;
      if (!properties || inner.additionalProperties !== false) return { kind: 'shown' };
      const parts = Object.entries(properties);
      if (parts.length === 0 || !parts.every(([, p]) => isSchema(p) && p.type === 'string')) {
        return { kind: 'shown' };
      }
      const hours = parts.every(([, p]) => isHour(p as Schema));
      return {
        kind: 'parts',
        parts: parts.map(([name]) => name),
        input: hours ? 'time' : 'text',
        nullable,
      };
    }
    default:
      return { kind: 'shown' };
  }
}

/** A value in words: its choice's words, ticks joined, parts joined. */
export function sayValue(row: SettingRow, words: Pick<SettingsWords, 'yes' | 'no' | 'none'>) {
  const { value } = row;
  const word = (v: unknown) => row.choices?.[String(v)] ?? String(v);
  if (value === null || value === undefined || value === '') return words.none;
  if (typeof value === 'boolean') return value ? words.yes : words.no;
  if (Array.isArray(value)) {
    if (value.length === 0) return words.none;
    return value.map((v) => (isSchema(v) ? Object.values(v).join(' · ') : word(v))).join(', ');
  }
  if (isSchema(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return words.none;
    return entries.every(([, v]) => typeof v === 'string' && /^\d\d:\d\d$/.test(v))
      ? entries.map(([, v]) => v).join(' – ')
      : entries.map(([k, v]) => `${k} ${String(v)}`).join(' · ');
  }
  return word(value);
}

type Status = { state: 'saving' } | { state: 'saved' } | { state: 'failed'; error: string };

function Row({
  row,
  words,
  onSave,
  onClear,
  status,
  setStatus,
}: {
  row: SettingRow;
  words: SettingsWords;
  onSave: (key: string, layer: EditableLayer, value: unknown) => Promise<SettingResult>;
  onClear: (key: string, layer: EditableLayer) => Promise<SettingResult>;
  status: Status | undefined;
  setStatus: (status: Status) => void;
}) {
  const control = row.editable ? controlOf(row.schema, row.choices) : ({ kind: 'shown' } as const);
  const layer = row.editable;
  const labelId = useId();

  async function run(work: () => Promise<SettingResult>) {
    setStatus({ state: 'saving' });
    const result = await work().catch(() => ({ ok: false as const, error: 'unreachable' }));
    setStatus(result.ok ? { state: 'saved' } : { state: 'failed', error: result.error });
  }
  const save = (value: unknown) => {
    if (layer) void run(() => onSave(row.key, layer, value));
  };
  const word = (v: string) => row.choices?.[v] ?? v;

  const controlProps = (extra: string) => ({
    className: `h-(--control-height) w-full rounded-control border border-line-strong bg-surface-control px-3 font-ui text-body text-fg ${extra}`,
    'aria-labelledby': labelId,
  });

  let field: ReactNode = null;
  switch (control.kind) {
    case 'choice':
      field = (
        <select
          {...controlProps('')}
          defaultValue={row.value === null || row.value === undefined ? '' : String(row.value)}
          onChange={(event) => save(event.currentTarget.value || null)}
        >
          {control.nullable && <option value="">{words.none}</option>}
          {control.options.map((option) => (
            <option key={option} value={option}>
              {word(option)}
            </option>
          ))}
        </select>
      );
      break;
    case 'tick':
      field = (
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            aria-labelledby={labelId}
            className="size-5 shrink-0 accent-(--color-action)"
            defaultChecked={row.value === true}
            onChange={(event) => save(event.currentTarget.checked)}
          />
          <span className="text-body text-fg">{row.value === true ? words.yes : words.no}</span>
        </label>
      );
      break;
    case 'number':
      field = (
        <input
          {...controlProps('max-w-40')}
          type="number"
          inputMode={control.integer ? 'numeric' : 'decimal'}
          defaultValue={typeof row.value === 'number' ? String(row.value) : ''}
          {...(control.min !== undefined ? { min: control.min } : {})}
          {...(control.max !== undefined ? { max: control.max } : {})}
          step={control.integer ? 1 : 'any'}
          onBlur={(event) => {
            const text = event.currentTarget.value.trim();
            if (text !== '' && Number(text) !== row.value) save(Number(text));
          }}
        />
      );
      break;
    case 'text':
      field = (
        <input
          {...controlProps(control.input === 'time' ? 'max-w-40' : '')}
          type={control.input}
          defaultValue={typeof row.value === 'string' ? row.value : ''}
          {...(control.maxLength !== undefined ? { maxLength: control.maxLength } : {})}
          onBlur={(event) => {
            const text = event.currentTarget.value;
            const next = text === '' && control.nullable ? null : text;
            if (next !== (row.value ?? (control.nullable ? null : ''))) save(next);
          }}
        />
      );
      break;
    case 'ticks': {
      const held = new Set((Array.isArray(row.value) ? row.value : []).map(String));
      field = (
        <div role="group" aria-labelledby={labelId}>
          <TickList
            options={control.options}
            held={held}
            word={word}
            onChange={(next) => save(control.numeric ? next.map(Number) : next)}
          />
        </div>
      );
      break;
    }
    case 'parts': {
      const current = isSchema(row.value) ? row.value : {};
      field = (
        <form
          aria-labelledby={labelId}
          className="flex flex-wrap items-end gap-3"
          onBlur={(event) => {
            const form = event.currentTarget;
            const next = Object.fromEntries(
              control.parts.map((part) => [
                part,
                (form.elements.namedItem(part) as HTMLInputElement | null)?.value ?? '',
              ]),
            );
            const filled = Object.values(next).filter((v) => v !== '').length;
            if (filled === control.parts.length) {
              if (control.parts.some((part) => next[part] !== current[part])) save(next);
            } else if (filled === 0 && control.nullable && row.value !== null) {
              save(null);
            }
          }}
          onSubmit={(event) => event.preventDefault()}
        >
          {control.parts.map((part) => (
            <label key={part} className="flex flex-col gap-1">
              <span className="text-body-sm text-fg-muted">{words.part(part)}</span>
              <input
                name={part}
                type={control.input}
                className="h-(--control-height) w-32 rounded-control border border-line-strong bg-surface-control px-3 font-ui text-body text-fg"
                defaultValue={typeof current[part] === 'string' ? current[part] : ''}
              />
            </label>
          ))}
        </form>
      );
      break;
    }
    case 'shown':
      field = <span className="text-body text-fg">{sayValue(row, words)}</span>;
      break;
  }

  const said =
    status?.state === 'saving'
      ? words.saving
      : status?.state === 'saved'
        ? words.saved
        : status?.state === 'failed'
          ? words.failed(status.error)
          : '';
  return (
    <li
      className="grid gap-x-8 gap-y-3 border-b border-line py-4 last:border-b-0 @min-[640px]/main:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
      data-setting={row.key}
    >
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <span id={labelId} className="font-semibold text-fg">
          {row.label}
        </span>
        {row.description && <span className="text-body-sm text-fg-muted">{row.description}</span>}
        <Tag tone={layer && row.from === layer ? 'info' : 'neutral'}>{words.from(row.from)}</Tag>
        {!row.editable && (
          <span className="text-body-sm text-fg-muted">{words.elsewhere(row)}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-2">
        {field}
        <span className="flex flex-wrap items-center gap-3">
          {layer && row.from === layer && (
            <button
              type="button"
              className="text-body-sm text-fg-soft underline underline-offset-2 hover:text-fg"
              onClick={() => void run(() => onClear(row.key, layer))}
            >
              {words.inherit}
            </button>
          )}
          <span
            role="status"
            className={`text-body-sm ${status?.state === 'failed' ? 'text-state-error-fg' : 'text-fg-muted'}`}
          >
            {said}
          </span>
        </span>
      </div>
    </li>
  );
}

function TickList({
  options,
  held,
  word,
  onChange,
}: {
  options: string[];
  held: Set<string>;
  word: (value: string) => string;
  onChange: (next: string[]) => void;
}) {
  const [ticked, setTicked] = useState(held);
  return (
    <div className="flex flex-wrap gap-x-6">
      {options.map((option) => (
        <CheckField
          key={option}
          label={word(option)}
          checked={ticked.has(option)}
          onChange={(on) => {
            const next = new Set(ticked);
            if (on) next.add(option);
            else next.delete(option);
            setTicked(next);
            onChange(options.filter((o) => next.has(o)));
          }}
        />
      ))}
    </div>
  );
}

function Groups({
  rows,
  words,
  onSave,
  onClear,
  statuses,
  setStatus,
}: {
  rows: readonly SettingRow[];
  words: SettingsWords;
  onSave: (key: string, layer: EditableLayer, value: unknown) => Promise<SettingResult>;
  onClear: (key: string, layer: EditableLayer) => Promise<SettingResult>;
  statuses: Readonly<Record<string, Status>>;
  setStatus: (key: string, status: Status) => void;
}) {
  const groups = [...new Set(rows.map((row) => row.group))];
  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group}>
          <h3 className="mt-2 text-body-sm font-semibold tracking-wide text-fg-muted uppercase">
            {words.group(group)}
          </h3>
          <ul>
            {rows
              .filter((row) => row.group === group)
              .map((row) => (
                <Row
                  // A value that changed — saved, or taken back — draws its control afresh.
                  key={`${row.key}|${row.from}|${JSON.stringify(row.value)}`}
                  row={row}
                  words={words}
                  onSave={onSave}
                  onClear={onClear}
                  status={statuses[row.key]}
                  setStatus={(status) => setStatus(row.key, status)}
                />
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * « Réglages »: her preferences first, then what is set for the whole organization — each setting
 * with its value and where it comes from; a change is saved at once, and a value set here can go
 * back to what it inherits.
 */
export function SettingsPanel({
  rows,
  words,
  onSave,
  onClear,
}: {
  rows: readonly SettingRow[];
  words: SettingsWords;
  onSave: (key: string, layer: EditableLayer, value: unknown) => Promise<SettingResult>;
  onClear: (key: string, layer: EditableLayer) => Promise<SettingResult>;
}) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const setStatus = (key: string, status: Status) =>
    setStatuses((current) => ({ ...current, [key]: status }));
  const mine = rows.filter((row) => row.editable === 'person');
  const theirs = rows.filter((row) => row.editable !== 'person');
  return (
    <div className="flex flex-col gap-6">
      {mine.length > 0 && (
        <Panel title={words.mine}>
          <p className="mb-2 text-body-sm text-fg-muted">{words.mineHint}</p>
          <Groups
            rows={mine}
            words={words}
            onSave={onSave}
            onClear={onClear}
            statuses={statuses}
            setStatus={setStatus}
          />
        </Panel>
      )}
      {theirs.length > 0 && (
        <Panel title={words.organization}>
          <p className="mb-2 text-body-sm text-fg-muted">{words.organizationHint}</p>
          <Groups
            rows={theirs}
            words={words}
            onSave={onSave}
            onClear={onClear}
            statuses={statuses}
            setStatus={setStatus}
          />
        </Panel>
      )}
    </div>
  );
}
