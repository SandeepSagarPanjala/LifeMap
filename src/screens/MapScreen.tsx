import {useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {format, parseISO} from 'date-fns';

import {DayMapView} from '@/components/map/DayMapView';
import {DayPickerStrip} from '@/components/map/DayPickerStrip';
import {LocationPointSheet} from '@/components/map/LocationPointSheet';
import type {LocationPointRow} from '@/db/repositories/location-days';
import {useDaySummaries, useLocationPointsForDay} from '@/hooks/use-location-days';
import {getTodayDateKey} from '@/lib/day-utils';
import {calculatePathDistanceKm, formatDistance} from '@/lib/location-geo';
import type {RootStackParamList} from '@/navigation/types';
import {Text} from '@/components/ui/text';

export function MapScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {data: daySummaries, loading: daysLoading} = useDaySummaries();
  const [selectedDateKey, setSelectedDateKey] = useState(getTodayDateKey());
  const [selectedPoint, setSelectedPoint] = useState<LocationPointRow | null>(null);

  const effectiveDateKey = useMemo(() => {
    if (daySummaries.length === 0) {
      return selectedDateKey;
    }
    if (daySummaries.some(day => day.dateKey === selectedDateKey)) {
      return selectedDateKey;
    }
    return daySummaries[0]!.dateKey;
  }, [daySummaries, selectedDateKey]);

  const {data: points, loading: pointsLoading} = useLocationPointsForDay(effectiveDateKey);

  const distanceLabel = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    return formatDistance(calculatePathDistanceKm(points));
  }, [points]);

  const loading = daysLoading || pointsLoading;
  const headerDate = format(parseISO(effectiveDateKey), 'EEEE, MMMM d');

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1 px-5 pt-4">
        <Text variant="h3" className="text-left">
          Map
        </Text>
        <Text variant="muted" className="mt-1">
          {headerDate}
          {distanceLabel ? ` · ${distanceLabel}` : ''}
        </Text>

        <View className="mt-4">
          <DayPickerStrip
            days={daySummaries}
            selectedDateKey={effectiveDateKey}
            onSelect={setSelectedDateKey}
          />
        </View>

        {loading ? (
          <View className="mt-6 flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : points.length === 0 ? (
          <View className="bg-card border-border mt-6 flex-1 items-center justify-center rounded-2xl border px-6">
            <Text variant="muted" className="text-center leading-6">
              No path for this day yet. Keep tracking enabled and check back after you move.
            </Text>
          </View>
        ) : (
          <View className="mt-4 flex-1">
            <DayMapView
              points={points}
              selectedPointId={selectedPoint?.id ?? null}
              onSelectPoint={setSelectedPoint}
            />
            <Pressable
              accessibilityRole="button"
              className="mt-4 py-2"
              onPress={() => navigation.navigate('DayDetail', {date: effectiveDateKey})}>
              <Text className="text-primary text-center text-sm font-medium">
                Open full day view
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <LocationPointSheet point={selectedPoint} onClose={() => setSelectedPoint(null)} />
    </SafeAreaView>
  );
}
