import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { SettingsIosToggle } from '@/components/settings/settings-group';
import { Text } from '@/components/ui/text';
import { useOnFootDetectionEnabled } from '@/hooks/use-on-foot-detection-enabled';
import { getLocationService } from '@/location/transistorsoft-location-service';
import type { LocationAuthorizationStatus } from '@/location/types';
import {
  STATIONARY_PING_MIN_MS_MAX_RELIABILITY,
  TRACKING_DISTANCE_FILTER_METERS,
  TRACKING_DISTANCE_FILTER_METERS_ON_FOOT,
} from '@/lib/app-constants';
import { APP_COPY } from '@/lib/app-copy';
import { resetFootTrackingMode } from '@/lib/foot-tracking-mode';
import {
  getOnFootDetectionEnabled,
  setOnFootDetectionEnabled,
} from '@/lib/on-foot-detection-settings';

const BACKUP_PING_MINUTES = STATIONARY_PING_MIN_MS_MAX_RELIABILITY / 60_000;

export function TrackingSettings() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const onFootDetectionEnabled = useOnFootDetectionEnabled();
  const [onFootLoading, setOnFootLoading] = useState(true);
  const [authorizationStatus, setAuthorizationStatus] =
    useState<LocationAuthorizationStatus>('not_determined');

  const refresh = useCallback(async () => {
    setLoading(true);
    setOnFootLoading(true);
    try {
      const service = getLocationService();
      const [state] = await Promise.all([
        service.getState(),
        getOnFootDetectionEnabled(),
      ]);

      setEnabled(state.enabled);
      setAuthorizationStatus(state.authorizationStatus);
    } finally {
      setLoading(false);
      setOnFootLoading(false);
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

  const handleOnFootToggle = async (next: boolean) => {
    await setOnFootDetectionEnabled(next);
    if (!next) {
      resetFootTrackingMode();
    }
    await getLocationService().applyTrackingProfile();
  };

  const handleRequestPermission = async () => {
    const status = await getLocationService().requestPermission();
    setAuthorizationStatus(status);
    await refresh();
  };

  return (
    <>
      <SettingsIosToggle
        label="Background tracking"
        description={
          enabled
            ? `Saves every ${TRACKING_DISTANCE_FILTER_METERS} m while moving, with a backup ping every ${BACKUP_PING_MINUTES} min when still.`
            : 'Records GPS in the background so your timeline stays complete.'
        }
        value={enabled}
        loading={loading}
        onValueChange={value => void handleToggle(value)}
      />

      <SettingsIosToggle
        label={APP_COPY.tracking.onFootDetection}
        description={
          onFootDetectionEnabled
            ? APP_COPY.tracking.onFootDetectionOn
            : APP_COPY.tracking.onFootDetectionOff
        }
        value={onFootDetectionEnabled}
        loading={onFootLoading}
        onValueChange={value => void handleOnFootToggle(value)}
        footer={
          onFootDetectionEnabled
            ? `Uses ${TRACKING_DISTANCE_FILTER_METERS_ON_FOOT} m GPS while walking (normally ${TRACKING_DISTANCE_FILTER_METERS} m for drives).`
            : undefined
        }
      />

      {authorizationStatus === 'denied' ||
      authorizationStatus === 'when_in_use' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleRequestPermission()}
          className="border-primary mt-3 rounded-xl border px-3 py-3"
        >
          <Text className="text-primary text-center font-medium">
            Request location access
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}
