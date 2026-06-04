import {getTodayDateKey} from '@/lib/day-utils';

import {getSqlite} from '../client';
import {countLocationPoints} from './location-points';
import {getLocationPointsForDay} from './location-days';

export type DatabaseStorageStats = {
  totalBytes: number;
  todayBytesEstimate: number;
  totalLocationRows: number;
  todayLocationRows: number;
};

function pragmaNumber(
  rows: Array<Record<string, unknown>>,
  key: string,
): number {
  const raw = rows[0]?.[key];
  return typeof raw === 'number' ? raw : Number(raw ?? 0);
}

export async function getDatabaseStorageStats(): Promise<DatabaseStorageStats> {
  const sqlite = await getSqlite();
  const [pageCountResult, pageSizeResult, totalLocationRows, todayPoints] =
    await Promise.all([
      sqlite.execute('PRAGMA page_count'),
      sqlite.execute('PRAGMA page_size'),
      countLocationPoints(),
      getLocationPointsForDay(getTodayDateKey()),
    ]);

  const pageCount = pragmaNumber(pageCountResult.rows, 'page_count');
  const pageSize = pragmaNumber(pageSizeResult.rows, 'page_size');
  const totalBytes = pageCount * pageSize;
  const todayLocationRows = todayPoints.length;
  const todayBytesEstimate =
    totalLocationRows > 0
      ? Math.round(totalBytes * (todayLocationRows / totalLocationRows))
      : 0;

  return {
    totalBytes,
    todayBytesEstimate,
    totalLocationRows,
    todayLocationRows,
  };
}
