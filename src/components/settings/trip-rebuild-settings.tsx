import {useCallback, useState} from 'react';
import {format, subDays} from 'date-fns';
import {ActivityIndicator, Alert, Modal, Pressable, View} from 'react-native';
import {Route} from 'lucide-react-native';

import {HistoryDatePickerSheet} from '@/components/map/HistoryDatePickerSheet';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {useTripDetectionConfig} from '@/hooks/use-trip-detection-config';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {getTodayDateKey, parseDateKey} from '@/lib/day-utils';
import {clearHistoryDataCache} from '@/lib/history-data-cache';
import {
  rebuildAllPastDayTrips,
  rebuildPastDayTrips,
  type RebuildPastTripsProgress,
} from '@/lib/trip-materialization';

export function TripRebuildSettings() {
  const colors = useThemeColors();
  const detectionConfig = useTripDetectionConfig();
  const todayKey = getTodayDateKey();
  const defaultPastKey = format(subDays(parseDateKey(todayKey), 1), 'yyyy-MM-dd');

  const [dayPickerVisible, setDayPickerVisible] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState(defaultPastKey);
  const [rebuilding, setRebuilding] = useState(false);
  const [progress, setProgress] = useState<RebuildPastTripsProgress | null>(
    null,
  );

  const runRebuildAll = useCallback(async () => {
    setRebuilding(true);
    setProgress({completed: 0, total: 0, dateKey: ''});
    try {
      const result = await rebuildAllPastDayTrips(detectionConfig, setProgress);
      clearHistoryDataCache();
      Alert.alert(
        'Trips rebuilt',
        `Processed ${result.daysProcessed.toLocaleString()} past days and saved ${result.tripsSaved.toLocaleString()} trips with simplified routes.`,
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

  const runRebuildDay = useCallback(
    async (dateKey: string) => {
      if (dateKey >= todayKey) {
        Alert.alert(
          'Past days only',
          'Trip rebuild is available for past days. Today uses live GPS.',
        );
        return;
      }

      setRebuilding(true);
      setProgress({completed: 0, total: 1, dateKey});
      try {
        const tripsSaved = await rebuildPastDayTrips(dateKey, detectionConfig);
        clearHistoryDataCache();
        Alert.alert(
          'Day rebuilt',
          `Saved ${tripsSaved.toLocaleString()} trips for ${format(parseDateKey(dateKey), 'MMM d, yyyy')}.`,
        );
      } catch (error) {
        Alert.alert(
          'Could not rebuild day',
          error instanceof Error ? error.message : 'Something went wrong.',
        );
      } finally {
        setRebuilding(false);
        setProgress(null);
      }
    },
    [detectionConfig, todayKey],
  );

  const confirmRebuildAll = () => {
    Alert.alert(
      'Rebuild all past trips?',
      'This reads GPS for every past day, rebuilds visits and drives, and saves simplified map routes. Your raw location points are not deleted.\n\nThis runs now and may take a few minutes.',
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
              Recompute visits and drives from GPS, then save simplified routes
              for faster map loads on past days.
            </Text>
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

        <Pressable
          accessibilityRole="button"
          disabled={rebuilding}
          onPress={() => setDayPickerVisible(true)}
          className={`border-border mt-3 items-center rounded-full border px-4 py-3 ${
            rebuilding ? 'opacity-50' : ''
          }`}>
          <Text className="font-medium">Rebuild one day</Text>
        </Pressable>

        <Text variant="muted" className="mt-3 text-xs leading-4">
          On-demand only — shows progress while running. Today is excluded;
          open today on the map for live tracking.
        </Text>
      </View>

      <HistoryDatePickerSheet
        visible={dayPickerVisible}
        selectedDateKey={selectedDayKey}
        onSelectDate={dateKey => {
          setSelectedDayKey(dateKey);
          setDayPickerVisible(false);
          void runRebuildDay(dateKey);
        }}
        onClose={() => setDayPickerVisible(false)}
      />

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
