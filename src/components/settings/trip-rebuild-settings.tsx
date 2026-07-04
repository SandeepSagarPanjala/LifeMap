import {useCallback, useState} from 'react';
import {APP_COPY, errorMessageOr} from '@/lib/app-copy';
import {format} from 'date-fns';
import {ActivityIndicator, Alert, Modal, Pressable, View} from 'react-native';

import {Text} from '@/components/ui/text';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {parseDateKey} from '@/lib/day-utils';
import {clearHistoryDataCache} from '@/lib/history-data-cache';
import {
  rebuildAllPastDayTrips,
  rebuildTodayTrips,
  type RebuildPastTripsProgress,
} from '@/lib/trip-materialization';
import {refreshTodayOnForeground} from '@/lib/today-refresh-scheduler';

export function TripRebuildSettings() {
  const detectionConfig = useTripDetectionConfig();
  const [rebuildingToday, setRebuildingToday] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [progress, setProgress] = useState<RebuildPastTripsProgress | null>(
    null,
  );

  const runRebuildToday = useCallback(async () => {
    setRebuildingToday(true);
    try {
      const tripsSaved = await rebuildTodayTrips(detectionConfig);
      clearHistoryDataCache();
      refreshTodayOnForeground();
      Alert.alert(
        'Today rebuilt',
        tripsSaved > 0
          ? `Saved ${tripsSaved.toLocaleString()} trip segments from today's GPS.`
          : 'Cleared stale trip cache. The map will show live detection until new segments seal.',
      );
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotRebuildToday,
        errorMessageOr(error),
      );
    } finally {
      setRebuildingToday(false);
    }
  }, [detectionConfig]);

  const confirmRebuildToday = () => {
    Alert.alert(
      'Rebuild today?',
      'This deletes cached trips for today, rebuilds visits and drives from GPS, and saves segment routes. Your raw location points are not deleted.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Rebuild today',
          style: 'destructive',
          onPress: () => {
            void runRebuildToday();
          },
        },
      ],
    );
  };

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
        APP_COPY.alerts.couldNotRebuildTrips,
        errorMessageOr(error),
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
      <View className="bg-card border-border mt-2 rounded-xl border px-4 py-4">
        <Text variant="muted" className="text-sm leading-5">
          Recompute visits and drives from GPS using the same rules as the point
          explorer, then save segment routes for past days.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={rebuildingToday || rebuilding}
          onPress={confirmRebuildToday}
          className={`border-border mt-4 items-center rounded-full border px-4 py-3 ${
            rebuildingToday || rebuilding ? 'opacity-50' : ''
          }`}>
          <Text className="font-medium">Rebuild today</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          disabled={rebuilding || rebuildingToday}
          onPress={confirmRebuildAll}
          className={`bg-primary mt-3 items-center rounded-full px-4 py-3 ${
            rebuilding || rebuildingToday ? 'opacity-50' : ''
          }`}>
          <Text className="text-primary-foreground font-medium">
            Rebuild all past days
          </Text>
        </Pressable>
      </View>

      <Modal visible={rebuilding || rebuildingToday} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="bg-card w-full max-w-sm rounded-2xl p-5">
            <Text className="text-center text-base font-semibold">
              {rebuildingToday ? 'Rebuilding today' : 'Rebuilding trips'}
            </Text>
            {rebuildingToday ? (
              <Text variant="muted" className="mt-2 text-center text-sm">
                Recomputing from GPS…
              </Text>
            ) : progress?.dateKey ? (
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
                {rebuildingToday
                  ? 'Working…'
                  : progress != null && progress.total > 0
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
