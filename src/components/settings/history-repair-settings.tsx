import {useCallback, useState} from 'react';
import {ActivityIndicator, Alert, Pressable, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {RefreshCw} from 'lucide-react-native';

import {Icon} from '@/components/ui/icon';
import {Text} from '@/components/ui/text';
import {countMaterializedDays} from '@/db/repositories/materialized-days';
import {countAllTrips} from '@/db/repositories/trips';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {resetMaterializedTripHistory} from '@/lib/trip-materialization';

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
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [tripCount, setTripCount] = useState(0);
  const [materializedDayCount, setMaterializedDayCount] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [trips, days] = await Promise.all([
        countAllTrips(),
        countMaterializedDays(),
      ]);
      setTripCount(trips);
      setMaterializedDayCount(days);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

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
      await refresh();
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

      {loading ? (
        <ActivityIndicator className="mt-4" />
      ) : (
        <>
          <StatRow
            label="Saved trips"
            value={tripCount.toLocaleString()}
          />
          <StatRow
            label="Materialized days"
            value={materializedDayCount.toLocaleString()}
          />

          <Pressable
            accessibilityRole="button"
            disabled={resetting}
            onPress={confirmReset}
            className={`border-destructive mt-4 items-center rounded-full border px-4 py-3 ${
              resetting ? 'opacity-50' : ''
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
            Only cached trip summaries are removed. Location history and moments
            stay on this device.
          </Text>
        </>
      )}
    </View>
  );
}
