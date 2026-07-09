import type { DB } from '@op-engineering/op-sqlite';

import {
  countLocationPointDuplicateExtraRows,
  ensureLocationPointsDedupeUniqueIndex,
} from './location-points-dedupe';
import { LOCATION_POINTS_DEDUPE_UNIQUE_INDEX } from './location-points-policy';
import migrations from '../../drizzle/migrations';

const MIGRATIONS_TABLE = '__drizzle_migrations';

type MigrationJournalEntry = {
  idx: number;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type MigrationBundle = {
  journal: { entries: MigrationJournalEntry[] };
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
      (row: Record<string, unknown>) => String(row.name ?? '') === columnName,
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
    case '0020_standardize_place_radii':
      return (
        columnExists(sqlite, 'trips', 'place_label') ||
        !(await columnExists(sqlite, 'trips', 'place_lookup_cache_id'))
      );
    case '0021_trip_resolved_place':
      return columnExists(sqlite, 'trips', 'place_label');
    case '0022_drop_trip_legacy_place_columns':
      return !(await columnExists(sqlite, 'trips', 'place_lookup_cache_id'));
    case '0023_trip_moment_refs':
      return columnExists(sqlite, 'trips', 'moment_refs');
    case '0024_drop_moment_location_columns':
      return (
        !(await columnExists(sqlite, 'moments', 'lat')) &&
        !(await columnExists(sqlite, 'moments', 'lng')) &&
        !(await columnExists(sqlite, 'moments', 'linked_point_id'))
      );
    case '0025_place_pois':
      return (
        (await tableExists(sqlite, 'place_pois')) &&
        (await columnExists(sqlite, 'trips', 'poi_id')) &&
        (await columnExists(sqlite, 'trips', 'poi_label'))
      );
    default:
      return false;
  }
}

