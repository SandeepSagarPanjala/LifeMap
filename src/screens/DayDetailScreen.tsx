import {format, parseISO} from 'date-fns';
import {ActivityIndicator, ScrollView, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useState} from 'react';

import {DayMapView} from '@/components/map/DayMapView';
import {LocationPointList} from '@/components/map/LocationPointList';
import {LocationPointSheet} from '@/components/map/LocationPointSheet';
import type {LocationPointRow} from '@/db/repositories/location-days';
import {useLocationPointsForDay} from '@/hooks/use-location-days';
import {calculatePathDistanceKm, formatDistance} from '@/lib/location-geo';
import type {RootStackScreenProps} from '@/navigation/types';
import {useAppStore} from '@/stores/app-store';
import {Text} from '@/components/ui/text';

export function DayDetailScreen({route}: RootStackScreenProps<'DayDetail'>) {
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const dateKey = route.params.date;
  const date = parseISO(dateKey);
  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');
  const {data: points, loading} = useLocationPointsForDay(dateKey);
  const [selectedPoint, setSelectedPoint] = useState<LocationPointRow | null>(null);

  const distanceLabel =
    points.length >= 2 ? formatDistance(calculatePathDistanceKm(points), distanceUnit) : null;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-8 pt-2"
        showsVerticalScrollIndicator={false}>
        <Text variant="muted" className="text-sm">
          {points.length} point{points.length === 1 ? '' : 's'}
          {distanceLabel ? ` · ${distanceLabel}` : ''}
        </Text>
        <Text variant="h4" className="mt-1 border-0 pb-0">
          {formattedDate}
        </Text>

        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <DayMapView
              className="mt-4"
              points={points}
              selectedPointId={selectedPoint?.id ?? null}
              onSelectPoint={setSelectedPoint}
            />
            <Text className="mt-6 mb-3 font-semibold">Points</Text>
            <LocationPointList
              points={points}
              selectedPointId={selectedPoint?.id ?? null}
              onSelectPoint={setSelectedPoint}
            />
          </>
        )}
      </ScrollView>

      <LocationPointSheet point={selectedPoint} onClose={() => setSelectedPoint(null)} />
    </SafeAreaView>
  );
}
