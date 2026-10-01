import {
  Button,
  Panel,
  Tag,
  TextField,
  VerificationCard,
  type AgentStateName,
  type VerificationField,
} from '@kete/design';
import { useState } from 'react';
import type { DraftReview } from '@kete/capabilities';
import type { DetailContent, FormContent, TableContent, ViewContent } from '../src/contract.js';
import type fr from '../messages/fr.json';

export type Labels = typeof fr;

/** What the view asks of its host: call a tool of its server, open a link. */
export interface ViewHost {
  call(tool: string, args: Record<string, unknown>): Promise<Record<string, unknown> | undefined>;
  open(url: string): void;
}

interface Property {
  title?: string;
  type?: string | string[];
  enum?: unknown[];
}

function propertiesOf(schema: Record<string, unknown>): Record<string, Property> {
  return (schema['properties'] as Record<string, Property> | undefined) ?? {};
}

function isNumeric(property: Property | undefined): boolean {
  const types = [property?.type].flat();
  return types.includes('number') || types.includes('integer');
}

const shown = (value: unknown): string =>
  value === null || value === undefined
    ? ''
    : typeof value === 'object'
      ? JSON.stringify(value)
      : String(value);

const stateOf: Record<DraftReview['status'], AgentStateName> = {
  prepared: 'prepared',
  validated: 'verified',
  refused: 'refused',
};

/** A draft to verify: the person corrects it, validates it (level 3) or refuses it, in the view. */
function Review({
  initial,
  openUrl,
  labels,
  host,
}: {
  initial: DraftReview;
  openUrl?: string;
  labels: Labels;
  host: ViewHost;
}) {
  const [review, setReview] = useState(initial);
  const [values, setValues] = useState<Record<string, unknown>>(initial.values);
  const [editing, setEditing] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'validated' | 'error' | 'info'; text: string }>();
  const [busy, setBusy] = useState(false);
  const properties = propertiesOf(review.schema);
  const waiting = review.status === 'prepared';

  async function decide(tool: string, args: Record<string, unknown>) {
    setBusy(true);
    setMessage(undefined);
    try {
      const outcome = await host.call(tool, { draftId: review.draftId, ...args });
      const status = outcome?.['status'];
      if (outcome?.['review']) setReview(outcome['review'] as DraftReview);
      if (status === 'validated') setMessage({ tone: 'validated', text: labels.validated });
      else if (status === 'refused') setMessage({ tone: 'info', text: labels.refused });
      else if (status === 'open_in_app' && openUrl) host.open(openUrl);
      else {
        const reason = String(outcome?.['reason'] ?? 'error');
        setMessage({
          tone: 'error',
          text: (labels as Record<string, string>)[reason] ?? labels.error,
        });
      }
      setEditing(false);
      setRefusing(false);
    } catch {
      setMessage({ tone: 'error', text: labels.error });
    } finally {
      setBusy(false);
    }
  }

  const corrections = Object.fromEntries(
    Object.entries(values).filter(([key, value]) => value !== review.values[key]),
  );

  const fields: VerificationField[] = Object.keys(review.values).map((key) => {
    const provenance = review.provenance[key];
    const uncertain = provenance?.certainty === 'low';
    const source = provenance
      ? (labels as Record<string, string>)[`source_${provenance.source}`]
      : undefined;
    const property = properties[key];
    const label = property?.title ?? key;
    return {
      label,
      value: editing ? (
        <TextField
          label={label}
          type={isNumeric(property) ? 'number' : 'text'}
          value={shown(values[key])}
          onChange={(event) =>
            setValues({
              ...values,
              [key]: isNumeric(property) ? Number(event.target.value) : event.target.value,
            })
          }
        />
      ) : (
        <span className={isNumeric(property) ? 'font-number' : undefined}>
          {shown(review.values[key])}
        </span>
      ),
      provenance: uncertain ? `${source ?? ''} · ${labels.uncertain}` : (source ?? ''),
      uncertain,
    };
  });

  const actions = !waiting ? undefined : review.autonomy === 4 ? (
    <>
      <Button variant="secondary" disabled={busy} onClick={() => setRefusing(true)}>
        {labels.refuse}
      </Button>
      {openUrl && <Button onClick={() => host.open(openUrl)}>{labels.open_to_confirm}</Button>}
    </>
  ) : (
    <>
      <Button variant="secondary" disabled={busy} onClick={() => setRefusing(true)}>
        {labels.refuse}
      </Button>
      <Button variant="secondary" disabled={busy} onClick={() => setEditing(!editing)}>
        {labels.correct}
      </Button>
      <Button
        disabled={busy}
        onClick={() => void decide('kete_draft_validate', editing ? { corrections } : {})}
      >
        {labels.validate}
      </Button>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <VerificationCard
        title={review.description}
        state={{ name: stateOf[review.status], label: labels[`state_${review.status}`] }}
        fields={fields}
        {...(actions ? { actions } : {})}
      />
      {waiting && review.autonomy === 4 && <Tag tone="info">{labels.level_4}</Tag>}
      {refusing && (
        <div className="flex flex-col gap-3">
          <TextField
            label={labels.refusal_reason}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setRefusing(false)}>
              {labels.cancel}
            </Button>
            <Button
              disabled={busy || reason.trim() === ''}
              onClick={() => void decide('kete_draft_refuse', { reason: reason.trim() })}
            >
              {labels.confirm_refusal}
            </Button>
          </div>
        </div>
      )}
      {message && <Tag tone={message.tone}>{message.text}</Tag>}
      {!waiting && openUrl && (
        <button
          type="button"
          className="self-start text-link underline underline-offset-4"
          onClick={() => host.open(openUrl)}
        >
          {labels.open_in_app}
        </button>
      )}
    </div>
  );
}

