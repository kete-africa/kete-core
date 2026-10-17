import type { Holding as SaidHolding } from '@kete/sdk';
import type { SqlExecutor } from '@kete/tenancy';
import { finishHolding, openHoldings, sayHolding, type Holding } from './holdings.js';

// A source's holdings kept in step with what it holds now (spec 114): an app — or one of the
// product's own sources — says every thing it has in progress; what changed is said again, what it
// no longer says is finished. Said twice, nothing moves.

const keyOf = (source: { kind: string; ref: string }) => `${source.kind}:${source.ref}`;

/** Whether what the source says now is what the holding already keeps: nothing to write. */
function unchanged(kept: Holding, said: SaidHolding): boolean {
  return (
    kept.what === said.what &&
    kept.holder.kind === said.holder.kind &&
    kept.holder.id === said.holder.id &&
    kept.state === said.state &&
    (kept.waitingOn?.id ?? null) === (said.waiting_on?.id ?? null) &&
    kept.due === (said.due ?? null) &&
    kept.object.kind === said.object.kind &&
    kept.object.id === said.object.id &&
    kept.purpose === (said.for ?? 'action') &&
    kept.href === (said.href ?? null)
  );
}

/**
 * Keeps the open holdings of one source (`app`) in step with what it says it holds now. A holding
 * the relay gave to someone while its holder is away keeps who stands in: the source still names
 * the absent holder. Every holding said must be of that source.
 */
export async function syncSource(
  db: SqlExecutor,
  organizationId: string,
  input: { app: string; said: readonly SaidHolding[]; now?: Date },
): Promise<{ said: number; finished: number }> {
  const now = input.now ?? new Date();
  const kept = new Map(
    (await openHoldings(db, { app: input.app })).map((h) => [keyOf(h.source), h]),
  );
  let said = 0;
  const seen = new Set<string>();
  for (const item of input.said) {
    if (item.source.app !== input.app) {
      throw new Error(`A holding of « ${item.source.app} » said as « ${input.app} ».`);
    }
    const key = keyOf(item.source);
    seen.add(key);
    const holding = kept.get(key);
    const relayed =
      holding?.takenOverFrom &&
      holding.takenOverFrom.kind === item.holder.kind &&
      holding.takenOverFrom.id === item.holder.id;
    const next = relayed ? { ...item, holder: holding.holder } : item;
    if (holding && unchanged(holding, next)) continue;
    await sayHolding(db, organizationId, next, now);
    said += 1;
  }
  let finished = 0;
  for (const [key, holding] of kept) {
    if (seen.has(key)) continue;
    if (await finishHolding(db, organizationId, holding.holdingId, now)) finished += 1;
  }
  return { said, finished };
}
