import * as Keychain from 'react-native-keychain';
import { getDatabase } from '../src/db/client';
import * as schema from '../src/db/schema';

jest.mock('@op-engineering/op-sqlite');
jest.mock('drizzle-orm/op-sqlite/migrator', () => ({
  migrate: jest.fn().mockResolvedValue(undefined),
}));

describe('database layer (Phase 1)', () => {
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
    const { migrate } = jest.requireMock('drizzle-orm/op-sqlite/migrator');

    await getDatabase();
    await getDatabase();

    expect(migrate).toHaveBeenCalledTimes(1);
  });

  it('creates location_points, moments, and settings tables (schema contract)', () => {
    expect(schema.locationPoints).toBeDefined();
    expect(schema.moments).toBeDefined();
    expect(schema.settings).toBeDefined();
  });
});

