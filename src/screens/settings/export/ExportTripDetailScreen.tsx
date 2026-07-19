import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { listTripPointsByTripIds } from '@/db/repositories/trip-points';
import { listTripsForDay, type TripRow } from '@/db/repositories/trips';
import { useAppStore } from '@/stores/app-store';
import {
  buildExportTripView,
  driveRouteLabelsFromDayTrips,
  exportTripKindLabel,
  exportTripViewJson,
  formatExportDateKeyLabel,
  labelFromTripRow,
  type ExportTripView,
} from '@/lib/export-trip-view';
import { shareJsonFile } from '@/lib/share-json-file';
import type { RootStackParamList } from '@/navigation/types';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_TIMEZONE } from '@/lib/timezone';

type Route = RouteProp<RootStackParamList, 'ExportTripDetail'>;

const POINT_PREVIEW_LIMIT = 24;

export function ExportTripDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<Route>();
  const colors = useThemeColors();
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const { dateKey } = route.params;
  const tripIndex = Math.max(0, route.params.tripIndex);

  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllPoints, setShowAllPoints] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    try {
      const dayTrips = await listTripsForDay(dateKey);
      setTrips(dayTrips);
      if (dayTrips.length === 0) {
        return;
      }
      const safeIndex = Math.min(tripIndex, dayTrips.length - 1);
      if (safeIndex !== tripIndex) {
        navigation.setParams({ tripIndex: safeIndex });
      }
    } finally {
      setLoading(false);
    }
  }, [dateKey, navigation, tripIndex]);

  useEffect(() => {
    void loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    setShowAllPoints(false);
    setShowRawJson(false);
  }, [tripIndex, dateKey]);

  const currentTrip = trips[tripIndex] ?? null;
  const driveRoute =
    currentTrip?.kind === 'travel'
      ? driveRouteLabelsFromDayTrips(trips, tripIndex)
      : null;
  const [tripView, setTripView] = useState<ExportTripView | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    if (currentTrip == null) {
      setTripView(null);
      return;
    }
    let cancelled = false;
    setViewLoading(true);
    void (async () => {
      const pointsByTripId = await listTripPointsByTripIds([currentTrip.id]);
      if (cancelled) {
        return;
      }
      const points = pointsByTripId.get(currentTrip.id) ?? [];
      setTripView(buildExportTripView(currentTrip, points, distanceUnit));
      setViewLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTrip, distanceUnit]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: formatExportDateKeyLabel(dateKey),
      headerBackTitle: 'Days',
    });
  }, [dateKey, navigation]);

  const canGoPrev = tripIndex > 0;
  const canGoNext = tripIndex < trips.length - 1;

  const visiblePoints = useMemo(() => {
    if (tripView == null) {
      return [];
    }
    if (showAllPoints) {
      return tripView.points;
    }
    return tripView.points.slice(0, POINT_PREVIEW_LIMIT);
  }, [showAllPoints, tripView]);

  const shareTrip = async () => {
    if (tripView == null) {
      return;
    }
    try {
      await shareJsonFile(
        `trip-${tripView.id}-${tripView.dateKey}.json`,
        exportTripViewJson(tripView),
      );
    } catch (error) {
      Alert.alert(
        'Could not share',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </SafeAreaView>
    );
  }

  if (trips.length === 0 || currentTrip == null) {
    return (
      <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
        <View className="flex-1 items-center justify-center px-8">
          <Text variant="muted" className="text-center text-sm leading-5">
            No trips for {dateKey}.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <View className="border-border border-b px-4 py-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-semibold">
              Segment {tripIndex + 1} of {trips.length}
            </Text>
            <Text variant="muted" className="mt-0.5 text-xs">
              {exportTripKindLabel(currentTrip.kind)}
              {currentTrip.kind === 'travel' && driveRoute?.routeTitle != null
                ? ` · ${driveRoute.routeTitle}`
                : currentTrip.placeLabel != null
                ? ` · ${labelFromTripRow(currentTrip)}`
                : ''}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => void shareTrip()}
            className="border-border rounded-full border px-3 py-1.5"
          >
            <View className="flex-row items-center gap-1.5">
              <Icon as={Share2} size={14} color={colors.primary} />
              <Text className="text-primary text-xs font-medium">Share</Text>
            </View>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3"
          contentContainerClassName="gap-2 pr-2"
        >
          {trips.map((trip, index) => {
            const active = index === tripIndex;
            return (
              <Pressable
                key={trip.id}
                accessibilityRole="button"
                onPress={() => navigation.setParams({ tripIndex: index })}
                className={`rounded-full border px-3 py-1.5 ${
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    active ? 'text-primary' : ''
                  }`}
                >
                  {index + 1}. {exportTripKindLabel(trip.kind)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {viewLoading || tripView == null ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-4"
          showsVerticalScrollIndicator={false}
        >
          <TripKindBadge kind={tripView.kind} />
          <DetailSection title="Timing">
            <TimeField label="Start" value={tripView.startAt} />
            <TimeField label="End" value={tripView.endAt} />
            <TimeField label="Closed at" value={tripView.closedAt} />
            <DetailRow label="Duration" value={tripView.duration} />
          </DetailSection>

          <DetailSection title="Segment">
            <DetailRow
              label="Kind"
              value={exportTripKindLabel(tripView.kind)}
            />
            <DetailRow
              label="Order"
              value={`#${tripView.segmentOrder} on ${tripView.dateKey}`}
            />
            <DetailRow label="Distance" value={tripView.distance} />
            <DetailRow
              label="Centroid"
              value={`${tripView.centroid.lat.toFixed(
                5,
              )}, ${tripView.centroid.lng.toFixed(5)}`}
            />
            <DetailRow
              label="Inferred"
              value={tripView.inferred ? 'Yes' : 'No'}
            />
            <DetailRow
              label="Detection version"
              value={String(tripView.detectionVersion)}
            />
          </DetailSection>

          <DetailSection title="Place">
            {tripView.kind === 'travel' ? (
              <>
                <Text variant="muted" className="mb-2 text-xs leading-4">
                  Drive rows do not store a single place in the trips table. The
                  map title comes from the stays before and after this segment.
                </Text>
                <DetailRow
                  label="From (previous stay)"
                  value={driveRoute?.fromLabel ?? '—'}
                />
                <DetailRow
                  label="To (next stay)"
                  value={driveRoute?.toLabel ?? '—'}
                />
                <DetailRow label="Stored place label" value="—" />
              </>
            ) : (
              <>
                <DetailRow label="Label" value={tripView.placeLabel ?? '—'} />
                <DetailRow
                  label="Place id"
                  value={
                    tripView.placeId != null ? String(tripView.placeId) : '—'
                  }
                />
                <DetailRow
                  label="Place kind"
                  value={tripView.placeKind ?? '—'}
                />
                <DetailRow label="POI" value={tripView.poiLabel ?? '—'} />
                <DetailRow
                  label="POI id"
                  value={tripView.poiId != null ? String(tripView.poiId) : '—'}
                />
              </>
            )}
          </DetailSection>

          <DetailSection title="Identifiers">
            <DetailRow label="Trip id" value={String(tripView.id)} />
            <DetailRow label="Event key" value={tripView.eventKey} mono />
            <DetailRow
              label="Moment refs"
              value={
                tripView.momentRefs.length > 0
                  ? JSON.stringify(tripView.momentRefs)
                  : '—'
              }
              mono
            />
          </DetailSection>

          <DetailSection
            title={`Route points (${tripView.pointCount.toLocaleString()})`}
          >
            {tripView.pointCount === 0 ? (
              <Text variant="muted" className="text-xs leading-4">
                No stored geometry for this segment.
              </Text>
            ) : (
              <>
                {visiblePoints.map(point => (
                  <View
                    key={point.id}
                    className="border-border mb-2 rounded-xl border px-3 py-2"
                  >
                    <Text className="text-xs font-medium">
                      #{point.seq} · {point.lat.toFixed(5)},{' '}
                      {point.lng.toFixed(5)}
                    </Text>
                    {point.recordedAt != null ? (
                      <Text
                        variant="muted"
                        className="mt-1 text-[11px] leading-4"
                      >
                        {point.recordedAt.local}
                      </Text>
                    ) : null}
                    <Text
                      variant="muted"
                      className="mt-0.5 text-[11px] leading-4"
                    >
                      source {point.source ?? '—'} · gps #
                      {point.locationPointId ?? '—'}
                      {point.momentId != null
                        ? ` · moment ${point.momentId}`
                        : ''}
                    </Text>
                  </View>
                ))}
                {tripView.pointCount > POINT_PREVIEW_LIMIT ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setShowAllPoints(value => !value)}
                    className="border-border self-start rounded-full border px-3 py-1.5"
                  >
                    <Text className="text-xs font-medium">
                      {showAllPoints
                        ? 'Show fewer points'
                        : `Show all ${tripView.pointCount.toLocaleString()} points`}
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </DetailSection>

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowRawJson(value => !value)}
            className="border-border mt-2 self-start rounded-full border px-3 py-1.5"
          >
            <Text className="text-xs font-medium">
              {showRawJson ? 'Hide raw JSON' : 'Show raw JSON'}
            </Text>
          </Pressable>

          {showRawJson ? (
            <View className="bg-muted/40 border-border mt-3 rounded-xl border p-3">
              <Text className="font-mono text-[10px] leading-4" selectable>
                {exportTripViewJson(tripView)}
              </Text>
            </View>
          ) : null}

          <Text variant="muted" className="mt-4 text-[11px] leading-4">
            Local times use {APP_TIMEZONE}. UTC values are included in raw JSON.
          </Text>
        </ScrollView>
      )}

      <View className="border-border bg-card border-t px-4 py-3">
        <View className="flex-row items-center gap-3">
          <NavButton
            label="Previous"
            icon={ChevronLeft}
            disabled={!canGoPrev}
            onPress={() =>
              navigation.setParams({ tripIndex: Math.max(0, tripIndex - 1) })
            }
          />
          <View className="flex-1 items-center">
            <Text className="text-xs font-medium">
              {tripIndex + 1} / {trips.length}
            </Text>
          </View>
          <NavButton
            label="Next"
            icon={ChevronRight}
            iconAfter
            disabled={!canGoNext}
            onPress={() =>
              navigation.setParams({
                tripIndex: Math.min(trips.length - 1, tripIndex + 1),
              })
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

function TripKindBadge({ kind }: { kind: TripRow['kind'] }) {
  const className =
    kind === 'stay'
      ? 'bg-primary/15 border-primary/30'
      : kind === 'travel'
      ? 'bg-sky-500/15 border-sky-500/30'
      : 'bg-amber-500/15 border-amber-500/30';
  const textClass =
    kind === 'stay'
      ? 'text-primary'
      : kind === 'travel'
      ? 'text-sky-700 dark:text-sky-300'
      : 'text-amber-700 dark:text-amber-300';

  return (
    <View
      className={`mb-4 self-start rounded-full border px-3 py-1 ${className}`}
    >
      <Text className={`text-xs font-semibold uppercase ${textClass}`}>
        {exportTripKindLabel(kind)}
      </Text>
    </View>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold">{title}</Text>
      <View className="border-border bg-card gap-2 rounded-2xl border p-3">
        {children}
      </View>
    </View>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View className="gap-0.5">
      <Text variant="muted" className="text-[11px] font-medium uppercase">
        {label}
      </Text>
      <Text
        className={`text-sm leading-5 ${mono ? 'font-mono text-xs' : ''}`}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

function TimeField({
  label,
  value,
}: {
  label: string;
  value: { local: string; utc: string };
}) {
  return (
    <View className="gap-0.5">
      <Text variant="muted" className="text-[11px] font-medium uppercase">
        {label}
      </Text>
      <Text className="text-sm leading-5" selectable>
        {value.local}
      </Text>
      <Text
        variant="muted"
        className="font-mono text-[11px] leading-4"
        selectable
      >
        UTC {value.utc}
      </Text>
    </View>
  );
}

function NavButton({
  label,
  icon,
  iconAfter = false,
  disabled,
  onPress,
}: {
  label: string;
  icon: typeof ChevronLeft;
  iconAfter?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      className={`border-border flex-1 flex-row items-center justify-center gap-1 rounded-xl border px-3 py-2.5 ${
        disabled ? 'opacity-40' : ''
      }`}
    >
      {!iconAfter ? (
        <Icon as={icon} size={16} color={colors.foreground} />
      ) : null}
      <Text className="text-sm font-medium">{label}</Text>
      {iconAfter ? (
        <Icon as={icon} size={16} color={colors.foreground} />
      ) : null}
    </Pressable>
  );
}
