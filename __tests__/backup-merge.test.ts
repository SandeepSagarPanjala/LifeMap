import { detectRestoreConflicts } from '../src/lib/backup/backup-conflicts';

describe('backup merge conflicts', () => {
  it('finds no conflicts when backup and local cover different times', () => {
    const conflicts = detectRestoreConflicts({
      backupTables: {
        activities: [],
        location_points: [
          {
            id: 1,
            timestamp: '2026-06-01T13:00:00.000Z',
            lat: 12.9,
            lng: 77.6,
            source: 'gps',
          },
        ],
        saved_places: [],
        place_lookup_cache: [],
        moments: [],
        settings: [],
        trips: [],
      },
      localLocationPoints: [
        {
          timestamp: new Date('2026-06-04T17:00:00.000Z'),
          lat: 12.91,
          lng: 77.61,
          source: 'gps',
          accuracy: 10,
        },
      ],
      localMoments: [],
      localSettings: [],
    });

    expect(conflicts).toHaveLength(0);
  });

  it('flags overlapping location points with different sources', () => {
    const conflicts = detectRestoreConflicts({
      backupTables: {
        activities: [],
        location_points: [
          {
            id: 1,
            timestamp: '2026-06-01T17:00:00.000Z',
            lat: 12.9,
            lng: 77.6,
            source: 'gps',
          },
        ],
        saved_places: [],
        place_lookup_cache: [],
        moments: [],
        settings: [],
        trips: [],
      },
      localLocationPoints: [
        {
          timestamp: new Date('2026-06-01T17:00:00.000Z'),
          lat: 12.9,
          lng: 77.6,
          source: 'motion',
          accuracy: 10,
        },
      ],
      localMoments: [],
      localSettings: [],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.kind).toBe('location_point');
    expect(conflicts[0]?.id).toBe('location_point:bulk');
  });

  it('dedupes duplicate backup rows into one GPS overlap summary', () => {
    const conflicts = detectRestoreConflicts({
      backupTables: {
        activities: [],
        location_points: [
          {
            id: 1,
            timestamp: '2026-06-01T17:00:00.000Z',
            lat: 12.9,
            lng: 77.6,
            source: 'gps',
          },
          {
            id: 2,
            timestamp: '2026-06-01T17:00:00.000Z',
            lat: 12.9,
            lng: 77.6,
            source: 'motion',
          },
        ],
        saved_places: [],
        place_lookup_cache: [],
        moments: [],
        settings: [],
        trips: [],
      },
      localLocationPoints: [
        {
          timestamp: new Date('2026-06-01T17:00:00.000Z'),
          lat: 12.9,
          lng: 77.6,
          source: 'motion',
          accuracy: 10,
        },
      ],
      localMoments: [],
      localSettings: [],
    });

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.id).toBe('location_point:bulk');
  });
});