function Table({ content, labels }: { content: TableContent; labels: Labels }) {
  return (
    <Panel title={content.title}>
      {content.rows.length === 0 ? (
        <p className="text-fg-muted">{content.empty ?? labels.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="border-b border-line text-left text-body-sm text-fg-muted">
                {content.columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.align === 'end' ? 'p-2 text-right' : 'p-2'}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.rows.map((row, index) => (
                <tr key={index} className="border-b border-line last:border-0">
                  {content.columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.align === 'end' ? 'p-2 text-right font-number' : 'p-2'}
                    >
                      {shown(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Detail({ content }: { content: DetailContent }) {
  return (
    <Panel title={content.title}>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
        {content.fields.map((field, index) => (
          <div key={index} className="contents">
            <dt className="text-body-sm text-fg-muted">{field.label}</dt>
            <dd className="text-body">{shown(field.value)}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function Form({ content, labels, host }: { content: FormContent; labels: Labels; host: ViewHost }) {
  const [values, setValues] = useState<Record<string, unknown>>(content.values ?? {});
  const [message, setMessage] = useState<{ tone: 'validated' | 'error'; text: string }>();
  const [busy, setBusy] = useState(false);
  const properties = propertiesOf(content.schema);
  const required = new Set((content.schema['required'] as string[] | undefined) ?? []);
  return (
    <Panel title={content.title}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          host
            .call(content.submit.tool, { ...content.submit.arguments, ...values })
            .then(() => setMessage({ tone: 'validated', text: labels.submitted }))
            .catch(() => setMessage({ tone: 'error', text: labels.error }))
            .finally(() => setBusy(false));
        }}
      >
        {Object.entries(properties).map(([key, property]) =>
          property.enum ? (
            <label key={key} className="flex flex-col gap-1.5 text-body-sm font-semibold text-fg">
              {property.title ?? key}
              <select
                className="h-(--control-height) rounded-control border border-line-strong bg-surface-control px-3 text-body text-fg"
                value={shown(values[key])}
                required={required.has(key)}
                onChange={(event) => setValues({ ...values, [key]: event.target.value })}
              >
                <option value="" />
                {property.enum.map((choice) => (
                  <option key={String(choice)} value={String(choice)}>
                    {String(choice)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <TextField
              key={key}
              label={property.title ?? key}
              type={isNumeric(property) ? 'number' : 'text'}
              required={required.has(key)}
              value={shown(values[key])}
              onChange={(event) =>
                setValues({
                  ...values,
                  [key]: isNumeric(property) ? Number(event.target.value) : event.target.value,
                })
              }
            />
          ),
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {content.submit.label}
          </Button>
        </div>
        {message && <Tag tone={message.tone}>{message.text}</Tag>}
      </form>
    </Panel>
  );
}

/** Shows what a tool returned: a draft to verify, or a generic view of its output. */
export function ViewRoot({
  content: given,
  labels,
  host,
}: {
  /** The tool result's structured content. */
  content: object | undefined;
  labels: Labels;
  host: ViewHost;
}) {
  if (!given) return <p className="p-4 text-fg-muted">{labels.waiting}</p>;
  const content = given as Record<string, unknown>;
  const openUrl = typeof content['openUrl'] === 'string' ? content['openUrl'] : undefined;
  if (content['review']) {
    return (
      <Review
        key={(content['review'] as DraftReview).draftId}
        initial={content['review'] as DraftReview}
        {...(openUrl ? { openUrl } : {})}
        labels={labels}
        host={host}
      />
    );
  }
  const view = ((content['output'] as ViewContent | undefined) ?? content) as ViewContent;
  if (view.view === 'table') return <Table content={view} labels={labels} />;
  if (view.view === 'detail') return <Detail content={view} />;
  if (view.view === 'form') return <Form content={view} labels={labels} host={host} />;
  return <p className="p-4 text-fg-muted">{labels.empty}</p>;
}
