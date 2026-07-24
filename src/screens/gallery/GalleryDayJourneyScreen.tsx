import { useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { DayJourneyOverlay } from '@/components/map/DayJourneyOverlay';
import { useDayStoryStops } from '@/hooks/use-day-story-stops';
import { useHistoryForDay } from '@/hooks/use-history-data';
import { useSavedPlaces } from '@/hooks/use-saved-places';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useTripDetectionConfig } from '@/hooks/use-trip-detection-config';
import { formatGalleryDayLabel } from '@/lib/gallery-day-label';
import {
  regionForCoordinates,
  toMapCoordinates,
  type MapCoordinate,
} from '@/lib/location-geo';
import { mapProviderForPlatform } from '@/lib/map-provider';
import {
  resolveStayAnchorForOverride,
  type DetectedTrip,
} from '@/lib/trip-detection';
import type { RootStackParamList } from '@/navigation/types';

function journeyFitCoordinates(
  points: { lat: number; lng: number }[],
  stays: readonly DetectedTrip[],
): MapCoordinate[] {
  const fromPoints = toMapCoordinates(points);
  if (fromPoints.length > 0) {
    return fromPoints;
  }
  const fromStays: MapCoordinate[] = [];
  for (const stay of stays) {
    const anchor = resolveStayAnchorForOverride(stay);
    if (anchor != null) {
      fromStays.push({ latitude: anchor.lat, longitude: anchor.lng });
    }
  }
  return fromStays;
}

export function GalleryDayJourneyScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'GalleryDayJourney'>>();
  const dateKey = route.params.dateKey;
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const provider = useMemo(() => mapProviderForPlatform(), []);
  const tripConfig = useTripDetectionConfig();
  const { places: savedPlaces } = useSavedPlaces();
  const { data: historyData, loading, error } = useHistoryForDay(dateKey, {
    preferStored: true,
  });

  const dayLabel = useMemo(() => formatGalleryDayLabel(dateKey), [dateKey]);

  const stays = useMemo(
    (): DetectedTrip[] =>
      historyData.entries.filter(
        (entry): entry is DetectedTrip => entry.kind === 'stay',
      ),
    [historyData.entries],
  );

  const travels = useMemo(
    (): DetectedTrip[] =>
      historyData.entries.filter(
        (entry): entry is DetectedTrip => entry.kind === 'travel',
      ),
    [historyData.entries],
  );

  const dayStoryStops = useDayStoryStops(
    true,
    stays,
    savedPlaces,
    tripConfig.dwellRadiusMeters,
  );

  const fitCoordinates = useMemo(
    () => journeyFitCoordinates(historyData.points, stays),
    [historyData.points, stays],
  );

  const hasJourney =
    historyData.entries.length > 0 || historyData.points.length > 0;
  const showEmpty = !loading && !hasJourney;

  // Lock the first real fit for this dateKey. Never mount MapView on the
  // San Francisco fallback from regionForCoordinates([]).
  const lockedRegionRef = useRef<{ dateKey: string; region: Region } | null>(
    null,
  );
  if (lockedRegionRef.current?.dateKey !== dateKey) {
    lockedRegionRef.current = null;
  }
  if (lockedRegionRef.current == null && fitCoordinates.length > 0) {
    lockedRegionRef.current = {
      dateKey,
      region: regionForCoordinates(fitCoordinates),
    };
  }
  const mapRegion = lockedRegionRef.current?.region ?? null;

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {mapRegion != null ? (
        <MapView
          key={dateKey}
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={provider}
          initialRegion={mapRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
          userInterfaceStyle={colorScheme === 'dark' ? 'dark' : 'light'}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          <DayJourneyOverlay
            travels={travels}
            stops={dayStoryStops}
            tripConfig={tripConfig}
            savedPlaces={savedPlaces}
            fallbackPoints={historyData.points}
            historyEntries={historyData.entries}
          />
        </MapView>
      ) : null}

      <View
        pointerEvents="box-none"
        style={[styles.topChrome, { paddingTop: Math.max(insets.top, 12) }]}
      >
        <View
          style={[styles.titlePill, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        >
          <Text style={styles.titleText} numberOfLines={1}>
            {dayLabel}
          </Text>
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.bottomChrome,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={10}
          onPress={handleClose}
          style={[styles.closeButton, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
        >
          <X size={22} color="#fff" strokeWidth={2.25} />
        </Pressable>
      </View>

      {mapRegion == null && !showEmpty ? (
        <View pointerEvents="none" style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : null}

      {showEmpty ? (
        <View pointerEvents="none" style={styles.emptyOverlay}>
          <View
            style={[styles.emptyCard, { backgroundColor: 'rgba(0,0,0,0.55)' }]}
          >
            <Text style={styles.emptyTitle}>
              {error ?? 'No trips for this day'}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topChrome: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  bottomChrome: {
    position: 'absolute',
    right: 16,
    bottom: 0,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titlePill: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 9,
    maxWidth: '86%',
  },
  titleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyCard: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
