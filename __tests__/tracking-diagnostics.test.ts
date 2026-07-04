jest.mock('@/db/repositories/settings', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
}));

jest.mock('@/db/repositories/tracking-events', () => ({
  insertTrackingEvent: jest.fn(),
  countTrackingEvents: jest.fn(),
}));

import {getSetting, setSetting} from '@/db/repositories/settings';
import {countTrackingEvents, insertTrackingEvent} from '@/db/repositories/tracking-events';
import {
  disableDiagnosticsIfDatabaseBloated,
  getTrackingDiagnosticsEnabled,
  recordTrackingDiagnostic,
  resetTrackingDiagnosticsForTests,
  SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED,
} from '@/lib/tracking-diagnostics';
import {TRACKING_EVENTS_BLOAT_DISABLE_THRESHOLD} from '@/lib/app-constants';

const mockedGetSetting = jest.mocked(getSetting);
const mockedSetSetting = jest.mocked(setSetting);
const mockedInsertTrackingEvent = jest.mocked(insertTrackingEvent);
const mockedCountTrackingEvents = jest.mocked(countTrackingEvents);

function installSettingsStore(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));

  mockedGetSetting.mockImplementation(async key => store.get(key) ?? null);
  mockedSetSetting.mockImplementation(async (key, value) => {
    store.set(key, value);
  });

  return store;
}

describe('tracking diagnostics defaults', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetTrackingDiagnosticsForTests();
  });

  it('persists diagnostics as disabled on first launch', async () => {
    const store = installSettingsStore();

    await expect(getTrackingDiagnosticsEnabled()).resolves.toBe(false);

    expect(store.get(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED)).toBe('false');
    expect(store.get('tracking_diagnostics_default_off_repair_v3')).toBe('true');
  });

  it('turns diagnostics off once for installs that were default-on', async () => {
    const store = installSettingsStore({
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'true',
      tracking_diagnostics_default_on_applied_v2: 'true',
    });

    await expect(getTrackingDiagnosticsEnabled()).resolves.toBe(false);

    expect(store.get(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED)).toBe('false');
    expect(store.get('tracking_diagnostics_default_off_repair_v3')).toBe('true');
  });

  it('respects an explicit enabled setting after migration', async () => {
    installSettingsStore({
      tracking_diagnostics_default_off_repair_v3: 'true',
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'true',
    });

    await expect(getTrackingDiagnosticsEnabled()).resolves.toBe(true);
    expect(mockedSetSetting).not.toHaveBeenCalled();
  });

  it('does not write diagnostics when disabled', async () => {
    installSettingsStore({
      tracking_diagnostics_default_off_repair_v3: 'true',
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'false',
    });

    await recordTrackingDiagnostic('motion_change', {isMoving: true});

    expect(mockedInsertTrackingEvent).not.toHaveBeenCalled();
  });

  it('rate-limits noisy diagnostics', async () => {
    installSettingsStore({
      tracking_diagnostics_default_off_repair_v3: 'true',
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'true',
    });

    await recordTrackingDiagnostic('motion_change', {isMoving: true});
    await recordTrackingDiagnostic('motion_change', {isMoving: false});

    expect(mockedInsertTrackingEvent).toHaveBeenCalledTimes(1);
  });

  it('auto-disables diagnostics when the table is bloated', async () => {
    const store = installSettingsStore({
      tracking_diagnostics_default_off_repair_v3: 'true',
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'true',
    });
    mockedCountTrackingEvents.mockResolvedValue(
      TRACKING_EVENTS_BLOAT_DISABLE_THRESHOLD,
    );

    await expect(disableDiagnosticsIfDatabaseBloated()).resolves.toBe(true);
    expect(store.get(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED)).toBe('false');
  });
});
