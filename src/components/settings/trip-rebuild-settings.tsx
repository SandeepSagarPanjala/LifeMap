import { useCallback, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import { format } from 'date-fns';
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Modal,
  Pressable,
  View,
} from 'react-native';

import { HistoryDatePickerSheet } from '@/components/map/HistoryDatePickerSheet';
import { Text } from '@/components/ui/text';
import { useTripDetectionConfig } from '@/hooks/use-trip-detection-config';
import { EXPORT_SHARE_DELAY_MS } from '@/lib/app-constants';
import { getTodayDateKey, parseDateKey } from '@/lib/day-utils';
import { clearHistoryDataCache } from '@/lib/history-data-cache';
import {
  rebuildAllTrips,
  rebuildPastDayTrips,
  rebuildTodayTrips,
  type RebuildPastTripsProgress,
} from '@/lib/trip-materialization';
import { refreshTodayOnForeground } from '@/lib/today-refresh-scheduler';

export function TripRebuildSettings() {
  const detectionConfig = useTripDetectionConfig();
  const [rebuilding, setRebuilding] = useState(false);
  const [progress, setProgress] = useState<RebuildPastTripsProgress | null>(
    null,
  );
  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(getTodayDateKey());

  const runRebuild = useCallback(async () => {
    setRebuilding(true);
    setProgress({ phase: 'past', completed: 0, total: 0, dateKey: '' });
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
      Alert.alert(APP_COPY.alerts.couldNotRebuildTrips, errorMessageOr(error));
    } finally {
      setRebuilding(false);
      setProgress(null);
    }
  }, [detectionConfig]);

  const runRebuildDay = useCallback(
    async (dateKey: string) => {
      const todayKey = getTodayDateKey();
      const isToday = dateKey === todayKey;
      setRebuilding(true);
      setProgress({
        phase: isToday ? 'today' : 'past',
        completed: 0,
        total: 0,
        dateKey,
      });
      try {
        const tripsSaved = isToday
          ? await rebuildTodayTrips(detectionConfig)
          : await rebuildPastDayTrips(dateKey, detectionConfig);
        clearHistoryDataCache();
        refreshTodayOnForeground();
        const dayLabel = format(parseDateKey(dateKey), 'MMM d, yyyy');
        const segments = tripsSaved.toLocaleString();
        Alert.alert(
          'Day rebuilt',
          isToday
            ? `Saved ${segments} trip segments for today (live tail not persisted).`
            : `Saved ${segments} trip segments for ${dayLabel}.`,
        );
      } catch (error) {
        Alert.alert(
          isToday
            ? APP_COPY.alerts.couldNotRebuildToday
            : APP_COPY.alerts.couldNotRebuildTrips,
          errorMessageOr(error),
        );
      } finally {
        setRebuilding(false);
        setProgress(null);
      }
    },
    [detectionConfig],
  );

  const confirmRebuild = () => {
    Alert.alert(
      'Rebuild trips?',
      'This deletes cached trips, rebuilds visits and drives from GPS for all past days plus today’s settled prefix, and saves segment routes. Your raw location points are not deleted.\n\nThis may take a few minutes.',
      [
        { text: 'Cancel', style: 'cancel' },
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

  const confirmRebuildDay = (dateKey: string) => {
    const dayLabel = format(parseDateKey(dateKey), 'MMM d, yyyy');
    const isToday = dateKey === getTodayDateKey();
    Alert.alert(
      'Rebuild this day?',
      isToday
        ? `This rebuilds today’s settled visits and drives from GPS. The live tail stays on the map and is not written to the database.\n\nRaw location points are not deleted.`
        : `This rebuilds visits and drives from GPS for ${dayLabel} only. Other days are left unchanged.\n\nRaw location points are not deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rebuild day',
          style: 'destructive',
          onPress: () => {
            void runRebuildDay(dateKey);
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
          explorer, then save segment routes. Today’s last two segments stay
          live on the map and are not written to the database.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={rebuilding}
          onPress={confirmRebuild}
          className={`bg-primary mt-4 items-center rounded-full px-4 py-3 ${
            rebuilding ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-primary-foreground font-medium">Rebuild</Text>
        </Pressable>
      </View>

      <View className="bg-card border-border mt-2 rounded-xl border px-4 py-4">
        <Text variant="muted" className="text-sm leading-5">
          Rebuild visits and drives for a single day from GPS. Choose any past
          day, or today to re-seal the settled prefix.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={rebuilding}
          onPress={() => setDayPickerVisible(true)}
          className={`bg-primary mt-4 items-center rounded-full px-4 py-3 ${
            rebuilding ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-primary-foreground font-medium">
            Rebuild day
          </Text>
        </Pressable>
      </View>

      <HistoryDatePickerSheet
        visible={dayPickerVisible}
        selectedDateKey={selectedDayKey}
        onSelectDate={dateKey => {
          setSelectedDayKey(dateKey);
          setDayPickerVisible(false);
          setTimeout(() => {
            InteractionManager.runAfterInteractions(() => {
              confirmRebuildDay(dateKey);
            });
          }, EXPORT_SHARE_DELAY_MS);
        }}
        onClose={() => setDayPickerVisible(false)}
      />

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
                style={{ width: `${Math.round(progressRatio * 100)}%` }}
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
