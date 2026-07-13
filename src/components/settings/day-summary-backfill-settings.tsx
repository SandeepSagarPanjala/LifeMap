import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, View } from 'react-native';
import { format } from 'date-fns';

import { Text } from '@/components/ui/text';
import { backfillMissingLocationDaySummaries } from '@/db/repositories/location-day-summaries';
import { startBackgroundWorkCycle } from '@/lib/background-work-coordinator';
import { errorMessageOr } from '@/lib/app-copy';
import { parseDateKey } from '@/lib/day-utils';
import { clearHistoryDataCache } from '@/lib/history-data-cache';

/**
 * Temporary one-time control for existing installs missing location_day_summaries
 * rows. Safe to delete after all legacy users have run it once.
 */
export function DaySummaryBackfillSettings() {
  const [running, setRunning] = useState(false);
  const [progressLabel, setProgressLabel] = useState('Preparing…');
  const [progressRatio, setProgressRatio] = useState(0);

  const runBackfill = useCallback(async () => {
    setRunning(true);
    setProgressLabel('Preparing…');
    setProgressRatio(0);
    try {
      const result = await backfillMissingLocationDaySummaries(progress => {
        setProgressLabel(format(parseDateKey(progress.dateKey), 'MMM d, yyyy'));
        setProgressRatio(
          progress.total > 0 ? progress.completed / progress.total : 0,
        );
      });

      clearHistoryDataCache();
      startBackgroundWorkCycle();

      if (result.daysFilled === 0) {
        Alert.alert(
          'Already up to date',
          result.daysWithGps === 0
            ? 'No GPS history found on this device.'
            : `All ${result.daysWithGps.toLocaleString()} days with GPS are already indexed.`,
        );
        return;
      }

      Alert.alert(
        'Day index updated',
        `Indexed ${result.daysFilled.toLocaleString()} day${
          result.daysFilled === 1 ? '' : 's'
        } with GPS. Past trips will build in the background.`,
      );
    } catch (error) {
      Alert.alert('Could not index days', errorMessageOr(error));
    } finally {
      setRunning(false);
      setProgressLabel('Preparing…');
      setProgressRatio(0);
    }
  }, []);

  const confirmBackfill = () => {
    Alert.alert(
      'Index past days?',
      'For existing installs only: scans your GPS history and adds any missing day index rows so past trips can build. Your location points are not changed.\n\nRun once, then you can ignore this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Index days',
          onPress: () => {
            void runBackfill();
          },
        },
      ],
    );
  };

  return (
    <>
      <View className="bg-card border-border mt-2 rounded-xl border px-4 py-4">
        <Text variant="muted" className="text-sm leading-5">
          Existing user? Tap once to index days that have GPS but were saved
          before day indexing shipped. New installs do this automatically.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={running}
          onPress={confirmBackfill}
          className={`bg-primary mt-4 items-center rounded-full px-4 py-3 ${
            running ? 'opacity-50' : ''
          }`}
        >
          <Text className="text-primary-foreground font-medium">
            Index past days
          </Text>
        </Pressable>
      </View>

      <Modal visible={running} transparent animationType="fade">
        <View className="flex-1 items-center justify-center bg-black/50 px-6">
          <View className="bg-card w-full max-w-sm rounded-2xl p-5">
            <Text className="text-center text-base font-semibold">
              Indexing days
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
                Working…
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
