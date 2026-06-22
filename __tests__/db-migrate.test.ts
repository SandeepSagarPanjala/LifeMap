import {
  collectPendingMigrations,
  migrationAlreadyApplied,
  prepareMigrations,
} from '@/db/migrate';

describe('database migrations', () => {
  it('loads bundled sqlite migrations in journal order', () => {
    const prepared = prepareMigrations();
    expect(prepared).toHaveLength(18);
    expect(prepared[0]?.tag).toBe('0000_init');
    expect(prepared[0]?.sql[0]).toContain('CREATE TABLE `location_points`');
    expect(prepared[6]?.tag).toBe('0006_moments_mood');
    expect(prepared[11]?.tag).toBe('0011_drop_materialization_queue');
    expect(prepared[14]?.tag).toBe('0014_materialized_day_geometry');
    expect(prepared[15]?.tag).toBe('0015_saved_place_address');
    expect(prepared[16]?.tag).toBe('0016_moment_voice_duration');
    expect(prepared[17]?.tag).toBe('0017_activities');
  });

  it('detects whether a migration is already applied', async () => {
    const prepared = prepareMigrations();
    const sqlite = {
      execute: jest.fn(async (query: string, params?: unknown[]) => {
        if (
          query.includes('sqlite_master') &&
          params?.[0] === 'location_points'
        ) {
          return {rows: [{name: 'location_points'}]};
        }
        if (query.includes('PRAGMA table_info')) {
          return {rows: []};
        }
        return {rows: []};
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
          return {rows: [{name: 'location_points'}]};
        }
        if (
          query.includes('sqlite_master') &&
          params?.[0] === 'tracking_events'
        ) {
          return {rows: [{name: 'tracking_events'}]};
        }
        if (query.includes('sqlite_master') && params?.[0] === 'trips') {
          return {rows: [{name: 'trips'}]};
        }
        if (
          query.includes('sqlite_master') &&
          params?.[0] === 'materialized_days'
        ) {
          return {rows: [{name: 'materialized_days'}]};
        }
        if (query.includes('PRAGMA table_info')) {
          return {rows: []};
        }
        return {rows: []};
      }),
    };

    const pending = await collectPendingMigrations(sqlite as never, prepared);
    const tags = pending.map(migration => migration.tag);

    expect(tags).toContain('0003_saved_places');
    expect(tags).toContain('0004_place_lookup_cache');
    expect(tags).not.toContain('0000_init');
    expect(tags).not.toContain('0005_trips_materialization');
  });
});
