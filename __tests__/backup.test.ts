import { extractTripLabelOverrides } from '../src/lib/backup/backup-export';
import {
  parseIsoDate,
  parseRequiredNumber,
} from '../src/lib/backup/backup-serialize';

describe('backup export', () => {
  it('extracts user POI and saved-place overrides, not bare addresses', () => {
    const overrides = extractTripLabelOverrides([
      {
        eventKey: 'stay-1',
        dateKey: '2026-07-12',
        startAt: new Date(1_000),
        placeLabel: '123 Main St',
        placeId: 9,
        placeKind: 'cache',
        selectedCandidateIndex: null,
        poiId: null,
      },
      {
        eventKey: 'stay-2',
        dateKey: '2026-07-12',
        startAt: new Date(2_000),
        placeLabel: 'Coffee shop',
        placeId: 3,
        placeKind: 'cache',
        selectedCandidateIndex: null,
        poiId: 42,
        poiLabel: "Chili's",
      },
      {
        eventKey: 'stay-3',
        dateKey: '2026-07-12',
        startAt: new Date(3_000),
        placeLabel: null,
        placeId: 4,
        placeKind: 'saved',
        selectedCandidateIndex: null,
        poiId: null,
      },
      {
        eventKey: 'stay-4',
        placeLabel: null,
        placeId: 4,
        placeKind: 'cache',
        selectedCandidateIndex: 1,
        poiId: null,
      },
    ]);

    expect(overrides).toHaveLength(3);
    expect(overrides[0]?.eventKey).toBe('stay-2');
    expect(overrides[0]?.poiId).toBe(42);
    expect(overrides[0]?.startAtMs).toBe(2_000);
    expect(overrides[1]?.placeKind).toBe('saved');
    expect(overrides[2]?.selectedCandidateIndex).toBe(1);
  });
});

describe('backup serialize', () => {
  it('parses iso dates and numbers', () => {
    expect(parseIsoDate('2026-06-21T12:00:00.000Z')?.toISOString()).toBe(
      '2026-06-21T12:00:00.000Z',
    );
    expect(parseRequiredNumber('42', 'test')).toBe(42);
  });
});

describe('backup settings', () => {
  it('detects due schedules', () => {
    const { isBackupDue } = require('../src/lib/backup/backup-settings');
    const now = new Date('2026-06-21T12:00:00.000Z');
    const yesterday = new Date('2026-06-20T11:00:00.000Z');
    const eightDaysAgo = new Date('2026-06-13T12:00:00.000Z');
    const thirtyOneDaysAgo = new Date('2026-05-21T12:00:00.000Z');
    expect(isBackupDue('off', yesterday, now)).toBe(false);
    expect(isBackupDue('daily', yesterday, now)).toBe(true);
    expect(isBackupDue('weekly', yesterday, now)).toBe(false);
    expect(isBackupDue('weekly', eightDaysAgo, now)).toBe(true);
    expect(isBackupDue('monthly', eightDaysAgo, now)).toBe(false);
    expect(isBackupDue('monthly', thirtyOneDaysAgo, now)).toBe(true);
  });
});
