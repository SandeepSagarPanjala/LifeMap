import { open } from '@op-engineering/op-sqlite';
import { drizzle } from 'drizzle-orm/op-sqlite';
import { migrate } from 'drizzle-orm/op-sqlite/migrator';
import migrations from '../../drizzle/migrations';
import { getOrCreateDatabaseKey } from './keychain';

export type Database = ReturnType<typeof drizzle>;

let dbPromise: Promise<Database> | null = null;

export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = initDatabase();
  }
  return dbPromise;
}

async function initDatabase(): Promise<Database> {
  const key = await getOrCreateDatabaseKey();

  const sqlite = open({
    name: 'lifemap.db',
    encryptionKey: key,
  });

  const db = drizzle(sqlite);

  // Run migrations idempotently on startup.
  await (migrate as any)(db as any, { migrations } as any);

  return db;
}

