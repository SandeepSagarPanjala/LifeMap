import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import {
  runMigrations,
  ensureMaterializedDayGeometryColumn,
  ensureMomentsMoodColumns,
  ensureTripPointMetadataColumns,
  ensureTripSegmentMetadataColumns,
} from './migrate';
import { getOrCreateDatabaseKey } from './keychain';

export type Database = ReturnType<typeof drizzle>;

let initPromise: Promise<{db: Database; sqlite: DB}> | null = null;

function getInitPromise(): Promise<{db: Database; sqlite: DB}> {
  if (!initPromise) {
    initPromise = initDatabase();
  }
  return initPromise;
}

export function getDatabase(): Promise<Database> {
  return getInitPromise().then(({db}) => db);
}

export function getSqlite(): Promise<DB> {
  return getInitPromise().then(({sqlite}) => sqlite);
}

/** Reset singleton for tests only. */
export function resetDatabaseClientForTests(): void {
  initPromise = null;
}

async function initDatabase(): Promise<{ db: Database; sqlite: DB }> {
  const key = await getOrCreateDatabaseKey();

  const sqlite = open({
    name: 'lifemap.db',
    encryptionKey: key,
  });

  await sqlite.execute('PRAGMA busy_timeout = 5000');

  const db = drizzle(sqlite);

  await runMigrations(sqlite);
  await ensureTripSegmentMetadataColumns(sqlite);
  await ensureTripPointMetadataColumns(sqlite);
  await ensureMomentsMoodColumns(sqlite);
  await ensureMaterializedDayGeometryColumn(sqlite);

  return { db, sqlite };
}

