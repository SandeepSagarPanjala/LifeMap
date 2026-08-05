import type { DB } from '@op-engineering/op-sqlite';

import { getSqlite } from './client';
import {
  CREATE_LOCATION_POINTS_DEDUPE_UNIQUE_INDEX_SQL,
  LOCATION_POINTS_DEDUPE_UNIQUE_INDEX,
} from './location-points-policy';

type SqlExecutor = Pick<DB, 'execute'>;

function readCount(result: { rows?: unknown[] }): number {
  const row = result.rows?.[0] as { count?: number | string } | undefined;
  return Number(row?.count ?? 0);
}

async function indexExists(
  sqlite: SqlExecutor,
  indexName: string,
): Promise<boolean> {
  const result = await sqlite.execute(
    `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`,
    [indexName],
  );
  return (result.rows?.length ?? 0) > 0;
}

export async function countLocationPointDuplicateExtraRows(
  sqlite: SqlExecutor,
): Promise<number> {
  const result = await sqlite.execute(
    `SELECT COALESCE(SUM(group_count - 1), 0) AS count
     FROM (
       SELECT COUNT(*) AS group_count
       FROM location_points
       GROUP BY timestamp, lat, lng
       HAVING group_count > 1
     )`,
  );
  return readCount(result);
}

export async function countLocationPointDuplicateGroups(
  sqlite: SqlExecutor,
): Promise<number> {
  const result = await sqlite.execute(
    `SELECT COUNT(*) AS count
     FROM (
       SELECT 1
       FROM location_points
       GROUP BY timestamp, lat, lng
       HAVING COUNT(*) > 1
     )`,
  );
  return readCount(result);
}

export async function locationPointsDedupeUniqueIndexExists(
  sqlite?: SqlExecutor,
): Promise<boolean> {
  const executor = sqlite ?? (await getSqlite());
  return indexExists(executor, LOCATION_POINTS_DEDUPE_UNIQUE_INDEX);
}

export async function ensureLocationPointsDedupeUniqueIndex(
  sqlite: SqlExecutor,
): Promise<boolean> {
  if (await indexExists(sqlite, LOCATION_POINTS_DEDUPE_UNIQUE_INDEX)) {
    return false;
  }
  if ((await countLocationPointDuplicateExtraRows(sqlite)) > 0) {
    return false;
  }
  await sqlite.execute(CREATE_LOCATION_POINTS_DEDUPE_UNIQUE_INDEX_SQL);
  return true;
}
