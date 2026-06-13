jest.mock('@/db/repositories/settings', () => ({
  getSetting: jest.fn(),
  setSetting: jest.fn(),
}));

jest.mock('@/db/repositories/tracking-events', () => ({
  insertTrackingEvent: jest.fn(),
}));

import {getSetting, setSetting} from '@/db/repositories/settings';
import {insertTrackingEvent} from '@/db/repositories/tracking-events';
import {
  getTrackingDiagnosticsEnabled,
  recordTrackingDiagnostic,
  resetTrackingDiagnosticsForTests,
  setTrackingDiagnosticsEnabled,
  SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED,
} from '@/lib/tracking-diagnostics';

const mockedGetSetting = jest.mocked(getSetting);
const mockedSetSetting = jest.mocked(setSetting);
const mockedInsertTrackingEvent = jest.mocked(insertTrackingEvent);

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
    const store = installSettingsStore({
      tracking_diagnostics_default_off_applied_v1: 'true',
    });

    await expect(getTrackingDiagnosticsEnabled()).resolves.toBe(false);

    expect(store.get(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED)).toBe('false');
  });

  it('turns diagnostics off once for existing installs', async () => {
    const store = installSettingsStore({
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'true',
    });

    await expect(getTrackingDiagnosticsEnabled()).resolves.toBe(false);

    expect(store.get(SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED)).toBe('false');
    expect(store.get('tracking_diagnostics_default_off_applied_v1')).toBe('true');
  });

  it('respects an explicit enabled setting after migration', async () => {
    installSettingsStore({
      tracking_diagnostics_default_off_applied_v1: 'true',
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'true',
    });

    await expect(getTrackingDiagnosticsEnabled()).resolves.toBe(true);
    expect(mockedSetSetting).not.toHaveBeenCalled();
  });

  it('does not write diagnostics when disabled', async () => {
    installSettingsStore({
      tracking_diagnostics_default_off_applied_v1: 'true',
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'false',
    });

    await recordTrackingDiagnostic('motion_change', {isMoving: true});

    expect(mockedInsertTrackingEvent).not.toHaveBeenCalled();
  });

  it('writes diagnostics only after the user enables them', async () => {
    installSettingsStore({
      tracking_diagnostics_default_off_applied_v1: 'true',
      [SETTINGS_KEY_TRACKING_DIAGNOSTICS_ENABLED]: 'false',
    });

    await setTrackingDiagnosticsEnabled(true);
    await recordTrackingDiagnostic('motion_change', {isMoving: true});

    expect(mockedInsertTrackingEvent).toHaveBeenCalledWith({
      event: 'motion_change',
      details: {isMoving: true},
    });
  });
});
