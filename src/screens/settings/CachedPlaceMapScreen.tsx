import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CachedPlaceMapView } from '@/components/settings/CachedPlaceMapView';
import { Text } from '@/components/ui/text';
import { getPlaceLookupById } from '@/db/repositories/place-lookup-cache';
import { listPlacePoisForCache } from '@/db/repositories/place-pois';
import type { RootStackScreenProps } from '@/navigation/types';
import type { PlaceLookupRow, PlacePoiRow } from '@/lib/place-lookup-types';

function mapScreenTitle(row: PlaceLookupRow | null): string {
  const address = row?.addressLine?.trim();
  if (address) {
    return address.length > 32 ? `${address.slice(0, 32)}…` : address;
  }
  return 'Cached place map';
}

export function CachedPlaceMapScreen({
  route,
  navigation,
}: RootStackScreenProps<'CachedPlaceMap'>) {
  const { cacheId } = route.params;
  const [cache, setCache] = useState<PlaceLookupRow | null>(null);
  const [pois, setPois] = useState<PlacePoiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [row, cachePois] = await Promise.all([
        getPlaceLookupById(cacheId),
        listPlacePoisForCache(cacheId),
      ]);
      if (row == null) {
        setCache(null);
        setPois([]);
        setErrorMessage('This cached place could not be found.');
        return;
      }
      setCache(row);
      setPois(cachePois);
    } catch (error) {
      setCache(null);
      setPois([]);
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load map.',
      );
    } finally {
      setLoading(false);
    }
  }, [cacheId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: mapScreenTitle(cache) });
  }, [cache, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : errorMessage != null || cache == null ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="muted" className="text-center text-sm leading-5">
            {errorMessage ?? 'Could not load map.'}
          </Text>
        </View>
      ) : (
        <CachedPlaceMapView
          anchor={{ lat: cache.anchorLat, lng: cache.anchorLng }}
          addressLabel={cache.addressLine}
          venueRadiusMeters={cache.venueRadiusMeters}
          pois={pois}
        />
      )}
    </SafeAreaView>
  );
}
