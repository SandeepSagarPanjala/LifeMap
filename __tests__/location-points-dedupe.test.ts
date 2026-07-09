import {
  countLocationPointDuplicateExtraRows,
  countLocationPointDuplicateGroups,
  ensureLocationPointsDedupeUniqueIndex,
} from '@/db/location-points-dedupe';
import { LOCATION_POINTS_DEDUPE_UNIQUE_INDEX } from '@/db/location-points-policy';

describe('location_points dedupe maintenance', () => {
  function createSqlite(rows: Array<Record<string, unknown>> = []) {
    const indexes = new Set<string>();
    const triggers = new Set<string>();
    let locationRows = [...rows];

    return {
      execute: jest.fn(async (query: string, params?: unknown[]) => {
        const normalized = query.replace(/\s+/g, ' ').trim();

        if (
          normalized.includes('FROM sqlite_master') &&
          params?.[0] === LOCATION_POINTS_DEDUPE_UNIQUE_INDEX
        ) {
          return {
            rows: indexes.has(LOCATION_POINTS_DEDUPE_UNIQUE_INDEX)
              ? [{ name: LOCATION_POINTS_DEDUPE_UNIQUE_INDEX }]
              : [],
          };
        }
        if (
          normalized.includes('FROM sqlite_master') &&
          params?.[0] === 'location_points_no_delete'
        ) {
          return {
            rows: triggers.has('location_points_no_delete')
              ? [{ name: 'location_points_no_delete' }]
              : [],
          };
        }
        if (
          normalized.startsWith('SELECT COUNT(*) AS count FROM location_points')
        ) {
          return { rows: [{ count: locationRows.length }] };
        }
        if (normalized.includes('HAVING group_count > 1')) {
          const groups = new Map<string, number>();
          for (const row of locationRows) {
            const key = `${row.timestamp}:${row.lat}:${row.lng}`;
            groups.set(key, (groups.get(key) ?? 0) + 1);
          }
          const extras = [...groups.values()]
            .filter(count => count > 1)
            .map(count => count - 1);
          const sum = extras.reduce((total, value) => total + value, 0);
          return { rows: [{ count: sum }] };
        }
        if (normalized.includes('HAVING COUNT(*) > 1')) {
          const groups = new Map<string, number>();
          for (const row of locationRows) {
            const key = `${row.timestamp}:${row.lat}:${row.lng}`;
            groups.set(key, (groups.get(key) ?? 0) + 1);
          }
          const duplicateGroups = [...groups.values()].filter(
            count => count > 1,
          ).length;
          return { rows: [{ count: duplicateGroups }] };
        }
        if (normalized.startsWith('CREATE UNIQUE INDEX')) {
          indexes.add(LOCATION_POINTS_DEDUPE_UNIQUE_INDEX);
          return { rows: [] };
        }
        if (normalized.startsWith('DROP TRIGGER')) {
          triggers.delete('location_points_no_delete');
          return { rows: [] };
        }
        if (normalized.startsWith('CREATE TRIGGER')) {
          triggers.add('location_points_no_delete');
          return { rows: [] };
        }
        if (normalized.startsWith('DELETE FROM location_points')) {
          const keepIds = new Set<number>();
          const groups = new Map<string, number>();
          for (const row of locationRows) {
            const key = `${row.timestamp}:${row.lat}:${row.lng}`;
            const currentMin = groups.get(key);
            const id = Number(row.id);
            if (currentMin == null || id < currentMin) {
              groups.set(key, id);
            }
          }
          for (const id of groups.values()) {
            keepIds.add(id);
          }
          locationRows = locationRows.filter(row =>
            keepIds.has(Number(row.id)),
          );
          return { rows: [] };
        }
        return { rows: [] };
      }),
      transaction: jest.fn(async (callback: (tx: unknown) => Promise<void>) => {
        await callback(createSqlite(rows).execute);
      }),
      _rows: locationRows,
    };
  }

  it('counts duplicate extra rows', async () => {
    const sqlite = createSqlite([
      { id: 1, timestamp: 100, lat: 1, lng: 2 },
      { id: 2, timestamp: 100, lat: 1, lng: 2 },
      { id: 3, timestamp: 200, lat: 3, lng: 4 },
    ]);

    await expect(
      countLocationPointDuplicateExtraRows(sqlite as never),
    ).resolves.toBe(1);
    await expect(
      countLocationPointDuplicateGroups(sqlite as never),
    ).resolves.toBe(1);
  });

  it('creates the unique index when no duplicates remain', async () => {
    const sqlite = createSqlite([
      { id: 1, timestamp: 100, lat: 1, lng: 2 },
      { id: 2, timestamp: 200, lat: 3, lng: 4 },
    ]);

    await expect(
      ensureLocationPointsDedupeUniqueIndex(sqlite as never),
    ).resolves.toBe(true);
    await expect(
      ensureLocationPointsDedupeUniqueIndex(sqlite as never),
    ).resolves.toBe(false);
  });

  it('skips index creation while duplicates remain', async () => {
    const sqlite = createSqlite([
      { id: 1, timestamp: 100, lat: 1, lng: 2 },
      { id: 2, timestamp: 100, lat: 1, lng: 2 },
    ]);

    await expect(
      ensureLocationPointsDedupeUniqueIndex(sqlite as never),
    ).resolves.toBe(false);
  });
});
