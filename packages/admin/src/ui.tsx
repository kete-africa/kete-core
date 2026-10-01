// The operator space's screens: no server dependency, they ship to browsers.
import type { JournalEntry } from '@kete/commands';
import { Panel, Tag } from '@kete/design';
import type { ReactNode } from 'react';

export interface AuditLabels {
  title: string;
  when: string;
  who: string;
  what: string;
  channel: string;
  /** "for {name}", when an agent acted on behalf of a person. */
  onBehalfOf(name: string): string;
  /** "at the request of {names}", when other agents asked (doctrine D-039). Shown when given. */
  delegatedBy?(names: string): string;
  reversible: string;
  empty: string;
}

/**
 * The audit of an operator space: when, who (and for whom), through what, what was done, and
 * whether it can be undone. Every word comes from the product's catalogs.
 */
export function AuditLog({
  entries,
  labels,
  nameOf,
  formatDate,
}: {
  entries: JournalEntry[];
  labels: AuditLabels;
  /** A person's or an agent's name, from its identifier. */
  nameOf(actor: { kind: string; id: string }): ReactNode;
  formatDate(date: Date): string;
}) {
  return (
    <Panel title={labels.title}>
      {entries.length === 0 ? (
        <p className="text-fg-muted">{labels.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-body">
            <thead>
              <tr className="border-b border-line text-left text-body-sm text-fg-muted">
                <th scope="col" className="p-2">
                  {labels.when}
                </th>
                <th scope="col" className="p-2">
                  {labels.who}
                </th>
                <th scope="col" className="p-2">
                  {labels.channel}
                </th>
                <th scope="col" className="p-2">
                  {labels.what}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.commandId} className="border-b border-line align-top last:border-0">
                  <td className="p-2 font-number whitespace-nowrap">
                    {formatDate(entry.createdAt)}
                  </td>
                  <td className="p-2">
                    {nameOf(entry.actor)}
                    {entry.onBehalfOf && (
                      <span className="block text-body-sm text-fg-muted">
                        {labels.onBehalfOf(String(nameOf(entry.onBehalfOf)))}
                      </span>
                    )}
                    {labels.delegatedBy && entry.delegatedBy.length > 0 && (
                      <span className="block text-body-sm text-fg-muted">
                        {labels.delegatedBy(
                          entry.delegatedBy.map((agent) => String(nameOf(agent))).join(' → '),
                        )}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-fg-muted">{entry.channel}</td>
                  <td className="p-2">
                    <span className="flex flex-wrap items-center gap-2">
                      {entry.summary ?? entry.name}
                      {entry.reversible && <Tag tone="info">{labels.reversible}</Tag>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
