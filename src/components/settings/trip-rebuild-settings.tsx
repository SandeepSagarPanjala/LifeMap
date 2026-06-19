import {useCallback, useEffect, useState} from 'react';
import {format} from 'date-fns';
import {ActivityIndicator, Alert, Modal, Pressable, View} from 'react-native';
import {Route} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {parseDateKey} from '@/lib/day-utils';
import {clearHistoryDataCache} from '@/lib/history-data-cache';
import {
  isCanonicalTravelGeometryEnabled,
  setCanonicalTravelGeometryEnabled,
} from '@/lib/trip-geometry-settings';
import {
  rebuildAllPastDayTrips,
  type RebuildPastTripsProgress,
} from '@/lib/trip-materialization';

export function TripRebuildSettings() {
  const colors = useThemeColors();
  const detectionConfig = useTripDetectionConfig();
  const [rebuilding, setRebuilding] = useState(false);
  const [canonicalTravelGeometry, setCanonicalTravelGeometry] = useState(true);
  const [loadingTravelSetting, setLoadingTravelSetting] = useState(true);
  const [progress, setProgress] = useState<RebuildPastTripsProgress | null>(
    null,
  );

  useEffect(() => {
    void isCanonicalTravelGeometryEnabled()
      .then(setCanonicalTravelGeometry)
      .finally(() => setLoadingTravelSetting(false));
  }, []);

  const handleTravelGeometryToggle = useCallback(async () => {
    const next = !canonicalTravelGeometry;
    await setCanonicalTravelGeometryEnabled(next);
    setCanonicalTravelGeometry(next);
    clearHistoryDataCache();
  }, [canonicalTravelGeometry]);

  const runRebuildAll = useCallback(async () => {
    setRebuilding(true);
    setProgress({completed: 0, total: 0, dateKey: ''});
    try {
      const result = await rebuildAllPastDayTrips(detectionConfig, setProgress);
      clearHistoryDataCache();
      Alert.alert(
        'Trips rebuilt',
        `Processed ${result.daysProcessed.toLocaleString()} past days and saved ${result.tripsSaved.toLocaleString()} trip segments.`,
      );
    } catch (error) {
      Alert.alert(
        'Could not rebuild trips',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setRebuilding(false);
      setProgress(null);
    }
  }, [detectionConfig]);

  const confirmRebuildAll = () => {
    Alert.alert(
      'Rebuild all past trips?',
      'This deletes cached trips for all past days, rebuilds visits and drives from GPS, and saves segment routes. Your raw location points are not deleted.\n\nThis runs now and may take a few minutes.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Rebuild all',
          style: 'destructive',
          onPress: () => {
            void runRebuildAll();
          },
        },
      ],
    );
  };

  const progressRatio =
    progress != null && progress.total > 0
      ? Math.min(1, progress.completed / progress.total)
      : 0;

  return (
    <>
      <View className="bg-card border-border rounded-2xl border p-4">
        <View className="flex-row items-center gap-3">
          <Icon as={Route} size={20} color={colors.primary} />
          <View className="flex-1">
            <Text className="font-medium">Rebuild trip routes</Text>
            <Text variant="muted" className="mt-1 text-sm leading-5">
              Recompute visits and drives from GPS using the same rules as the
              point explorer, then save segment routes for past days.
            </Text>
          </View>
        </View>

        <View className="border-border mt-4 border-t pt-4">
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="font-medium">Canonical drive geometry</Text>
              <Text variant="muted" className="mt-1 text-sm leading-5">
                Simplify drive routes when saving trips — keeps turns, drops
                redundant straight-line GPS. Also applies when yesterday is
                sealed automatically.
              </Text>
            </View>
            {loadingTravelSetting ? (
              <ActivityIndicator />
            ) : (
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{checked: canonicalTravelGeometry}}
                onPress={() => void handleTravelGeometryToggle()}
                className={`h-6 w-11 rounded-full px-0.5 ${
                  canonicalTravelGeometry ? 'bg-primary' : 'bg-muted'
                }`}>
                <View
                  className={`mt-0.5 h-5 w-5 rounded-full bg-white ${
                    canonicalTravelGeometry ? 'ml-auto' : 'ml-0'
                  }`}
                />
              </Pressable>
            )}
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={rebuilding}
          onPress={confirmRebuildAll}
          className={`bg-primary mt-4 items-center rounded-full px-4 py-3 ${
            rebuilding ? 'opacity-50' : ''
          }`}>
          <Text className="text-primary-foreground font-medium">
            Rebuild all past days
          </Text>
        </Pressable>
      </View>

      <Modal visible={rebuilding} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="bg-card w-full max-w-sm rounded-2xl p-5">
            <Text className="text-center text-base font-semibold">
              Rebuilding trips
            </Text>
            {progress?.dateKey ? (
              <Text variant="muted" className="mt-2 text-center text-sm">
                {format(parseDateKey(progress.dateKey), 'MMM d, yyyy')}
              </Text>
            ) : (
              <Text variant="muted" className="mt-2 text-center text-sm">
                Preparing…
              </Text>
            )}
            <View className="bg-muted mt-4 h-2 overflow-hidden rounded-full">
              <View
                className="bg-primary h-2 rounded-full"
                style={{width: `${Math.round(progressRatio * 100)}%`}}
              />
            </View>
            <View className="mt-3 flex-row items-center justify-center gap-2">
              <ActivityIndicator />
              <Text variant="muted" className="text-sm">
                {progress != null && progress.total > 0
                  ? `${progress.completed} / ${progress.total} days`
                  : 'Working…'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
