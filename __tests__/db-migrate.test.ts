import {
  collectPendingMigrations,
  migrationAlreadyApplied,
  prepareMigrations,
  rebuildMomentsTableWithoutLocationColumns,
} from '@/db/migrate';

describe('database migrations', () => {
  it('loads bundled sqlite migrations in journal order', () => {
    const prepared = prepareMigrations();
    expect(prepared).toHaveLength(31);
    expect(prepared[0]?.tag).toBe('0000_init');
    expect(prepared[0]?.sql[0]).toContain('CREATE TABLE `location_points`');
    expect(prepared[6]?.tag).toBe('0006_moments_mood');
    expect(prepared[11]?.tag).toBe('0011_drop_materialization_queue');
    expect(prepared[14]?.tag).toBe('0014_materialized_day_geometry');
    expect(prepared[15]?.tag).toBe('0015_saved_place_address');
    expect(prepared[16]?.tag).toBe('0016_moment_voice_duration');
    expect(prepared[17]?.tag).toBe('0017_activities');
    expect(prepared[18]?.tag).toBe('0018_saved_places_active');
    expect(prepared[19]?.tag).toBe('0019_location_points_dedupe_unique');
    expect(prepared[20]?.tag).toBe('0020_standardize_place_radii');
    expect(prepared[21]?.tag).toBe('0021_trip_resolved_place');
    expect(prepared[22]?.tag).toBe('0022_drop_trip_legacy_place_columns');
    expect(prepared[23]?.tag).toBe('0023_trip_moment_refs');
    expect(prepared[24]?.tag).toBe('0024_drop_moment_location_columns');
    expect(prepared[25]?.tag).toBe('0025_place_pois');
    expect(prepared[26]?.tag).toBe('0026_materialized_day_excluded_drive');
    expect(prepared[26]?.sql[0]).toContain(
      'excluded_cross_midnight_from_ms',
    );
    expect(prepared[27]?.tag).toBe('0027_location_day_summaries');
    expect(prepared[27]?.sql[0]).toContain('location_day_summaries');
    expect(prepared[28]?.tag).toBe('0028_place_pois_category');
    expect(prepared[28]?.sql[0]).toContain('category');
    expect(prepared[29]?.tag).toBe('0029_drop_trip_poi_label');
    expect(prepared[29]?.sql[0]).toContain('poi_label');
    expect(prepared[30]?.tag).toBe('0030_visit_label_overrides');
    expect(prepared[30]?.sql[0]).toContain('visit_label_overrides');
  });

  it('detects whether a migration is already applied', async () => {
    const prepared = prepareMigrations();
    const sqlite = {
      execute: jest.fn(async (query: string, params?: unknown[]) => {
        if (
          query.includes('sqlite_master') &&
          params?.[0] === 'location_points'
        ) {
          return { rows: [{ name: 'location_points' }] };
        }
        if (query.includes('PRAGMA table_info')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };

    await expect(
      migrationAlreadyApplied(sqlite as never, prepared[0]!),
    ).resolves.toBe(true);
    await expect(
      migrationAlreadyApplied(sqlite as never, prepared[6]!),
    ).resolves.toBe(false);
  });

  it('queues skipped earlier migrations after journal bootstrap drift', async () => {
    const prepared = prepareMigrations();
    const sqlite = {
      execute: jest.fn(async (query: string, params?: unknown[]) => {
        if (
          query.includes('sqlite_master') &&
          params?.[0] === 'location_points'
        ) {
          return { rows: [{ name: 'location_points' }] };
        }
        if (
          query.includes('sqlite_master') &&
          params?.[0] === 'tracking_events'
        ) {
          return { rows: [{ name: 'tracking_events' }] };
        }
        if (query.includes('sqlite_master') && params?.[0] === 'trips') {
          return { rows: [{ name: 'trips' }] };
        }
        if (
          query.includes('sqlite_master') &&
          params?.[0] === 'materialized_days'
        ) {
          return { rows: [{ name: 'materialized_days' }] };
        }
        if (query.includes('PRAGMA table_info')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    };

    const pending = await collectPendingMigrations(sqlite as never, prepared);
    const tags = pending.map(migration => migration.tag);

    expect(tags).toContain('0003_saved_places');
    expect(tags).toContain('0004_place_lookup_cache');
    expect(tags).not.toContain('0000_init');
    expect(tags).not.toContain('0005_trips_materialization');
  });

  it('rebuilds moments without location columns when legacy FK column remains', async () => {
    const sqlite = {
      execute: jest.fn(async (query: string, params?: unknown[]) => {
        if (
          query.includes('sqlite_master') &&
          query.includes("type = 'table'") &&
          params?.[0] === 'moments'
        ) {
          return { rows: [{ name: 'moments' }] };
        }
        if (query.includes('PRAGMA table_info("moments")')) {
          const columns = [
            'id',
            'type',
            'timestamp',
            'lat',
            'lng',
            'linked_point_id',
            'share_visibility',
            'content_sync_state',
          ].map(name => ({ name }));
          return { rows: columns };
        }
        return { rows: [] };
      }),
    };

    const rebuilt = await rebuildMomentsTableWithoutLocationColumns(
      sqlite as never,
    );
    expect(rebuilt).toBe(true);
    expect(sqlite.execute).toHaveBeenCalledWith(
      expect.stringContaining('CREATE TABLE moments_new'),
    );
    expect(sqlite.execute).toHaveBeenCalledWith('PRAGMA foreign_keys=OFF');
    expect(sqlite.execute).toHaveBeenCalledWith('PRAGMA foreign_keys=ON');
  });
});
