import { computeDatabaseFileStats } from '../src/lib/database-file-stats';

describe('computeDatabaseFileStats', () => {
  it('separates used and free pages in the database file', () => {
    const stats = computeDatabaseFileStats(1000, 4096, 800);

    expect(stats.totalBytes).toBe(4_096_000);
    expect(stats.freeBytes).toBe(3_276_800);
    expect(stats.usedBytes).toBe(819_200);
  });
});
