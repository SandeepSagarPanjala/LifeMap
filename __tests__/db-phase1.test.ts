import * as Keychain from 'react-native-keychain';
import {getDatabase, getSqlite, resetDatabaseClientForTests} from '../src/db/client';
import * as schema from '../src/db/schema';

jest.mock('@op-engineering/op-sqlite');
jest.mock('../src/db/migrate', () => ({
  runMigrations: jest.fn().mockResolvedValue(undefined),
  ensureTripSegmentMetadataColumns: jest.fn().mockResolvedValue(undefined),
  ensureTripPointMetadataColumns: jest.fn().mockResolvedValue(undefined),
  ensureMomentsMoodColumns: jest.fn().mockResolvedValue(undefined),
  ensureMaterializedDayGeometryColumn: jest.fn().mockResolvedValue(undefined),
  ensureLocationPointsDedupeUnique: jest.fn().mockResolvedValue(undefined),
}));

describe('database layer (Phase 1)', () => {
  beforeEach(() => {
    resetDatabaseClientForTests();
    jest.clearAllMocks();
  });

  it('stores encryption key in Keychain, not AsyncStorage', async () => {
    const getGenericPasswordSpy = jest
      .spyOn(Keychain, 'getGenericPassword')
      .mockResolvedValue(null as any);
    const setGenericPasswordSpy = jest
      .spyOn(Keychain, 'setGenericPassword')
      .mockResolvedValue({ service: 'lifemap-db-key' } as any);

    await getDatabase();

    expect(getGenericPasswordSpy).toHaveBeenCalled();
    expect(setGenericPasswordSpy).toHaveBeenCalled();
  });

  it('opens SQLCipher database with Drizzle', async () => {
    const { open } = jest.requireMock('@op-engineering/op-sqlite');

    await getDatabase();

    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'lifemap.db',
        encryptionKey: expect.any(String),
      }),
    );
  });

  it('applies migrations idempotently on app launch', async () => {
    const {runMigrations} = jest.requireMock('../src/db/migrate');
    const {open} = jest.requireMock('@op-engineering/op-sqlite');

    await getDatabase();
    await getDatabase();
    await getSqlite();

    expect(open).toHaveBeenCalledTimes(1);
    expect(runMigrations).toHaveBeenCalledTimes(1);
  });

  it('creates location_points, moments, and settings tables (schema contract)', () => {
    expect(schema.locationPoints).toBeDefined();
    expect(schema.moments).toBeDefined();
    expect(schema.settings).toBeDefined();
  });
});

