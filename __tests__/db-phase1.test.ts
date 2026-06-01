/**
 * Phase 1 will add real tests alongside src/db/ (SQLCipher, Drizzle migrations, Keychain).
 * These todos document the contract before implementation.
 */
describe('database layer (Phase 1)', () => {
  it.todo('stores encryption key in Keychain, not AsyncStorage');
  it.todo('opens SQLCipher database with Drizzle');
  it.todo('applies migrations idempotently on app launch');
  it.todo('creates location_points, moments, and settings tables');
});
