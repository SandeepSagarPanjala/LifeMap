import type { DB } from '@op-engineering/op-sqlite';

import { getSqlite } from './client';
import {
  CREATE_LOCATION_POINTS_DEDUPE_UNIQUE_INDEX_SQL,
  CREATE_LOCATION_POINTS_NO_DELETE_TRIGGER_SQL,
  LOCATION_POINTS_DEDUPE_UNIQUE_INDEX,
  LOCATION_POINTS_NO_DELETE_TRIGGER,
} from './location-points-policy';

export type LocationPointDuplicateStats = {
  totalRows: number;
  duplicateGroups: number;
  extraRows: number;
  hasUniqueIndex: boolean;
  hasNoDeleteTrigger: boolean;
};

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

async function triggerExists(
  sqlite: SqlExecutor,
  triggerName: string,
): Promise<boolean> {
  const result = await sqlite.execute(
    `SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = ?`,
    [triggerName],
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

export async function getLocationPointDuplicateStats(): Promise<LocationPointDuplicateStats> {
  const sqlite = await getSqlite();
  const [
    totalResult,
    extraRows,
    duplicateGroups,
    hasUniqueIndex,
    hasNoDeleteTrigger,
  ] = await Promise.all([
    sqlite.execute(`SELECT COUNT(*) AS count FROM location_points`),
    countLocationPointDuplicateExtraRows(sqlite),
    countLocationPointDuplicateGroups(sqlite),
    indexExists(sqlite, LOCATION_POINTS_DEDUPE_UNIQUE_INDEX),
    triggerExists(sqlite, LOCATION_POINTS_NO_DELETE_TRIGGER),
  ]);

  return {
    totalRows: readCount(totalResult),
    duplicateGroups,
    extraRows,
    hasUniqueIndex,
    hasNoDeleteTrigger,
  };
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

export async function deleteLocationPointDuplicatesAndCreateUniqueIndex(): Promise<{
  deletedRows: number;
  indexCreated: boolean;
}> {
  const sqlite = await getSqlite();
  const extraRows = await countLocationPointDuplicateExtraRows(sqlite);
  const hadTrigger = await triggerExists(
    sqlite,
    LOCATION_POINTS_NO_DELETE_TRIGGER,
  );
  let deletedRows = 0;
  let indexCreated = false;

  await sqlite.transaction(async tx => {
    if (hadTrigger) {
      await tx.execute(
        `DROP TRIGGER IF EXISTS ${LOCATION_POINTS_NO_DELETE_TRIGGER}`,
      );
    }

    if (extraRows > 0) {
      const before = readCount(
        await tx.execute(`SELECT COUNT(*) AS count FROM location_points`),
      );
      await tx.execute(
        `DELETE FROM location_points
         WHERE id NOT IN (
           SELECT MIN(id) FROM location_points GROUP BY timestamp, lat, lng
         )`,
      );
      const after = readCount(
        await tx.execute(`SELECT COUNT(*) AS count FROM location_points`),
      );
      deletedRows = before - after;
    }

    if (!(await indexExists(tx, LOCATION_POINTS_DEDUPE_UNIQUE_INDEX))) {
      await tx.execute(CREATE_LOCATION_POINTS_DEDUPE_UNIQUE_INDEX_SQL);
      indexCreated = true;
    }

    if (hadTrigger) {
      await tx.execute(CREATE_LOCATION_POINTS_NO_DELETE_TRIGGER_SQL);
    }
  });

  return { deletedRows, indexCreated };
}
