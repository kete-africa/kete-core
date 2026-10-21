// Threads, live (spec 139, FR-006): every change is announced by Postgres on commit (the triggers of
// `threadsLiveMigrationSql`), on the channel `kete_threads`. A product listens once, on a direct
// connection (a transaction pooler cannot listen), and streams each change to the screens of the
// thread's members; without such a connection it asks `changesSince` instead.

export type ThreadChangeKind = 'message' | 'read' | 'member' | 'file' | 'move' | 'thread';

export interface ThreadChange {
  organizationId: string;
  threadId: string;
  kind: ThreadChangeKind;
}

/** What `listenThreads` needs of a Postgres client: `pg`'s `Client` has it. */
export interface ListeningClient {
  query(sql: string): Promise<unknown>;
  on(
    event: 'notification',
    listener: (message: { channel: string; payload?: string | undefined }) => void,
  ): unknown;
  removeListener(
    event: 'notification',
    listener: (message: { channel: string; payload?: string | undefined }) => void,
  ): unknown;
}

const kinds = new Set<ThreadChangeKind>(['message', 'read', 'member', 'file', 'move', 'thread']);

/** Reads one announcement; anything else on the channel is ignored. */
export function threadChangeOf(payload: string | undefined): ThreadChange | null {
  try {
    const value = JSON.parse(payload ?? '') as { o?: unknown; t?: unknown; k?: unknown };
    if (typeof value.o !== 'string' || typeof value.t !== 'string') return null;
    if (!kinds.has(value.k as ThreadChangeKind)) return null;
    return { organizationId: value.o, threadId: value.t, kind: value.k as ThreadChangeKind };
  } catch {
    return null;
  }
}

/** Listens to the threads' changes; returns how to stop. */
export async function listenThreads(
  client: ListeningClient,
  onChange: (change: ThreadChange) => void,
): Promise<() => Promise<void>> {
  const listener = (message: { channel: string; payload?: string | undefined }) => {
    if (message.channel !== 'kete_threads') return;
    const change = threadChangeOf(message.payload);
    if (change) onChange(change);
  };
  client.on('notification', listener);
  await client.query('listen kete_threads');
  return async () => {
    client.removeListener('notification', listener);
    await client.query('unlisten kete_threads');
  };
}
