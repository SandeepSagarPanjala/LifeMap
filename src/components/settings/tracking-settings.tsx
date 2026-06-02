import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, View} from 'react-native';

import {formatDistanceToNow} from 'date-fns';

import {countLocationPoints, getLatestLocationPoint} from '@/db/repositories/location-points';
import {getLocationPointsForDay} from '@/db/repositories/location-days';
import {getTodayDateKey} from '@/lib/day-utils';
import {getLocationService} from '@/location/transistorsoft-location-service';
import type {LocationAuthorizationStatus} from '@/location/types';
import {
  TRACKING_PRESET_ORDER,
  TRACKING_PRESETS,
  type TrackingPresetId,
} from '@/lib/tracking-presets';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {LocateFixed} from 'lucide-react-native';

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
  const [presetId, setPresetId] = useState<TrackingPresetId>('d25_mov');
  const [authorizationStatus, setAuthorizationStatus] =
    useState<LocationAuthorizationStatus>('not_determined');
  const [pointCount, setPointCount] = useState(0);
  const [todayPointCount, setTodayPointCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const service = getLocationService();
      const state = await service.getState();
      const count = await countLocationPoints();
      const latest = await getLatestLocationPoint();
      const todayPoints = await getLocationPointsForDay(getTodayDateKey());

      setEnabled(state.enabled);
      setPresetId(state.presetId);
      setAuthorizationStatus(state.authorizationStatus);
      setPointCount(count);
      setTodayPointCount(todayPoints.length);
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

  const handlePreset = async (next: TrackingPresetId) => {
    await getLocationService().setPreset(next);
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

      <Text variant="muted" className="mt-3 text-sm">
        {pointCount.toLocaleString()} saved locally
        {todayPointCount > 0 ? ` · ${todayPointCount.toLocaleString()} today` : ''}
        {lastSavedAt
          ? ` · last ${formatDistanceToNow(lastSavedAt, {addSuffix: true})}`
          : ''}
      </Text>
      <Text variant="muted" className="mt-2 text-sm leading-5">
        Options show distance (when GPS may fire) and save cap (what LifeMap writes). If the SDK
        sends many fixes in one window, only the latest is saved. Still at home saves almost
        nothing. Android heartbeat is at least 60 s.
      </Text>

      <ScrollView className="mt-4 max-h-96" nestedScrollEnabled showsVerticalScrollIndicator>
        <View className="gap-2">
          {TRACKING_PRESET_ORDER.map(id => {
            const preset = TRACKING_PRESETS[id];
            const selected = presetId === id;

            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                onPress={() => void handlePreset(id)}
                className={`rounded-xl border px-3 py-3 ${
                  selected ? 'border-primary bg-primary/10' : 'border-border'
                }`}>
                <Text className={selected ? 'text-primary font-medium' : 'font-medium'}>
                  {preset.label}
                </Text>
                <Text variant="muted" className="mt-1 text-sm leading-5">
                  {preset.saveRule}
                </Text>
                <Text variant="muted" className="mt-1 text-xs leading-4 opacity-80">
                  SDK: {preset.sdkHint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {authorizationStatus === 'denied' || authorizationStatus === 'when_in_use' ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => void handleRequestPermission()}
          className="border-primary mt-4 rounded-xl border px-3 py-3">
          <Text className="text-primary text-center font-medium">Request location access</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
