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
        (await columnExists(sqlite, 'trips', 'poi_id'))
      );
    case '0026_materialized_day_excluded_drive':
      return columnExists(
        sqlite,
        'materialized_days',
        'excluded_cross_midnight_from_ms',
      );
    case '0028_place_pois_category':
      return columnExists(sqlite, 'place_pois', 'category');
    case '0029_drop_trip_poi_label':
      return !(await columnExists(sqlite, 'trips', 'poi_label'));
    case '0030_visit_label_overrides':
      return tableExists(sqlite, 'visit_label_overrides');
    case '0031_location_points_sdk_extras':
      return columnExists(sqlite, 'location_points', 'activity_type');
    case '0032_trip_points_activity':
      return columnExists(sqlite, 'trip_points', 'activity_type');
    case '0033_visit_label_override_anchor':
      return columnExists(sqlite, 'visit_label_overrides', 'anchor_lat');
    case '0034_moment_thumbnail_path':
      return columnExists(sqlite, 'moments', 'thumbnail_path');
    case '0035_moment_tags_json':
      return columnExists(sqlite, 'moments', 'tags_json');
    case '0036_activity_definitions':
      return (
        (await columnExists(sqlite, 'activities', 'definition_json')) &&
        (await columnExists(sqlite, 'moments', 'activity_values_json'))
      );
    case '0037_moment_mood_reason_variant':
      return (
        (await columnExists(sqlite, 'moments', 'mood_reason')) &&
        (await columnExists(sqlite, 'moments', 'mood_variant'))
      );
    case '0038_moment_type_mood_voice_transcript':
      return columnExists(sqlite, 'moments', 'voice_transcript');
    case '0039_activity_reminders':
      return columnExists(sqlite, 'activities', 'reminder_enabled');
    case '0042_activity_intent':
      return columnExists(sqlite, 'activities', 'intent');
    case '0043_moments_activity_id_idx':
      return indexExists(sqlite, 'moments_activity_id_idx');
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
  if (!(await columnExists(sqlite, 'trip_points', 'activity_type'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE trip_points ADD COLUMN activity_type text`,
    );
  }
}

/** Repair materialized_days excluded-drive column when migration 0026 was skipped. */
export async function ensureMaterializedDayExcludedDriveColumn(
  sqlite: DB,
): Promise<void> {
  if (!(await tableExists(sqlite, 'materialized_days'))) {
    return;
  }
  if (
    !(await columnExists(
      sqlite,
      'materialized_days',
      'excluded_cross_midnight_from_ms',
    ))
  ) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE materialized_days ADD COLUMN excluded_cross_midnight_from_ms integer`,
    );
  }
}

