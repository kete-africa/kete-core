import { readJournal, type JournalEntry, type JournalQuery } from '@kete/commands';
import type { SqlExecutor } from '@kete/tenancy';

/** What happened in the organization, newest first: every command, with who and through what. */
export function readAudit(db: SqlExecutor, query: JournalQuery = {}): Promise<JournalEntry[]> {
  return readJournal(db, query);
}
