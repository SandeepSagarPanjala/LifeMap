import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';

import {formatDistanceToNow} from 'date-fns';
import {LocateFixed} from 'lucide-react-native';

import {getLatestLocationPoint} from '@/db/repositories/location-points';
import {getSetting, setSetting} from '@/db/repositories/settings';
import {getLocationService} from '@/location/transistorsoft-location-service';
import type {LocationAuthorizationStatus} from '@/location/types';
import {
  SETTINGS_KEY_TRACKING_MAX_RELIABILITY,
  TRACKING_DISTANCE_FILTER_METERS,
} from '@/lib/tracking-presets';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';

function formatAuthorization(status: LocationAuthorizationStatus): string {
  switch (status) {
    case 'always':
      return 'Always allowed';
    case 'when_in_use':
      return 'While using app';
    case 'denied':
      return 'Denied — open Settings to enable';
    case 'restricted':
      return 'Restricted';
    default:
      return 'Not requested yet';
  }
}

export function TrackingSettings() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [maxReliability, setMaxReliability] = useState(true);
  const [authorizationStatus, setAuthorizationStatus] =
    useState<LocationAuthorizationStatus>('not_determined');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const service = getLocationService();
      const state = await service.getState();
      const latest = await getLatestLocationPoint();
      const storedMax = await getSetting(SETTINGS_KEY_TRACKING_MAX_RELIABILITY);

      setEnabled(state.enabled);
      setMaxReliability(storedMax === null ? true : storedMax === 'true');
      setAuthorizationStatus(state.authorizationStatus);
      setLastSavedAt(latest?.timestamp ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleToggle = async () => {
    const service = getLocationService();
    if (!enabled) {
      const status = await service.requestPermission();
      setAuthorizationStatus(status);
      if (status === 'denied' || status === 'restricted') {
        return;
      }
    }
    await service.setEnabled(!enabled);
    await refresh();
  };

  const handleRequestPermission = async () => {
    const status = await getLocationService().requestPermission();
    setAuthorizationStatus(status);
    await refresh();
  };

  const handleMaxReliabilityToggle = async () => {
    const next = !maxReliability;
    await setSetting(SETTINGS_KEY_TRACKING_MAX_RELIABILITY, next ? 'true' : 'false');
    setMaxReliability(next);
    await getLocationService().applyTrackingProfile(next);
  };

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={LocateFixed} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">Background tracking</Text>
          <Text variant="muted" className="mt-1">
            {formatAuthorization(authorizationStatus)}
          </Text>
        </View>
        {loading ? (
          <ActivityIndicator />
        ) : (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{checked: enabled}}
            onPress={() => void handleToggle()}
            className={`h-6 w-11 rounded-full px-0.5 ${enabled ? 'bg-primary' : 'bg-muted'}`}>
            <View
              className={`mt-0.5 h-5 w-5 rounded-full bg-white ${enabled ? 'ml-auto' : 'ml-0'}`}
            />
          </Pressable>
        )}
      </View>

      {lastSavedAt ? (
        <Text variant="muted" className="mt-3 text-sm">
          Last save {formatDistanceToNow(lastSavedAt, {addSuffix: true})}
        </Text>
      ) : null}
      <Text variant="muted" className="mt-2 text-sm leading-5">
        {enabled
          ? `Saves every ${TRACKING_DISTANCE_FILTER_METERS} m while moving. Motion departures and 100 m drift save immediately; backup ping every ${maxReliability ? '10' : '30'} min when still. Native queue drains when the app opens.`
          : 'Background tracking is off — LifeMap is not saving new GPS points while the app is closed. Your existing map and history still work from data already saved.'}
      </Text>
      {!enabled ? (
        <Text variant="muted" className="mt-2 text-sm leading-5">
          Trips and visits are detected from saved location points only. With tracking off,
          you will see gaps in your timeline for any time nothing new was recorded.
        </Text>
      ) : null}

      {authorizationStatus === 'denied' || authorizationStatus === 'when_in_use' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleRequestPermission()}
          className="border-primary mt-4 rounded-xl border px-3 py-3">
          <Text className="text-primary text-center font-medium">Request location access</Text>
        </Pressable>
      ) : null}

      <View className="border-border mt-4 border-t pt-4">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="font-medium">Maximum reliability</Text>
            <Text variant="muted" className="mt-1 text-sm leading-5">
              Keeps GPS active when still, checks every minute, and saves on motion
              departures. iOS also wakes on geofence exits, visit departures, and
              significant location changes — even when the app is closed.
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{checked: maxReliability, disabled: !enabled}}
            disabled={!enabled}
            onPress={() => void handleMaxReliabilityToggle()}
            className={`h-6 w-11 rounded-full px-0.5 ${maxReliability && enabled ? 'bg-primary' : 'bg-muted'}`}>
            <View
              className={`mt-0.5 h-5 w-5 rounded-full bg-white ${maxReliability && enabled ? 'ml-auto' : 'ml-0'}`}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
