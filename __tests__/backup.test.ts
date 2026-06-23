import {
  extractTripLabelOverrides,
} from '../src/lib/backup/backup-export';
import {
  parseIsoDate,
  parseRequiredNumber,
} from '../src/lib/backup/backup-serialize';

describe('backup export', () => {
  it('extracts trip label overrides from trip rows', () => {
    const overrides = extractTripLabelOverrides([
      {
        eventKey: 'stay-1',
        savedPlaceLabel: null,
        selectedCandidateIndex: null,
        placeLookupCacheId: null,
        savedPlaceId: null,
      },
      {
        eventKey: 'stay-2',
        savedPlaceLabel: 'Coffee shop',
        selectedCandidateIndex: null,
        placeLookupCacheId: 3,
        savedPlaceId: null,
      },
      {
        eventKey: 'stay-3',
        savedPlaceLabel: null,
        selectedCandidateIndex: 1,
        placeLookupCacheId: 4,
        savedPlaceId: null,
      },
    ]);

    expect(overrides).toHaveLength(2);
    expect(overrides[0]?.eventKey).toBe('stay-2');
    expect(overrides[1]?.selectedCandidateIndex).toBe(1);
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
    const {isBackupDue} = require('../src/lib/backup/backup-settings');
    const now = new Date('2026-06-21T12:00:00.000Z');
    const yesterday = new Date('2026-06-20T11:00:00.000Z');
    expect(isBackupDue('off', yesterday, now)).toBe(false);
    expect(isBackupDue('daily', yesterday, now)).toBe(true);
    expect(isBackupDue('weekly', yesterday, now)).toBe(false);
  });
});
