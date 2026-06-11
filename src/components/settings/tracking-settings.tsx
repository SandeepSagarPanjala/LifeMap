import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';

import {formatDistanceToNow} from 'date-fns';
import {LocateFixed} from 'lucide-react-native';

import {getLatestLocationPoint} from '@/db/repositories/location-points';
import {getLocationService} from '@/location/transistorsoft-location-service';
import type {LocationAuthorizationStatus} from '@/location/types';
import {TRACKING_DISTANCE_FILTER_METERS} from '@/lib/tracking-presets';
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
  const [authorizationStatus, setAuthorizationStatus] =
    useState<LocationAuthorizationStatus>('not_determined');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const service = getLocationService();
      const state = await service.getState();
      const latest = await getLatestLocationPoint();

      setEnabled(state.enabled);
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
          ? `Records your location about every ${TRACKING_DISTANCE_FILTER_METERS} m while moving and saves every fix the SDK sends. A heartbeat still pings every 30 minutes if the SDK goes quiet.`
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

      <View className="border-border mt-4 border-t pt-4 opacity-60">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="font-medium">Maximum reliability</Text>
            <Text variant="muted" className="mt-1 text-sm leading-5">
              Keeps GPS active even when still. Better drive coverage, higher battery
              use (~10–15%/day). Test the current departure watchdog on real drives
              first — enable this only if gaps remain.
            </Text>
          </View>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{checked: false, disabled: true}}
            disabled
            className="bg-muted h-6 w-11 rounded-full px-0.5">
            <View className="mt-0.5 ml-0 h-5 w-5 rounded-full bg-white" />
          </Pressable>
        </View>
        <Text variant="muted" className="mt-2 text-xs">
          Coming soon — placeholder while we validate the new heartbeat departure checks.
        </Text>
      </View>
    </View>
  );
}
