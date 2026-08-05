import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import {
  runMigrations,
  ensureActivityDefinitionColumns,
  ensureActivityReminderColumns,
  ensureHealthKitTables,
  ensureMaterializedDayGeometryColumn,
  ensureMaterializedDayExcludedDriveColumn,
  ensureMomentThumbnailPathColumn,
  ensureMomentTagsJsonColumn,
  ensureMomentsMoodColumns,
  ensureMomentsWithoutLocationColumns,
  repairLocationPointsDedupeUniqueIndex,
  ensureTripPointMetadataColumns,
  ensureTripSegmentMetadataColumns,
  ensureVisitLabelOverrideAnchorColumns,
} from './migrate';
import { getOrCreateDatabaseKey } from './keychain';
import { ensureAppStartDateAtDatabaseInit } from '@/lib/history-calendar-bounds';

export type Database = ReturnType<typeof drizzle>;

let initPromise: Promise<{ db: Database; sqlite: DB }> | null = null;

function getInitPromise(): Promise<{ db: Database; sqlite: DB }> {
  if (!initPromise) {
    initPromise = initDatabase().catch(error => {
      initPromise = null;
      throw error;
    });
  }
  return initPromise;
}

export function getDatabase(): Promise<Database> {
  return getInitPromise().then(({ db }) => db);
}

export function getSqlite(): Promise<DB> {
  return getInitPromise().then(({ sqlite }) => sqlite);
}

/** Reset singleton for tests only. */
export function resetDatabaseClientForTests(): void {
  initPromise = null;
}

async function tableExists(sqlite: DB, tableName: string): Promise<boolean> {
  const result = await sqlite.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`,
    [tableName],
  );
  return (result.rows?.length ?? 0) > 0;
}

async function initDatabase(): Promise<{ db: Database; sqlite: DB }> {
  const key = await getOrCreateDatabaseKey();

  const sqlite = open({
    name: 'lifemap.db',
    encryptionKey: key,
  });

  await sqlite.execute('PRAGMA busy_timeout = 5000');

  const db = drizzle(sqlite);

  // Before migrations: empty file has no app tables yet → true install.
  const virginDatabase = !(await tableExists(sqlite, 'location_points'));

  await runMigrations(sqlite);
  await ensureTripSegmentMetadataColumns(sqlite);
  await ensureTripPointMetadataColumns(sqlite);
  await ensureMomentsMoodColumns(sqlite);
  await ensureMomentsWithoutLocationColumns(sqlite);
  await ensureMomentThumbnailPathColumn(sqlite);
  await ensureMomentTagsJsonColumn(sqlite);
  await ensureActivityDefinitionColumns(sqlite);
  await ensureActivityReminderColumns(sqlite);
  await ensureHealthKitTables(sqlite);
  await ensureMaterializedDayGeometryColumn(sqlite);
  await ensureMaterializedDayExcludedDriveColumn(sqlite);
  await ensureVisitLabelOverrideAnchorColumns(sqlite);
  await repairLocationPointsDedupeUniqueIndex(sqlite);

  // Stamp calendar floor when the DB is first created (not on later cold starts).
  await ensureAppStartDateAtDatabaseInit(db, { virginDatabase });

  return { db, sqlite };
}
