import {useCallback, useState} from 'react';
import {APP_COPY, errorMessageOr} from '@/lib/app-copy';
import {format} from 'date-fns';
import {ActivityIndicator, Alert, Modal, Pressable, View} from 'react-native';

import {Text} from '@/components/ui/text';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {parseDateKey} from '@/lib/day-utils';
import {clearHistoryDataCache} from '@/lib/history-data-cache';
import {
  rebuildAllTrips,
  type RebuildPastTripsProgress,
} from '@/lib/trip-materialization';
import {refreshTodayOnForeground} from '@/lib/today-refresh-scheduler';

export function TripRebuildSettings() {
  const detectionConfig = useTripDetectionConfig();
  const [rebuilding, setRebuilding] = useState(false);
  const [progress, setProgress] = useState<RebuildPastTripsProgress | null>(
    null,
  );

  const runRebuild = useCallback(async () => {
    setRebuilding(true);
    setProgress({phase: 'past', completed: 0, total: 0, dateKey: ''});
    try {
      const result = await rebuildAllTrips(detectionConfig, setProgress);
      clearHistoryDataCache();
      refreshTodayOnForeground();
      const pastDays = result.daysProcessed.toLocaleString();
      const segments = result.tripsSaved.toLocaleString();
      Alert.alert(
        'Trips rebuilt',
        result.daysProcessed > 0
          ? `Processed ${pastDays} past days and saved ${segments} trip segments (today keeps a live tail).`
          : `Saved ${segments} trip segments for today (live tail not persisted).`,
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

  const confirmRebuild = () => {
    Alert.alert(
      'Rebuild trips?',
      'This deletes cached trips, rebuilds visits and drives from GPS for all past days plus today’s settled prefix, and saves segment routes. Your raw location points are not deleted.\n\nThis may take a few minutes.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Rebuild',
          style: 'destructive',
          onPress: () => {
            void runRebuild();
          },
        },
      ],
    );
  };

  const progressRatio =
    progress != null && progress.total > 0
      ? Math.min(1, progress.completed / progress.total)
      : 0;

  const progressLabel =
    progress?.phase === 'today'
      ? 'Today'
      : progress?.dateKey
        ? format(parseDateKey(progress.dateKey), 'MMM d, yyyy')
        : 'Preparing…';

  return (
    <>
      <View className="bg-card border-border mt-2 rounded-xl border px-4 py-4">
        <Text variant="muted" className="text-sm leading-5">
          Recompute visits and drives from GPS using the same rules as the point
          explorer, then save segment routes. Today’s last two segments stay live
          on the map and are not written to the database.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={rebuilding}
          onPress={confirmRebuild}
          className={`bg-primary mt-4 items-center rounded-full px-4 py-3 ${
            rebuilding ? 'opacity-50' : ''
          }`}>
          <Text className="text-primary-foreground font-medium">Rebuild</Text>
        </Pressable>
      </View>

      <Modal visible={rebuilding} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="bg-card w-full max-w-sm rounded-2xl p-5">
            <Text className="text-center text-base font-semibold">
              Rebuilding trips
            </Text>
            <Text variant="muted" className="mt-2 text-center text-sm">
              {progressLabel}
            </Text>
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
                  ? `${progress.completed} / ${progress.total} steps`
                  : 'Working…'}
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
