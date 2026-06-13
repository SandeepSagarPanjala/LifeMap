import {
  buildDatabaseExportJson,
  buildSingleTableExportJson,
  databaseExportFileLabel,
  sumExportTableRowCounts,
} from '../src/lib/database-export';
import {resolveExportPeriod} from '../src/lib/export-period';

describe('export period', () => {
  it('resolves today and day scopes with date keys', () => {
    const today = resolveExportPeriod('today');
    expect(today.dateKey).toBeDefined();
    expect(today.startAt.getTime()).toBeLessThan(today.endAt.getTime());

    const day = resolveExportPeriod('day', '2026-06-06');
    expect(day.dateKey).toBe('2026-06-06');
  });

  it('resolves all scope with wide bounds', () => {
    const all = resolveExportPeriod('all');
    expect(all.startAt.getTime()).toBe(0);
    expect(all.endAt.getUTCFullYear()).toBe(2100);
  });
});

describe('database export', () => {
  it('builds JSON payload with table row counts', () => {
    const period = resolveExportPeriod('day', '2026-06-06');
    const tables = {
      location_points: [{id: 1}],
      trips: [],
      materialized_days: [],
      materialization_queue: [],
      tracking_events: [],
      saved_places: [{id: 1}],
      place_lookup_cache: [],
      moments: [],
      settings: [{key: 'distance_unit', value: 'mi'}],
    };

    const payload = JSON.parse(buildDatabaseExportJson(period, tables));

    expect(payload.scope).toBe('day');
    expect(payload.dateKey).toBe('2026-06-06');
    expect(payload.rowCounts.location_points).toBe(1);
    expect(payload.rowCounts.settings).toBe(1);
    expect(payload.tables.location_points).toHaveLength(1);
  });

  it('builds export file labels', () => {
    const period = resolveExportPeriod('day', '2026-06-06');
    expect(databaseExportFileLabel(period)).toBe(
      'lifemap-database-2026-06-06.json',
    );
    expect(databaseExportFileLabel(period, 'location_points')).toBe(
      'lifemap-database-location_points-2026-06-06.json',
    );
    expect(databaseExportFileLabel(resolveExportPeriod('all'))).toBe(
      'lifemap-database-all.json',
    );
  });

  it('builds single-table JSON and sums row counts', () => {
    const period = resolveExportPeriod('day', '2026-06-06');
    const payload = JSON.parse(
      buildSingleTableExportJson('trips', period, [{id: 1}]),
    );
    expect(payload.rowCounts.trips).toBe(1);
    expect(payload.rowCounts.location_points).toBe(0);
    expect(payload.tables.trips).toHaveLength(1);

    expect(
      sumExportTableRowCounts({
        location_points: 10,
        trips: 2,
        materialized_days: 1,
        materialization_queue: 0,
        tracking_events: 3,
        saved_places: 1,
        place_lookup_cache: 4,
        moments: 5,
        settings: 2,
      }),
    ).toBe(28);
  });
});
