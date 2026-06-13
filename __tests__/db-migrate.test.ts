import {migrationAlreadyApplied, prepareMigrations} from '@/db/migrate';

describe('database migrations', () => {
  it('loads bundled sqlite migrations in journal order', () => {
    const prepared = prepareMigrations();
    expect(prepared).toHaveLength(7);
    expect(prepared[0]?.tag).toBe('0000_init');
    expect(prepared[0]?.sql[0]).toContain('CREATE TABLE `location_points`');
    expect(prepared[6]?.tag).toBe('0006_moments_mood');
  });

  it('detects whether a migration is already applied', async () => {
    const prepared = prepareMigrations();
    const sqlite = {
      executeAsync: jest.fn(async (query: string, params?: unknown[]) => {
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
});
