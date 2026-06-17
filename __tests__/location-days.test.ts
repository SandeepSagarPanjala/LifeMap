import {getDatabase} from '@/db/client';
import {
  getEarliestLocationDateKey,
  listDateKeysWithLocationDataBefore,
} from '@/db/repositories/location-days';
import {parseDateKey} from '@/lib/day-utils';

jest.mock('@/db/client', () => ({
  getDatabase: jest.fn(),
}));

const mockedGetDatabase = jest.mocked(getDatabase);

type MockDbOptions = {
  earliestDateKey: string | null;
  /** Point counts per calendar day, queried in order from earliest → before. */
  pointCountsInWalkOrder?: number[];
};

function installMockDatabase({
  earliestDateKey,
  pointCountsInWalkOrder = [],
}: MockDbOptions) {
  let fingerprintCall = 0;
  const select = jest.fn((fields: Record<string, unknown>) => {
    if ('count' in fields) {
      return {
        from: () => ({
          where: () => {
            const count = pointCountsInWalkOrder[fingerprintCall] ?? 0;
            fingerprintCall += 1;
            return Promise.resolve([{count, maxId: count > 0 ? 1 : 0}]);
          },
        }),
      };
    }

    return {
      from: () =>
        Promise.resolve([
          {
            timestamp:
              earliestDateKey != null
                ? parseDateKey(earliestDateKey)
                : null,
          },
        ]),
    };
  });

  mockedGetDatabase.mockResolvedValue({select} as never);
  return {select, getFingerprintCallCount: () => fingerprintCall};
}

describe('listDateKeysWithLocationDataBefore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns past days that have GPS, in chronological order', async () => {
    const {select} = installMockDatabase({
      earliestDateKey: '2026-06-10',
      pointCountsInWalkOrder: [5, 0, 3],
    });

    await expect(
      listDateKeysWithLocationDataBefore('2026-06-13'),
    ).resolves.toEqual(['2026-06-10', '2026-06-12']);
    expect(select).toHaveBeenCalled();
  });

  it('returns empty when there is no GPS history', async () => {
    installMockDatabase({earliestDateKey: null});

    await expect(
      listDateKeysWithLocationDataBefore('2026-06-13'),
    ).resolves.toEqual([]);
  });

  it('returns empty when earliest is not before the cutoff', async () => {
    installMockDatabase({earliestDateKey: '2026-06-13'});

    await expect(
      listDateKeysWithLocationDataBefore('2026-06-13'),
    ).resolves.toEqual([]);
  });

  it('uses one indexed day query per calendar day, not a full-table timestamp scan', async () => {
    const {select, getFingerprintCallCount} = installMockDatabase({
      earliestDateKey: '2026-06-10',
      pointCountsInWalkOrder: [1, 2, 0],
    });

    await listDateKeysWithLocationDataBefore('2026-06-13');

    expect(getFingerprintCallCount()).toBe(3);
    const bulkTimestampSelects = select.mock.calls.filter(
      ([fields]) => 'timestamp' in fields && !('count' in fields),
    );
    expect(bulkTimestampSelects).toHaveLength(1);
  });
});

describe('getEarliestLocationDateKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps the min timestamp to an app date key', async () => {
    installMockDatabase({earliestDateKey: '2026-06-10'});

    await expect(getEarliestLocationDateKey()).resolves.toBe('2026-06-10');
  });
});
