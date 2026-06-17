import { open, type DB } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';

import {
  runMigrations,
  ensureTripPointMetadataColumns,
  ensureTripSegmentMetadataColumns,
} from './migrate';
import { getOrCreateDatabaseKey } from './keychain';

export type Database = ReturnType<typeof drizzle>;

let dbPromise: Promise<Database> | null = null;
let sqlitePromise: Promise<DB> | null = null;

export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = initDatabase().then(({ db }) => db);
  }
  return dbPromise;
}

export function getSqlite(): Promise<DB> {
  if (!sqlitePromise) {
    sqlitePromise = initDatabase().then(({ sqlite }) => sqlite);
  }
  return sqlitePromise;
}

async function initDatabase(): Promise<{ db: Database; sqlite: DB }> {
  const key = await getOrCreateDatabaseKey();

  const sqlite = open({
    name: 'lifemap.db',
    encryptionKey: key,
  });

  const db = drizzle(sqlite);

  await runMigrations(sqlite);
  await ensureTripSegmentMetadataColumns(sqlite);
  await ensureTripPointMetadataColumns(sqlite);

  return { db, sqlite };
}