/** Repair columns when the journal is behind the bundled schema. */
export async function ensureTripSegmentMetadataColumns(
  sqlite: DB,
): Promise<void> {
  if (!(await tableExists(sqlite, 'trips'))) {
    return;
  }
  if (!(await columnExists(sqlite, 'trips', 'segment_order'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN segment_order integer DEFAULT 0 NOT NULL`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'place_label'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN place_label text`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'place_id'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN place_id integer`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'place_kind'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN place_kind text`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'inferred'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN inferred integer DEFAULT 0 NOT NULL`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'moment_refs'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN moment_refs text`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'poi_id'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN poi_id integer`,
    );
  }
  if (!(await columnExists(sqlite, 'trips', 'poi_label'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trips ADD COLUMN poi_label text`,
    );
  }
}

export async function ensureTripPointMetadataColumns(
  sqlite: DB,
): Promise<void> {
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
  if (!(await columnExists(sqlite, 'trip_points', 'moment_id'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trip_points ADD COLUMN moment_id integer REFERENCES moments(id)`,
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
  if (
    !(await columnExists(sqlite, 'materialized_days', 'geometry_fingerprint'))
  ) {
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
  const columns: Array<{ name: string; ddl: string }> = [
    { name: 'title', ddl: 'ALTER TABLE moments ADD COLUMN title text' },
    {
      name: 'mood_score',
      ddl: 'ALTER TABLE moments ADD COLUMN mood_score real',
    },
    {
      name: 'mood_label',
      ddl: 'ALTER TABLE moments ADD COLUMN mood_label text',
    },
    {
      name: 'finished_at',
      ddl: 'ALTER TABLE moments ADD COLUMN finished_at integer',
    },
    {
      name: 'content_bytes',
      ddl: 'ALTER TABLE moments ADD COLUMN content_bytes integer',
    },
    {
      name: 'source_bytes',
      ddl: 'ALTER TABLE moments ADD COLUMN source_bytes integer',
    },
    {
      name: 'content_format',
      ddl: 'ALTER TABLE moments ADD COLUMN content_format text',
    },
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

async function tableExistsOn(
  executor: SqlExecutor,
  tableName: string,
): Promise<boolean> {
  const result = await executor.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  return (result.rows?.length ?? 0) > 0;
}

async function columnExistsOn(
  executor: SqlExecutor,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const result = await executor.execute(`PRAGMA table_info("${tableName}")`);
  return (
    result.rows?.some(
      (row: Record<string, unknown>) => String(row.name ?? '') === columnName,
    ) ?? false
  );
}

const MOMENTS_COLUMNS_WITHOUT_LOCATION = [
  'id',
  'type',
  'timestamp',
  'content_path',
  'voice_attachment_path',
  'voice_attachment_bytes',
  'voice_duration_sec',
  'photo_attachments_json',
  'text_body',
  'caption',
  'place_label',
  'title',
  'mood_score',
  'mood_label',
  'finished_at',
  'content_bytes',
  'source_bytes',
  'content_format',
  'share_visibility',
  'content_sync_state',
  'activity_id',
  'activity_emoji',
  'activity_label',
] as const;

/** SQLite cannot DROP COLUMN on `linked_point_id` — rebuild the table instead. */
export async function rebuildMomentsTableWithoutLocationColumns(
  sqlite: SqlExecutor,
): Promise<boolean> {
  if (!(await tableExistsOn(sqlite, 'moments'))) {
    return false;
  }

  const hasLocationColumn =
    (await columnExistsOn(sqlite, 'moments', 'lat')) ||
    (await columnExistsOn(sqlite, 'moments', 'lng')) ||
    (await columnExistsOn(sqlite, 'moments', 'linked_point_id'));
  if (!hasLocationColumn) {
    return false;
  }

  const copyColumns: string[] = [];
  for (const column of MOMENTS_COLUMNS_WITHOUT_LOCATION) {
    if (await columnExistsOn(sqlite, 'moments', column)) {
      copyColumns.push(column);
    }
  }
  if (copyColumns.length === 0) {
    return false;
  }

  const columnList = copyColumns.join(', ');
  await sqlite.execute('PRAGMA foreign_keys=OFF');
  try {
    await sqlite.execute(`DROP TABLE IF EXISTS moments_new`);
    await sqlite.execute(`
      CREATE TABLE moments_new (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        type text NOT NULL,
        timestamp integer NOT NULL,
        content_path text,
        voice_attachment_path text,
        voice_attachment_bytes integer,
        voice_duration_sec integer,
        photo_attachments_json text,
        text_body text,
        caption text,
        place_label text,
        title text,
        mood_score real,
        mood_label text,
        finished_at integer,
        content_bytes integer,
        source_bytes integer,
        content_format text,
        share_visibility text DEFAULT 'private' NOT NULL,
        content_sync_state text DEFAULT 'local_only' NOT NULL,
        activity_id integer,
        activity_emoji text,
        activity_label text
      )
    `);
    await sqlite.execute(
      `INSERT INTO moments_new (${columnList}) SELECT ${columnList} FROM moments`,
    );
    await sqlite.execute(`DROP TABLE moments`);
    await sqlite.execute(`ALTER TABLE moments_new RENAME TO moments`);
    await sqlite.execute(
      `CREATE INDEX IF NOT EXISTS moments_timestamp_idx ON moments (timestamp)`,
    );
    await sqlite.execute(
      `CREATE INDEX IF NOT EXISTS moments_type_timestamp_idx ON moments (type, timestamp)`,
    );
  } finally {
    await sqlite.execute('PRAGMA foreign_keys=ON');
  }

  return true;
}

export async function ensureMomentsWithoutLocationColumns(
  sqlite: DB,
): Promise<void> {
  const rebuilt = await rebuildMomentsTableWithoutLocationColumns(sqlite);
  if (rebuilt) {
    await markMigrationAppliedByTag(
      sqlite,
      '0024_drop_moment_location_columns',
    );
  }
}

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
  )) as { rows?: unknown[] };
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
    (migrationCount.rows?.[0] as { count?: number | string } | undefined)
      ?.count ?? 0,
  );

  if (appliedCount === 0 && (await tableExists(sqlite, 'location_points'))) {
    await bootstrapExistingMigrationJournal(sqlite, prepared);
  }

  const pending = await collectPendingMigrations(sqlite, prepared);
  if (pending.length === 0) {
    return;
  }

  const deferredMomentLocationMigration = pending.find(
    migration => migration.tag === '0024_drop_moment_location_columns',
  );
  const transactionalPending = pending.filter(
    migration => migration.tag !== '0024_drop_moment_location_columns',
  );

  if (transactionalPending.length > 0) {
    await sqlite.transaction(async tx => {
      for (const migration of transactionalPending) {
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

  // Table rebuild toggles PRAGMA foreign_keys — must run outside a transaction.
  if (deferredMomentLocationMigration) {
    await rebuildMomentsTableWithoutLocationColumns(sqlite);
    await recordMigrationIfMissing(deferredMomentLocationMigration, sqlite);
  }
}

/** Create the GPS dedupe unique index when the table has no duplicate rows. */
export async function repairLocationPointsDedupeUniqueIndex(
  sqlite: DB,
): Promise<void> {
  await ensureLocationPointsDedupeUniqueIndex(sqlite);
}
