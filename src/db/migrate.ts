import type {DB} from '@op-engineering/op-sqlite';

import {
  countLocationPointDuplicateExtraRows,
  ensureLocationPointsDedupeUniqueIndex,
} from './location-points-dedupe';
import {LOCATION_POINTS_DEDUPE_UNIQUE_INDEX} from './location-points-policy';
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
  const result = await sqlite.execute(
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
  const result = await sqlite.execute(`PRAGMA table_info("${tableName}")`);
  return (
    result.rows?.some(
      (row: Record<string, unknown>) =>
        String(row.name ?? '') === columnName,
    ) ?? false
  );
}

async function indexExists(sqlite: DB, indexName: string): Promise<boolean> {
  const result = await sqlite.execute(
    `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
    [indexName],
  );
  return (result.rows?.length ?? 0) > 0;
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
    case '0012_moments_voice':
      return columnExists(sqlite, 'moments', 'voice_attachment_path');
    case '0013_note_photo_attachments':
      return columnExists(sqlite, 'moments', 'photo_attachments_json');
    case '0014_materialized_day_geometry':
      return columnExists(sqlite, 'materialized_days', 'geometry_fingerprint');
    case '0015_saved_place_address':
      return columnExists(sqlite, 'saved_places', 'address_line');
    case '0016_moment_voice_duration':
      return columnExists(sqlite, 'moments', 'voice_duration_sec');
    case '0017_activities':
      return tableExists(sqlite, 'activities');
    case '0018_saved_places_active':
      return columnExists(sqlite, 'saved_places', 'active');
    case '0019_location_points_dedupe_unique':
      return indexExists(sqlite, LOCATION_POINTS_DEDUPE_UNIQUE_INDEX);
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

/** Repair materialized_days geometry column when migration 0014 was skipped. */
export async function ensureMaterializedDayGeometryColumn(
  sqlite: DB,
): Promise<void> {
  if (!(await tableExists(sqlite, 'materialized_days'))) {
    return;
  }
  if (!(await columnExists(sqlite, 'materialized_days', 'geometry_fingerprint'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE materialized_days ADD COLUMN geometry_fingerprint text`,
    );
  }
}

/** Repair moments columns when migration 0006 was skipped by journal drift. */
export async function ensureMomentsMoodColumns(sqlite: DB): Promise<void> {
  if (!(await tableExists(sqlite, 'moments'))) {
    return;
  }
  const columns: Array<{name: string; ddl: string}> = [
    {name: 'title', ddl: 'ALTER TABLE moments ADD COLUMN title text'},
    {name: 'mood_score', ddl: 'ALTER TABLE moments ADD COLUMN mood_score real'},
    {name: 'mood_label', ddl: 'ALTER TABLE moments ADD COLUMN mood_label text'},
    {name: 'finished_at', ddl: 'ALTER TABLE moments ADD COLUMN finished_at integer'},
    {name: 'content_bytes', ddl: 'ALTER TABLE moments ADD COLUMN content_bytes integer'},
    {name: 'source_bytes', ddl: 'ALTER TABLE moments ADD COLUMN source_bytes integer'},
    {name: 'content_format', ddl: 'ALTER TABLE moments ADD COLUMN content_format text'},
    {
      name: 'voice_attachment_path',
      ddl: 'ALTER TABLE moments ADD COLUMN voice_attachment_path text',
    },
    {
      name: 'voice_attachment_bytes',
      ddl: 'ALTER TABLE moments ADD COLUMN voice_attachment_bytes integer',
    },
    {
      name: 'photo_attachments_json',
      ddl: 'ALTER TABLE moments ADD COLUMN photo_attachments_json text',
    },
  ];
  for (const column of columns) {
    if (!(await columnExists(sqlite, 'moments', column.name))) {
      await executeMigrationStatement(sqlite, column.ddl);
    }
  }
}

export async function collectPendingMigrations(
  sqlite: DB,
  prepared: PreparedMigration[] = prepareMigrations(),
): Promise<PreparedMigration[]> {
  const pending: PreparedMigration[] = [];
  for (const migration of prepared) {
    if (!(await migrationAlreadyApplied(sqlite, migration))) {
      pending.push(migration);
    }
  }
  return pending;
}

async function ensureMigrationsTable(sqlite: DB): Promise<void> {
  await sqlite.execute(
    `CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      hash TEXT NOT NULL,
      created_at NUMERIC NOT NULL
    )`,
  );
}

type SqlExecutor = Pick<DB, 'execute'>;

async function recordMigration(
  migration: PreparedMigration,
  executor: SqlExecutor,
): Promise<void> {
  await executor.execute(
    `INSERT INTO "${MIGRATIONS_TABLE}" (hash, created_at) VALUES (?, ?)`,
    [migration.hash, migration.folderMillis],
  );
}

async function migrationRecorded(
  executor: SqlExecutor,
  hash: string,
): Promise<boolean> {
  const result = (await executor.execute(
    `SELECT id FROM "${MIGRATIONS_TABLE}" WHERE hash = ? LIMIT 1`,
    [hash],
  )) as {rows?: unknown[]};
  return (result.rows?.length ?? 0) > 0;
}

async function recordMigrationIfMissing(
  migration: PreparedMigration,
  executor: SqlExecutor,
): Promise<void> {
  if (await migrationRecorded(executor, migration.hash)) {
    return;
  }
  await recordMigration(migration, executor);
}

export async function markMigrationAppliedByTag(
  sqlite: DB,
  tag: string,
): Promise<void> {
  const migration = prepareMigrations().find(entry => entry.tag === tag);
  if (migration) {
    await recordMigrationIfMissing(migration, sqlite);
  }
}

async function bootstrapExistingMigrationJournal(
  sqlite: DB,
  prepared: PreparedMigration[],
): Promise<void> {
  for (const migration of prepared) {
    if (!(await migrationAlreadyApplied(sqlite, migration))) {
      continue;
    }
    await recordMigrationIfMissing(migration, sqlite);
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

  const migrationCount = await sqlite.execute(
    `SELECT COUNT(*) AS count FROM "${MIGRATIONS_TABLE}"`,
  );
  const appliedCount = Number(
    (migrationCount.rows?.[0] as {count?: number | string} | undefined)?.count ??
      0,
  );

  if (appliedCount === 0 && (await tableExists(sqlite, 'location_points'))) {
    await bootstrapExistingMigrationJournal(sqlite, prepared);
  }

  const pending = await collectPendingMigrations(sqlite, prepared);
  if (pending.length === 0) {
    return;
  }

  await sqlite.transaction(async tx => {
    for (const migration of pending) {
      if (migration.tag === '0019_location_points_dedupe_unique') {
        if ((await countLocationPointDuplicateExtraRows(tx)) > 0) {
          continue;
        }
      }
      for (const statement of migration.sql) {
        await executeMigrationStatement(tx, statement);
      }
      await recordMigrationIfMissing(migration, tx);
    }
  });
}

/** Create the GPS dedupe unique index when the table has no duplicate rows. */
export async function repairLocationPointsDedupeUniqueIndex(
  sqlite: DB,
): Promise<void> {
  await ensureLocationPointsDedupeUniqueIndex(sqlite);
}
