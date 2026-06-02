import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, Pressable, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {format, parseISO} from 'date-fns';
import {ChevronLeft, ChevronRight, Play, RotateCcw} from 'lucide-react-native';

import {DayMapView} from '@/components/map/DayMapView';
import {LocationPointSheet} from '@/components/map/LocationPointSheet';
import type {LocationPointRow} from '@/db/repositories/location-days';
import {useDaySummaries, useLocationPointsForDay} from '@/hooks/use-location-days';
import {getTodayDateKey} from '@/lib/day-utils';
import {calculatePathDistanceKm, formatDistance} from '@/lib/location-geo';
import {useAppStore} from '@/stores/app-store';
import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';

const PLAYBACK_INTERVAL_MS = 90;

export function MapScreen() {
  const colors = useThemeColors();
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const {data: daySummaries, loading: daysLoading} = useDaySummaries();
  const todayKey = getTodayDateKey();
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [selectedPoint, setSelectedPoint] = useState<LocationPointRow | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState<number | null>(null);

  const dateKeys = useMemo(() => {
    const keys = [todayKey, ...daySummaries.map(day => day.dateKey)];
    return Array.from(new Set(keys)).sort((a, b) => b.localeCompare(a));
  }, [daySummaries, todayKey]);

  const effectiveDateKey = useMemo(
    () => (dateKeys.includes(selectedDateKey) ? selectedDateKey : todayKey),
    [dateKeys, selectedDateKey, todayKey],
  );

  const selectedDateIndex = useMemo(
    () => dateKeys.findIndex(dateKey => dateKey === effectiveDateKey),
    [dateKeys, effectiveDateKey],
  );

  const {data: points, loading: pointsLoading} = useLocationPointsForDay(effectiveDateKey);

  const distanceLabel = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    return formatDistance(calculatePathDistanceKm(points), distanceUnit);
  }, [distanceUnit, points]);

  const loading = daysLoading || pointsLoading;
  const headerDate = format(parseISO(effectiveDateKey), 'EEEE, MMMM d');
  const hasPlayback = points.length > 1;
  const currentPlaybackPoint =
    playbackIndex != null && playbackIndex >= 0 && playbackIndex < points.length
      ? points[playbackIndex]
      : null;

  useEffect(() => {
    if (!isPlaying || !hasPlayback) {
      return;
    }

    const timer = setInterval(() => {
      setPlaybackIndex(previous => {
        const next = previous == null ? 0 : previous + 1;
        if (next >= points.length) {
          setIsPlaying(false);
          return points.length - 1;
        }
        return next;
      });
    }, PLAYBACK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [hasPlayback, isPlaying, points.length]);

  useEffect(() => {
    setIsPlaying(false);
    setPlaybackIndex(null);
    setSelectedPoint(null);
  }, [effectiveDateKey]);

  const goToPreviousDay = () => {
    if (selectedDateIndex >= dateKeys.length - 1 || isPlaying) {
      return;
    }
    setSelectedDateKey(dateKeys[selectedDateIndex + 1]!);
  };

  const goToNextDay = () => {
    if (selectedDateIndex <= 0 || isPlaying) {
      return;
    }
    setSelectedDateKey(dateKeys[selectedDateIndex - 1]!);
  };

  const handlePlay = () => {
    if (!hasPlayback) {
      return;
    }
    if (isPlaying) {
      return;
    }
    if (playbackIndex != null && playbackIndex >= points.length - 1) {
      setPlaybackIndex(0);
    } else if (playbackIndex == null) {
      setPlaybackIndex(0);
    }
    setSelectedPoint(null);
    setIsPlaying(true);
  };

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-1">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : points.length === 0 ? (
          <View className="flex-1">
            <DayMapView points={points} />
            <View className="absolute inset-x-4 top-3 rounded-2xl bg-black/55 px-4 py-3">
              <Text className="text-sm font-semibold text-white">{headerDate}</Text>
              <Text className="mt-1 text-xs text-white/80">No points yet for this day.</Text>
            </View>
            <View className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/60 px-4 py-3">
              <Text variant="muted" className="text-center leading-6 text-white/85">
                Start moving with tracking enabled to draw your journey.
              </Text>
              <View className="mt-3 flex-row items-center justify-between">
                <Pressable
                  accessibilityRole="button"
                  onPress={goToPreviousDay}
                  disabled={selectedDateIndex >= dateKeys.length - 1}
                  className="h-11 w-11 items-center justify-center rounded-full bg-white/15">
                  <ChevronLeft
                    size={22}
                    color={
                      selectedDateIndex >= dateKeys.length - 1 ? colors.mutedForeground : '#ffffff'
                    }
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={goToNextDay}
                  disabled={selectedDateIndex <= 0}
                  className="h-11 w-11 items-center justify-center rounded-full bg-white/15">
                  <ChevronRight
                    size={22}
                    color={selectedDateIndex <= 0 ? colors.mutedForeground : '#ffffff'}
                  />
                </Pressable>
                <View className="h-11 w-11 items-center justify-center rounded-full bg-white/10">
                  <Play size={20} color={colors.mutedForeground} />
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View className="flex-1">
            <DayMapView
              points={points}
              playbackIndex={playbackIndex}
              selectedPointId={selectedPoint?.id ?? null}
              onSelectPoint={isPlaying ? undefined : setSelectedPoint}
            />

            <View className="absolute inset-x-4 top-3 rounded-2xl bg-black/55 px-4 py-3">
              <Text className="text-sm font-semibold text-white">
                {headerDate}
                {distanceLabel ? ` · ${distanceLabel}` : ''}
              </Text>
              {currentPlaybackPoint ? (
                <Text className="mt-1 text-xs text-white/90">
                  {format(currentPlaybackPoint.timestamp, 'h:mm:ss a')}
                </Text>
              ) : null}
            </View>

            <View className="absolute inset-x-4 bottom-4 rounded-2xl bg-black/60 px-4 py-3">
              <View className="flex-row items-center justify-between">
                <Pressable
                  accessibilityRole="button"
                  onPress={goToPreviousDay}
                  disabled={selectedDateIndex >= dateKeys.length - 1 || isPlaying}
                  className="h-11 w-11 items-center justify-center rounded-full bg-white/15">
                  <ChevronLeft
                    size={22}
                    color={
                      selectedDateIndex >= dateKeys.length - 1 || isPlaying
                        ? colors.mutedForeground
                        : '#ffffff'
                    }
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={goToNextDay}
                  disabled={selectedDateIndex <= 0 || isPlaying}
                  className="h-11 w-11 items-center justify-center rounded-full bg-white/15">
                  <ChevronRight
                    size={22}
                    color={
                      selectedDateIndex <= 0 || isPlaying ? colors.mutedForeground : '#ffffff'
                    }
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handlePlay}
                  disabled={!hasPlayback || isPlaying}
                  className="h-11 w-11 items-center justify-center rounded-full bg-primary">
                  {playbackIndex != null && playbackIndex >= points.length - 1 ? (
                    <RotateCcw size={19} color="#ffffff" />
                  ) : (
                    <Play size={20} color={isPlaying || !hasPlayback ? colors.mutedForeground : '#ffffff'} />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>

      {!isPlaying ? <LocationPointSheet point={selectedPoint} onClose={() => setSelectedPoint(null)} /> : null}
    </SafeAreaView>
  );
}