/** Repair moments.thumbnail_path when migration 0034 was skipped. */
export async function ensureMomentThumbnailPathColumn(
  sqlite: DB,
): Promise<void> {
  if (!(await tableExists(sqlite, 'moments'))) {
    return;
  }
  if (!(await columnExists(sqlite, 'moments', 'thumbnail_path'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE moments ADD COLUMN thumbnail_path text`,
    );
  }
}

/** Repair moments.tags_json when migration 0035 was skipped. */
export async function ensureMomentTagsJsonColumn(sqlite: DB): Promise<void> {
  if (!(await tableExists(sqlite, 'moments'))) {
    return;
  }
  if (!(await columnExists(sqlite, 'moments', 'tags_json'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE moments ADD COLUMN tags_json text`,
    );
  }
}

/** Repair activity definition columns when migration 0036 was skipped. */
export async function ensureActivityDefinitionColumns(
  sqlite: DB,
): Promise<void> {
  if (await tableExists(sqlite, 'activities')) {
    if (!(await columnExists(sqlite, 'activities', 'schema_version'))) {
      await executeMigrationStatement(
        sqlite,
        `ALTER TABLE activities ADD COLUMN schema_version integer DEFAULT 1 NOT NULL`,
      );
    }
    if (!(await columnExists(sqlite, 'activities', 'source'))) {
      await executeMigrationStatement(
        sqlite,
        `ALTER TABLE activities ADD COLUMN source text DEFAULT 'blank' NOT NULL`,
      );
    }
    if (!(await columnExists(sqlite, 'activities', 'template_id'))) {
      await executeMigrationStatement(
        sqlite,
        `ALTER TABLE activities ADD COLUMN template_id text`,
      );
    }
    if (!(await columnExists(sqlite, 'activities', 'definition_json'))) {
      await executeMigrationStatement(
        sqlite,
        `ALTER TABLE activities ADD COLUMN definition_json text DEFAULT '[]' NOT NULL`,
      );
    }
  }
  if (await tableExists(sqlite, 'moments')) {
    if (!(await columnExists(sqlite, 'moments', 'activity_values_json'))) {
      await executeMigrationStatement(
        sqlite,
        `ALTER TABLE moments ADD COLUMN activity_values_json text`,
      );
    }
  }
}

/** Repair activity reminder columns when migration 0039 was skipped. */
export async function ensureActivityReminderColumns(
  sqlite: DB,
): Promise<void> {
  if (!(await tableExists(sqlite, 'activities'))) {
    return;
  }
  if (!(await columnExists(sqlite, 'activities', 'reminder_enabled'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE activities ADD COLUMN reminder_enabled integer DEFAULT 0 NOT NULL`,
    );
  }
  if (!(await columnExists(sqlite, 'activities', 'reminder_repeat'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE activities ADD COLUMN reminder_repeat text DEFAULT 'never' NOT NULL`,
    );
  }
  if (!(await columnExists(sqlite, 'activities', 'reminder_time_minutes'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE activities ADD COLUMN reminder_time_minutes integer`,
    );
  }
  if (!(await columnExists(sqlite, 'activities', 'reminder_weekday'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE activities ADD COLUMN reminder_weekday integer`,
    );
  }
  if (!(await columnExists(sqlite, 'activities', 'reminder_day_of_month'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE activities ADD COLUMN reminder_day_of_month integer`,
    );
  }
  if (!(await columnExists(sqlite, 'activities', 'reminder_anchor_at'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE activities ADD COLUMN reminder_anchor_at integer`,
    );
  }
  if (!(await columnExists(sqlite, 'activities', 'reminder_sound'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE activities ADD COLUMN reminder_sound text DEFAULT 'ding' NOT NULL`,
    );
  }
  if (!(await columnExists(sqlite, 'activities', 'intent'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE activities ADD COLUMN intent text DEFAULT 'track' NOT NULL`,
    );
  }
}

/** Repair HealthKit tables / moment import_source when migration 0040 was skipped. */
export async function ensureHealthKitTables(sqlite: DB): Promise<void> {
  if (!(await tableExists(sqlite, 'health_sleep_sessions'))) {
    await executeMigrationStatement(
      sqlite,
      `CREATE TABLE IF NOT EXISTS health_sleep_sessions (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        uuid text NOT NULL,
        start_at integer NOT NULL,
        end_at integer NOT NULL,
        source_name text,
        synced_at integer NOT NULL
      )`,
    );
    await executeMigrationStatement(
      sqlite,
      `CREATE UNIQUE INDEX IF NOT EXISTS health_sleep_sessions_uuid_unique ON health_sleep_sessions (uuid)`,
    );
    await executeMigrationStatement(
      sqlite,
      `CREATE INDEX IF NOT EXISTS health_sleep_sessions_start_end_idx ON health_sleep_sessions (start_at, end_at)`,
    );
  }
  if (!(await tableExists(sqlite, 'health_workouts'))) {
    await executeMigrationStatement(
      sqlite,
      `CREATE TABLE IF NOT EXISTS health_workouts (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        uuid text NOT NULL,
        activity_type integer NOT NULL,
        activity_label text NOT NULL,
        start_at integer NOT NULL,
        end_at integer NOT NULL,
        duration_sec integer NOT NULL,
        distance_m real,
        linked_moment_id integer,
        synced_at integer NOT NULL,
        FOREIGN KEY (linked_moment_id) REFERENCES moments(id) ON UPDATE no action ON DELETE set null
      )`,
    );
    await executeMigrationStatement(
      sqlite,
      `CREATE UNIQUE INDEX IF NOT EXISTS health_workouts_uuid_unique ON health_workouts (uuid)`,
    );
    await executeMigrationStatement(
      sqlite,
      `CREATE INDEX IF NOT EXISTS health_workouts_start_end_idx ON health_workouts (start_at, end_at)`,
    );
  }
  if (!(await tableExists(sqlite, 'health_day_steps'))) {
    await executeMigrationStatement(
      sqlite,
      `CREATE TABLE IF NOT EXISTS health_day_steps (
        date_key text PRIMARY KEY NOT NULL,
        steps integer NOT NULL,
        synced_at integer NOT NULL
      )`,
    );
  }
  if (!(await tableExists(sqlite, 'health_sleep_samples'))) {
    await executeMigrationStatement(
      sqlite,
      `CREATE TABLE IF NOT EXISTS health_sleep_samples (
        id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        uuid text NOT NULL,
        start_at integer NOT NULL,
        end_at integer NOT NULL,
        value integer NOT NULL,
        synced_at integer NOT NULL
      )`,
    );
    await executeMigrationStatement(
      sqlite,
      `CREATE UNIQUE INDEX IF NOT EXISTS health_sleep_samples_uuid_unique ON health_sleep_samples (uuid)`,
    );
    await executeMigrationStatement(
      sqlite,
      `CREATE INDEX IF NOT EXISTS health_sleep_samples_start_end_idx ON health_sleep_samples (start_at, end_at)`,
    );
  }
  if (!(await tableExists(sqlite, 'health_day_sleep'))) {
    await executeMigrationStatement(
      sqlite,
      `CREATE TABLE IF NOT EXISTS health_day_sleep (
        date_key text PRIMARY KEY NOT NULL,
        asleep_ms integer NOT NULL,
        awake_ms integer NOT NULL,
        rem_ms integer NOT NULL,
        core_ms integer NOT NULL,
        deep_ms integer NOT NULL,
        unspecified_ms integer NOT NULL,
        awakenings_over_5_min integer DEFAULT 0 NOT NULL,
        sleep_start_at integer,
        sleep_end_at integer,
        score integer,
        synced_at integer NOT NULL
      )`,
    );
  }
  if (
    (await tableExists(sqlite, 'health_day_sleep')) &&
    !(await columnExists(sqlite, 'health_day_sleep', 'awakenings_over_5_min'))
  ) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE health_day_sleep ADD COLUMN awakenings_over_5_min integer DEFAULT 0`,
    );
  }
  if (
    (await tableExists(sqlite, 'moments')) &&
    !(await columnExists(sqlite, 'moments', 'import_source'))
  ) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE moments ADD COLUMN import_source text`,
    );
  }
}

/** Repair visit_label_overrides anchor columns when migration 0033 was skipped. */
export async function ensureVisitLabelOverrideAnchorColumns(
  sqlite: DB,
): Promise<void> {
  if (!(await tableExists(sqlite, 'visit_label_overrides'))) {
    return;
  }
  if (!(await columnExists(sqlite, 'visit_label_overrides', 'end_at_ms'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE visit_label_overrides ADD COLUMN end_at_ms integer`,
    );
  }
  if (!(await columnExists(sqlite, 'visit_label_overrides', 'anchor_lat'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE visit_label_overrides ADD COLUMN anchor_lat real`,
    );
  }
  if (!(await columnExists(sqlite, 'visit_label_overrides', 'anchor_lng'))) {
    await executeMigrationStatement(
      sqlite,
      `ALTER TABLE visit_label_overrides ADD COLUMN anchor_lng real`,
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
    {
      name: 'mood_reason',
      ddl: 'ALTER TABLE moments ADD COLUMN mood_reason text',
    },
    {
      name: 'mood_variant',
      ddl: 'ALTER TABLE moments ADD COLUMN mood_variant text',
    },
    {
      name: 'voice_transcript',
      ddl: 'ALTER TABLE moments ADD COLUMN voice_transcript text',
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
  'thumbnail_path',
  'voice_attachment_path',
  'voice_attachment_bytes',
  'voice_duration_sec',
  'voice_transcript',
  'photo_attachments_json',
  'tags_json',
  'text_body',
  'caption',
  'place_label',
  'title',
  'mood_score',
  'mood_label',
  'mood_reason',
  'mood_variant',
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
        thumbnail_path text,
        voice_attachment_path text,
        voice_attachment_bytes integer,
        voice_duration_sec integer,
        photo_attachments_json text,
        tags_json text,
        text_body text,
        caption text,
        place_label text,
        title text,
        mood_score real,
        mood_label text,
        mood_reason text,
        mood_variant text,
        voice_transcript text,
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
    await sqlite.execute(
      `CREATE INDEX IF NOT EXISTS moments_activity_id_idx ON moments (activity_id)`,
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
