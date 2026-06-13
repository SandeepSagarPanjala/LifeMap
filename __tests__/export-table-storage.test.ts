import {estimateExportTableStorageBytes} from '../src/lib/export-table-storage';

describe('estimateExportTableStorageBytes', () => {
  it('allocates DB bytes proportionally by row count', () => {
    const counts = {
      location_points: 10,
      trips: 0,
      materialized_days: 0,
      materialization_queue: 0,
      tracking_events: 90,
      saved_places: 0,
      place_lookup_cache: 0,
      moments: 0,
      settings: 0,
    };

    const storage = estimateExportTableStorageBytes(counts, 24 * 1024 * 1024);

    expect(storage.location_points).toBe(Math.round(24 * 1024 * 1024 * 0.1));
    expect(storage.tracking_events).toBe(Math.round(24 * 1024 * 1024 * 0.9));
  });

  it('returns zeroes when the database is empty', () => {
    const storage = estimateExportTableStorageBytes(
      {
        location_points: 0,
        trips: 0,
        materialized_days: 0,
        materialization_queue: 0,
        tracking_events: 0,
        saved_places: 0,
        place_lookup_cache: 0,
        moments: 0,
        settings: 0,
      },
      24 * 1024 * 1024,
    );

    expect(storage.tracking_events).toBe(0);
    expect(storage.location_points).toBe(0);
  });
});
