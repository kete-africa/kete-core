import { commandsMigrationSql } from '@kete/commands';
import { draftsMigrationSql } from '@kete/drafts';
import { feedbackMigrationSql } from '@kete/feedback';
import { outboxMigrationSql } from '@kete/sdk';
import { tasksMigrationSql } from '@/features/tasks';

export interface MigrationContext {
  schema: string;
  appRole: string;
  ownerRole: string;
}

export interface Migration {
  name: string;
  sql(context: MigrationContext): string;
}

/**
 * The app's migrations, in order; never edit one that ran. Every table comes with its row-level
 * security in the same migration (constitution V).
 */
export const migrations: Migration[] = [
  {
    // The tables kete-core provides: command journal, drafts, event outbox, feedback.
    name: '0000_kete',
    sql: (context) =>
      [
        commandsMigrationSql(context),
        draftsMigrationSql(context),
        outboxMigrationSql(context),
        feedbackMigrationSql(context),
      ].join('\n'),
  },
  { name: '0001_tasks', sql: (context) => tasksMigrationSql(context) },
];
