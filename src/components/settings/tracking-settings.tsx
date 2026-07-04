import {useCallback, useEffect, useState} from 'react';
import {Pressable} from 'react-native';

import {SettingsIosToggle} from '@/components/settings/settings-group';
import {Text} from '@/components/ui/text';
import {getSetting, setSetting} from '@/db/repositories/settings';
import {getLocationService} from '@/location/transistorsoft-location-service';
import type {LocationAuthorizationStatus} from '@/location/types';
import {
  SETTINGS_KEY_TRACKING_MAX_RELIABILITY,
  TRACKING_DISTANCE_FILTER_METERS,
} from '@/lib/app-constants';

export function TrackingSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [maxReliability, setMaxReliability] = useState(true);
  const [authorizationStatus, setAuthorizationStatus] =
    useState<LocationAuthorizationStatus>('not_determined');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const service = getLocationService();
      const state = await service.getState();
      const storedMax = await getSetting(SETTINGS_KEY_TRACKING_MAX_RELIABILITY);

      setEnabled(state.enabled);
      setMaxReliability(storedMax === null ? true : storedMax === 'true');
      setAuthorizationStatus(state.authorizationStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = async (next: boolean) => {
    const service = getLocationService();
    if (next) {
      const status = await service.requestPermission();
      setAuthorizationStatus(status);
      if (
        status === 'denied' ||
        status === 'restricted' ||
        status === 'when_in_use'
      ) {
        await refresh();
        return;
      }
    }
    await service.setEnabled(next);
    await refresh();
  };

  const handleRequestPermission = async () => {
    const status = await getLocationService().requestPermission();
    setAuthorizationStatus(status);
    await refresh();
  };

  const handleMaxReliabilityToggle = async (next: boolean) => {
    await setSetting(SETTINGS_KEY_TRACKING_MAX_RELIABILITY, next ? 'true' : 'false');
    setMaxReliability(next);
    await getLocationService().applyTrackingProfile(next);
  };

  const backupMinutes = maxReliability ? '10' : '30';

  return (
    <>
      <SettingsIosToggle
        label="Background tracking"
        description={
          enabled
            ? `Saves every ${TRACKING_DISTANCE_FILTER_METERS} m while moving, with a backup ping every ${backupMinutes} min when still.`
            : 'Records GPS in the background so your timeline stays complete.'
        }
        value={enabled}
        loading={loading}
        onValueChange={value => void handleToggle(value)}
      />

      <SettingsIosToggle
        label="Maximum reliability"
        description="Saves more often when you're still. Uses extra iOS wake-ups for fewer timeline gaps."
        value={maxReliability}
        disabled={!enabled}
        onValueChange={value => void handleMaxReliabilityToggle(value)}
      />

      {authorizationStatus === 'denied' || authorizationStatus === 'when_in_use' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleRequestPermission()}
          className="border-primary mt-3 rounded-xl border px-3 py-3">
          <Text className="text-primary text-center font-medium">
            Request location access
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}
