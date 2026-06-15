import {useCallback, useEffect, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, View} from 'react-native';
import {RefreshCw} from 'lucide-react-native';

import {SettingsStatsRefreshBar} from '@/components/settings/settings-stats-refresh-bar';
import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {vacuumDatabase} from '@/db/repositories/storage-stats';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {formatStorageBytes} from '@/lib/format-storage';
import {
  computeAndCacheHistoryRepairStats,
  loadCachedHistoryRepairStats,
  type HistoryRepairStats,
} from '@/lib/settings-stats';
import {
  purgeLegacyMotionLocationData,
  resetMaterializedTripHistory,
} from '@/lib/trip-materialization';

function StatRow({label, value}: {label: string; value: string}) {
  return (
    <View className="border-border mt-3 flex-row items-center justify-between border-t pt-3">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <Text className="text-sm font-semibold">{value}</Text>
    </View>
  );
}

export function HistoryRepairSettings() {
  const colors = useThemeColors();
  const [calculating, setCalculating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [purgingMotion, setPurgingMotion] = useState(false);
  const [stats, setStats] = useState<HistoryRepairStats | null>(null);
  const [calculatedAt, setCalculatedAt] = useState<Date | null>(null);

  const loadCache = useCallback(async () => {
    const cached = await loadCachedHistoryRepairStats();
    if (cached == null) {
      setStats(null);
      setCalculatedAt(null);
      return;
    }
    setStats(cached.payload);
    setCalculatedAt(cached.calculatedAt);
  }, []);

  const calculate = useCallback(async () => {
    setCalculating(true);
    try {
      const result = await computeAndCacheHistoryRepairStats();
      setStats(result.payload);
      setCalculatedAt(result.calculatedAt);
      return result.payload;
    } finally {
      setCalculating(false);
    }
  }, []);

  useEffect(() => {
    void loadCache();
  }, [loadCache]);

  const confirmReset = () => {
    Alert.alert(
      'Rebuild visit & drive history?',
      'This deletes saved trip rows from your device and rebuilds orange visits and blue drives from your GPS and moments.\n\nYour location points and moments are not deleted. You may need to pick visit names again.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Rebuild history',
          style: 'destructive',
          onPress: () => {
            void runReset();
          },
        },
      ],
    );
  };

  const runReset = async () => {
    setResetting(true);
    try {
      const result = await resetMaterializedTripHistory();
      await calculate();
      Alert.alert(
        'History rebuilt',
        `Removed ${result.tripsDeleted.toLocaleString()} saved trips. Open the map and browse your days — visits and drives will rebuild with the latest rules.`,
      );
    } catch (error) {
      Alert.alert(
        'Could not rebuild history',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setResetting(false);
    }
  };

  const confirmPurgeMotion = () => {
    const motionPointCount = stats?.motionPointCount ?? 0;
    Alert.alert(
      'Remove motion location rows?',
      `This deletes ${motionPointCount.toLocaleString()} legacy motion rows from your device. Real GPS points are kept.\n\nCached visits and drives will rebuild from the remaining GPS trail.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove motion rows',
          style: 'destructive',
          onPress: () => {
            void runPurgeMotion();
          },
        },
      ],
    );
  };

  const runPurgeMotion = async () => {
    setPurgingMotion(true);
    try {
      const result = await purgeLegacyMotionLocationData();
      if (result.motionPointsDeleted > 0) {
        const compacted = await vacuumDatabase();
        await calculate();
        Alert.alert(
          'Motion rows removed',
          `Deleted ${result.motionPointsDeleted.toLocaleString()} motion rows and cleared ${result.tripsDeleted.toLocaleString()} cached trips.\n\nDatabase compacted from ${formatStorageBytes(compacted.beforeBytes)} to ${formatStorageBytes(compacted.afterBytes)}.`,
        );
        return;
      }
      await calculate();
      Alert.alert(
        'Motion rows removed',
        `Deleted ${result.motionPointsDeleted.toLocaleString()} motion rows and cleared ${result.tripsDeleted.toLocaleString()} cached trips. Open the map to rebuild your day from GPS.`,
      );
    } catch (error) {
      Alert.alert(
        'Could not remove motion rows',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setPurgingMotion(false);
    }
  };

  const tripCount = stats?.tripCount ?? 0;
  const materializedDayCount = stats?.materializedDayCount ?? 0;
  const motionPointCount = stats?.motionPointCount ?? 0;
  const actionsDisabled = calculating || resetting || purgingMotion;

  return (
    <View className="bg-card border-border rounded-2xl border p-4">
      <View className="flex-row items-center gap-3">
        <Icon as={RefreshCw} size={20} color={colors.primary} />
        <View className="flex-1">
          <Text className="font-medium">Fix past visits & drives</Text>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            If history looks split or wrong, clear cached trips and rebuild from
            your saved GPS and moments.
          </Text>
        </View>
      </View>

      <SettingsStatsRefreshBar
        calculatedAt={calculatedAt}
        calculating={calculating}
        onCalculate={() => void calculate()}
      />

      {stats != null ? (
        <>
          <StatRow label="Saved trips" value={tripCount.toLocaleString()} />
          <StatRow
            label="Materialized days"
            value={materializedDayCount.toLocaleString()}
          />
          <StatRow
            label="Legacy motion rows"
            value={motionPointCount.toLocaleString()}
          />

          {motionPointCount > 0 ? (
            <Pressable
              accessibilityRole="button"
              disabled={actionsDisabled}
              onPress={confirmPurgeMotion}
              className={`border-destructive mt-4 items-center rounded-full border px-4 py-3 ${
                actionsDisabled ? 'opacity-50' : ''
              }`}>
              {purgingMotion ? (
                <ActivityIndicator />
              ) : (
                <Text className="text-destructive font-medium">
                  Remove motion location rows
                </Text>
              )}
            </Pressable>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={actionsDisabled}
            onPress={confirmReset}
            className={`border-destructive mt-4 items-center rounded-full border px-4 py-3 ${
              actionsDisabled ? 'opacity-50' : ''
            }`}>
            {resetting ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-destructive font-medium">
                Rebuild visit & drive history
              </Text>
            )}
          </Pressable>

          <Text variant="muted" className="mt-3 text-xs leading-4">
            Motion rows were duplicate saves from an old bug and are no longer
            recorded. Remove them to shrink storage. Rebuild history only fixes
            orange/blue cards — it does not delete GPS or motion rows.
          </Text>
        </>
      ) : null}
    </View>
  );
}
