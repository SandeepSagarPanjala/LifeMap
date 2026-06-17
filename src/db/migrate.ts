import type {DB} from '@op-engineering/op-sqlite';

import migrations from '../../drizzle/migrations';

const MIGRATIONS_TABLE = '__drizzle_migrations';

type MigrationJournalEntry = {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type MigrationBundle = {
  journal: {entries: MigrationJournalEntry[]};
  migrations: Record<string, string>;
};

export type PreparedMigration = {
  sql: string[];
  folderMillis: number;
  hash: string;
  tag: string;
};

export function prepareMigrations(
  bundle: MigrationBundle = migrations as MigrationBundle,
): PreparedMigration[] {
  return bundle.journal.entries.map(entry => {
    const key = `m${entry.idx.toString().padStart(4, '0')}`;
    const query = bundle.migrations[key];
    if (!query) {
      throw new Error(`Missing migration: ${entry.tag}`);
    }

    return {
      sql: query
        .split('--> statement-breakpoint')
        .map(statement => statement.trim())
        .filter(Boolean),
      folderMillis: entry.when,
      hash: entry.tag,
      tag: entry.tag,
    };
  });
}

async function tableExists(sqlite: DB, tableName: string): Promise<boolean> {
  const result = await sqlite.executeAsync(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  return (result.rows?.length ?? 0) > 0;
}

async function columnExists(
  sqlite: DB,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await sqlite.executeAsync(`PRAGMA table_info("${tableName}")`);
  return (
    result.rows?.some(
      row => String((row as {name?: string}).name ?? '') === columnName,
    ) ?? false
  );
}

export async function migrationAlreadyApplied(
  sqlite: DB,
  migration: PreparedMigration,
): Promise<boolean> {
  switch (migration.tag) {
    case '0000_init':
      return tableExists(sqlite, 'location_points');
    case '0001_location_points_timestamp_idx':
      return tableExists(sqlite, 'location_points');
    case '0002_tracking_events':
      return tableExists(sqlite, 'tracking_events');
    case '0003_saved_places':
      return tableExists(sqlite, 'saved_places');
    case '0004_place_lookup_cache':
      return tableExists(sqlite, 'place_lookup_cache');
    case '0005_trips_materialization':
      return (
        (await tableExists(sqlite, 'trips')) &&
        (await tableExists(sqlite, 'materialized_days'))
      );
    case '0006_moments_mood':
      return columnExists(sqlite, 'moments', 'title');
    case '0007_settings_stats_cache':
      return tableExists(sqlite, 'settings_stats_cache');
    case '0008_trip_points':
      return tableExists(sqlite, 'trip_points');
    case '0009_trip_segment_metadata':
      return columnExists(sqlite, 'trips', 'segment_order');
    case '0010_trip_point_metadata':
      return columnExists(sqlite, 'trip_points', 'recorded_at');
    case '0011_drop_materialization_queue':
      return !(await tableExists(sqlite, 'materialization_queue'));
    default:
      return false;
  }
}

/** Repair columns when the journal is behind the bundled schema. */
export async function ensureTripSegmentMetadataColumns(sqlite: DB): Promise<void> {
  if (!(await tableExists(sqlite, 'trips'))) {
    return;
  }
  if (!(await columnExists(sqlite, 'trips', 'segment_order'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN segment_order integer DEFAULT 0 NOT NULL`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'saved_place_label'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN saved_place_label text`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'saved_place_id'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN saved_place_id integer`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'inferred'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN inferred integer DEFAULT 0 NOT NULL`,
    );
  }
}

export async function ensureTripPointMetadataColumns(sqlite: DB): Promise<void> {
  if (!(await tableExists(sqlite, 'trip_points'))) {
    return;
  }
  if (!(await columnExists(sqlite, 'trip_points', 'recorded_at'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trip_points ADD COLUMN recorded_at integer`,
    );
  }
  if (!(await columnExists(sqlite, 'trip_points', 'location_point_id'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trip_points ADD COLUMN location_point_id integer`,
    );
  }
  if (!(await columnExists(sqlite, 'trip_points', 'source'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trip_points ADD COLUMN source text DEFAULT 'gps'`,
    );
  }
}

async function readLastAppliedMillis(sqlite: DB): Promise<number> {
  const result = await sqlite.executeAsync(
    `SELECT created_at AS createdAt
     FROM "${MIGRATIONS_TABLE}"
     ORDER BY created_at DESC
     LIMIT 1`,
  );
  const row = result.rows?.[0] as {createdAt?: number | string} | undefined;
  return row?.createdAt != null ? Number(row.createdAt) : 0;
}

async function ensureMigrationsTable(sqlite: DB): Promise<void> {
  await sqlite.executeAsync(
    `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      hash TEXT NOT NULL,
      created_at NUMERIC NOT NULL
    )`,
  );
}

type SqlExecutor = {
  execute: (query: string, params?: unknown[]) => Promise<unknown>;
};

async function recordMigration(
  migration: PreparedMigration,
  executor: SqlExecutor,
): Promise<void> {
  await executor.execute(
    `INSERT INTO "${MIGRATIONS_TABLE}" (hash, created_at) VALUES (?, ?)`,
    [migration.hash, migration.folderMillis],
  );
}

async function bootstrapExistingMigrationJournal(
  sqlite: DB,
  prepared: PreparedMigration[],
): Promise<void> {
  for (const migration of prepared) {
    if (!(await migrationAlreadyApplied(sqlite, migration))) {
      continue;
    }
    await recordMigration(migration, sqlite);
  }
}

function isDuplicateColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate column name/i.test(message);
}

async function executeMigrationStatement(
  executor: SqlExecutor,
  statement: string,
): Promise<void> {
  try {
    await executor.execute(statement);
  } catch (error) {
    if (isDuplicateColumnError(error)) {
      return;
    }
    throw error;
  }
}

/**
 * Drizzle 0.45.x ships broken SQLite migrator SQL (`SERIAL PRIMARY KEY`).
 * Run bundled migrations directly against op-sqlite instead.
 */
export async function runMigrations(sqlite: DB): Promise<void> {
  const prepared = prepareMigrations();
  await ensureMigrationsTable(sqlite);

  const migrationCount = await sqlite.executeAsync(
    `SELECT COUNT(*) AS count FROM "${MIGRATIONS_TABLE}"`,
  );
  const appliedCount = Number(
    (migrationCount.rows?.[0] as {count?: number | string} | undefined)?.count ?? 0,
  );

  if (appliedCount === 0 && (await tableExists(sqlite, 'location_points'))) {
    await bootstrapExistingMigrationJournal(sqlite, prepared);
  }

  const lastAppliedMillis = await readLastAppliedMillis(sqlite);
  const pending = prepared.filter(
    migration => migration.folderMillis > lastAppliedMillis,
  );
  if (pending.length === 0) {
    return;
  }

  await sqlite.transaction(async tx => {
    for (const migration of pending) {
      for (const statement of migration.sql) {
        await executeMigrationStatement(tx, statement);
      }
      await recordMigration(migration, tx);
    }
  });
}
