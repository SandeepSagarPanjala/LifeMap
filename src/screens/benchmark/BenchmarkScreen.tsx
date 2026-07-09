import { format, parseISO } from 'date-fns';
import { BoxSelect, ListOrdered, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BenchmarkMapView } from '@/components/benchmark/BenchmarkMapView';
import { HistoryDatePickerSheet } from '@/components/map/HistoryDatePickerSheet';
import { HistoryDayNav } from '@/components/map/HistoryDayNav';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { LocationPointRow } from '@/db/repositories/location-days';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  runPowerBenchmark,
  runStopsBenchmark,
  runTripsBenchmark,
  type BenchmarkMode,
  type PowerBenchmarkResult,
  type PowerDayFetchResult,
  type StopsBenchmarkResult,
  type TripsBenchmarkResult,
} from '@/lib/benchmark/benchmark-engine';
import { getTodayDateKey } from '@/lib/day-utils';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import { listBenchmarkDateKeys } from '@/lib/benchmark/list-benchmark-dates';
import {
  segmentToLocationRows,
  segmentsToLocationRows,
  sortLocationPointsByTime,
  stopToLocationRows,
} from '@/lib/benchmark/map-points';
import { describeTripSegment } from '@/lib/benchmark/segment-display';
import { formatDuration } from '@/lib/segmentation/stops';
import type { Stop } from '@/lib/segmentation/stops';
import type { TripSegment } from '@/lib/segmentation/trips';

type BenchmarkPanel = 'geometry' | 'results';

const MODES: { id: BenchmarkMode; label: string }[] = [
  { id: 'stops', label: 'Stops' },
  { id: 'trips', label: 'Trips' },
  { id: 'power', label: 'Power' },
];

const RAIL_PANELS: { id: BenchmarkPanel; icon: LucideIcon }[] = [
  { id: 'geometry', icon: BoxSelect },
  { id: 'results', icon: ListOrdered },
];

function formatDateLabel(dateKey: string): string {
  return format(parseISO(dateKey), 'MMM d, yyyy');
}

function formatRailGeometrySummary(
  canonicalizeStay: boolean,
  canonicalizeDrive: boolean,
): string {
  return String((canonicalizeStay ? 1 : 0) + (canonicalizeDrive ? 1 : 0));
}

function formatRailResultsSummary(
  mode: BenchmarkMode,
  stopsResult: StopsBenchmarkResult | null,
  tripsResult: TripsBenchmarkResult | null,
  powerResult: PowerBenchmarkResult | null,
): string {
  if (mode === 'stops' && stopsResult != null) {
    return String(stopsResult.stops.length);
  }
  if (mode === 'trips' && tripsResult != null) {
    return String(tripsResult.segments.length);
  }
  if (mode === 'power' && powerResult != null) {
    return `${Math.round(powerResult.algorithmElapsedMs)}ms`;
  }
  return '—';
}

function BenchmarkRail({
  active,
  onSelect,
  geometrySummary,
  resultsSummary,
}: {
  active: BenchmarkPanel;
  onSelect: (panel: BenchmarkPanel) => void;
  geometrySummary: string;
  resultsSummary: string;
}) {
  const colors = useThemeColors();

  const summaries: Record<BenchmarkPanel, string> = {
    geometry: geometrySummary,
    results: resultsSummary,
  };

  return (
    <View className="border-border w-[76px] border-l">
      {RAIL_PANELS.map(item => {
        const selected = item.id === active;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item.id)}
            className={`items-center justify-center gap-1 border-b px-1 py-3 ${
              selected
                ? 'bg-primary/10 border-l-2 border-l-primary'
                : 'border-border'
            }`}
          >
            <Icon
              as={item.icon}
              size={20}
              color={selected ? colors.primary : colors.mutedForeground}
            />
            <Text
              numberOfLines={2}
              className={`text-center text-[10px] font-semibold leading-tight ${
                selected ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {summaries[item.id]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BenchmarkModeBar({
  mode,
  onSelectMode,
}: {
  mode: BenchmarkMode;
  onSelectMode: (mode: BenchmarkMode) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {MODES.map(entry => {
        const active = mode === entry.id;
        return (
          <Pressable
            key={entry.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onSelectMode(entry.id)}
            className={`flex-1 items-center rounded-xl border py-2.5 ${
              active ? 'border-primary bg-primary/10' : 'border-border bg-card'
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                active ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              {entry.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function GeometryToggle({
  title,
  description,
  enabled,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      onPress={onToggle}
      className="bg-card border-border rounded-2xl border p-3"
    >
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text className="text-sm font-medium">{title}</Text>
          <Text variant="muted" className="mt-1">
            {description}
          </Text>
        </View>
        <View
          className={`h-6 w-11 rounded-full px-0.5 ${
            enabled ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <View
            className={`mt-0.5 h-5 w-5 rounded-full bg-white ${
              enabled ? 'ml-auto' : 'ml-0'
            }`}
          />
        </View>
      </View>
    </Pressable>
  );
}

function StopRow({
  stop,
  index,
  active,
  onPress,
}: {
  stop: Stop;
  index: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className={`rounded-2xl border p-3 ${
        active ? 'border-primary bg-primary/10' : 'border-border bg-card'
      }`}
    >
      <View className="flex-row items-center gap-2">
        <View className="bg-muted h-6 w-6 items-center justify-center rounded-full">
          <Text className="text-xs font-semibold">{index + 1}</Text>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium">
            {format(stop.arrivedAt, 'h:mm a')} – {format(stop.leftAt, 'h:mm a')}
          </Text>
          <Text variant="muted">
            {formatDuration(stop.durationMs)} · {stop.pointCount} pts · spread{' '}
            {Math.round(stop.spreadM)} m
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function StopsResults({
  result,
  selectedStopId,
  onToggleStop,
  onShowAll,
}: {
  result: StopsBenchmarkResult;
  selectedStopId: string | null;
  onToggleStop: (stopId: string) => void;
  onShowAll: () => void;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-1">
          <Text className="font-medium">Stops ({result.stops.length})</Text>
          <Text variant="muted">
            {result.points.length.toLocaleString()} GPS points
          </Text>
        </View>
        {selectedStopId != null ? (
          <Pressable accessibilityRole="button" onPress={onShowAll}>
            <Text className="text-sm text-primary">Show all</Text>
          </Pressable>
        ) : null}
      </View>
      {result.stops.length === 0 ? (
        <Text variant="muted">No stops ≥ 5 min found for this day.</Text>
      ) : (
        result.stops.map((stop, index) => (
          <StopRow
            key={stop.id}
            stop={stop}
            index={index}
            active={selectedStopId === stop.id}
            onPress={() => onToggleStop(stop.id)}
          />
        ))
      )}
    </View>
  );
}

function TripsResults({
  result,
  selectedSegmentId,
  onSelectSegment,
  onShowAll,
}: {
  result: TripsBenchmarkResult;
  selectedSegmentId: string | null;
  onSelectSegment: (segment: TripSegment) => void;
  onShowAll: () => void;
}) {
  return (
    <View className="gap-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-1">
          <Text className="font-medium">
            {result.segments.length} segments · {result.days.length}{' '}
            {result.days.length === 1 ? 'day' : 'days'}
          </Text>
          <Text variant="muted">
            {result.days
              .reduce((sum, day) => sum + day.windowPointCount, 0)
              .toLocaleString()}{' '}
            window pts
          </Text>
        </View>
        {selectedSegmentId != null ? (
          <Pressable accessibilityRole="button" onPress={onShowAll}>
            <Text className="text-sm text-primary">Show all</Text>
          </Pressable>
        ) : null}
      </View>
      {result.days.map(day => (
        <View key={day.dateKey} className="gap-2">
          <Text variant="small" className="text-muted-foreground">
            {formatDateLabel(day.dateKey)} ·{' '}
            {day.dayPointCount.toLocaleString()} day pts ·{' '}
            {day.windowPointCount.toLocaleString()} window pts ·{' '}
            {day.result.segments.length} segments
          </Text>
          {day.result.segments.map((segment, index) => {
            const display = describeTripSegment(segment);
            const active = selectedSegmentId === segment.id;
            return (
              <Pressable
                key={segment.id}
                accessibilityRole="button"
                onPress={() => onSelectSegment(segment)}
                className={`rounded-2xl border p-3 ${
                  active
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-card'
                }`}
              >
                <View className="flex-row items-center gap-2">
                  <View className="bg-muted h-6 w-6 items-center justify-center rounded-full">
                    <Text className="text-xs font-semibold">{index + 1}</Text>
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {display.kind}
                      </Text>
                      {display.subtitle ? (
                        <Text className="text-sm font-medium" numberOfLines={1}>
                          {display.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Text variant="muted">{display.timeRange}</Text>
                    <Text variant="muted">{display.stats.join(' · ')}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function PowerFetchCountRow({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text variant="muted">{label}</Text>
      <Text className="font-medium tabular-nums">{count.toLocaleString()}</Text>
    </View>
  );
}

function PowerResults({
  result,
  day,
  viewDateKey,
}: {
  result: PowerBenchmarkResult;
  day: PowerDayFetchResult | undefined;
  viewDateKey: string;
}) {
  const gpsPointTotal = day
    ? day.prevTripTrackCount + day.dayTripTrackCount + day.nextTripTrackCount
    : 0;
  const dayElapsedMs = day
    ? day.fetchElapsedMs +
      result.savedPlacesFetchElapsedMs +
      day.algorithmElapsedMs
    : result.elapsedMs;

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="font-medium">1. Fetch from DB</Text>
        <View className="bg-card border-border gap-2 rounded-2xl border p-3">
          {day == null ? (
            <Text variant="muted">No data for this day.</Text>
          ) : (
            <>
              <PowerFetchCountRow
                label={format(parseISO(day.prevDateKey), 'MMM d, yyyy')}
                count={day.prevTripTrackCount}
              />
              <PowerFetchCountRow
                label={format(parseISO(day.dateKey), 'MMM d, yyyy')}
                count={day.dayTripTrackCount}
              />
              <PowerFetchCountRow
                label={format(parseISO(day.nextDateKey), 'MMM d, yyyy')}
                count={day.nextTripTrackCount}
              />
            </>
          )}
          <View className="border-border gap-2 border-t pt-2">
            <PowerFetchCountRow
              label="Saved places"
              count={result.savedPlacesCount}
            />
            <PowerFetchCountRow label="Total" count={gpsPointTotal} />
          </View>
          <View className="border-border border-t pt-2">
            <View className="flex-row justify-between">
              <Text className="font-medium">Fetch total</Text>
              <Text className="font-semibold tabular-nums">
                {day != null
                  ? (
                      day.fetchElapsedMs + result.savedPlacesFetchElapsedMs
                    ).toFixed(2)
                  : result.fetchElapsedMs.toFixed(2)}{' '}
                ms
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View className="gap-2">
        <Text className="font-medium">2. Algorithm</Text>
        <View className="bg-card border-border rounded-2xl border p-4">
          <View className="flex-row justify-between">
            <Text variant="muted">
              detectTripsForDay ·{' '}
              {day != null ? day.segmentCount : result.segmentCount} segments
            </Text>
            <Text className="font-semibold tabular-nums">
              {(day?.algorithmElapsedMs ?? result.algorithmElapsedMs).toFixed(
                2,
              )}{' '}
              ms
            </Text>
          </View>
        </View>
      </View>

      <View className="bg-card border-border gap-2 rounded-2xl border p-4">
        <View className="flex-row justify-between">
          <Text className="font-medium">Total</Text>
          <Text className="font-semibold tabular-nums">
            {dayElapsedMs.toFixed(2)} ms
          </Text>
        </View>
        <Text className="font-medium">{formatDateLabel(viewDateKey)}</Text>
      </View>
    </View>
  );
}

export function BenchmarkScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [activePanel, setActivePanel] = useState<BenchmarkPanel>('results');
  const [availableDateKeys, setAvailableDateKeys] = useState<string[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [mode, setMode] = useState<BenchmarkMode>('power');
  const [running, setRunning] = useState(false);
  const [canonicalizeStayGeometry, setCanonicalizeStayGeometry] =
    useState(true);
  const [canonicalizeDriveGeometry, setCanonicalizeDriveGeometry] =
    useState(true);
  const [plottedPoints, setPlottedPoints] = useState<LocationPointRow[]>([]);
  const [mapStops, setMapStops] = useState<Stop[]>([]);
  const [stopsBaseline, setStopsBaseline] = useState<{
    points: LocationPointRow[];
    stops: Stop[];
  } | null>(null);
  const [tripBaseline, setTripBaseline] = useState<{
    points: LocationPointRow[];
    stops: Stop[];
  } | null>(null);
  const [stopsResult, setStopsResult] = useState<StopsBenchmarkResult | null>(
    null,
  );
  const [tripsResult, setTripsResult] = useState<TripsBenchmarkResult | null>(
    null,
  );
  const [powerResult, setPowerResult] = useState<PowerBenchmarkResult | null>(
    null,
  );
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingDates(true);
      try {
        await ensureHistoryCalendarBounds();
        const keys = await listBenchmarkDateKeys();
        if (!cancelled) {
          setAvailableDateKeys(keys);
          const today = getTodayDateKey();
          const defaultKey = keys.includes(today)
            ? today
            : keys.length > 0
            ? keys[keys.length - 1]!
            : null;
          if (defaultKey != null) {
            setSelectedDateKey(defaultKey);
          }
        }
      } finally {
        if (!cancelled) {
          setLoadingDates(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeDateKey = useMemo(() => {
    if (selectedDateKey != null) {
      return selectedDateKey;
    }
    const today = getTodayDateKey();
    return availableDateKeys.includes(today)
      ? today
      : availableDateKeys.at(-1) ?? today;
  }, [availableDateKeys, selectedDateKey]);

  const canRun = !running && activeDateKey != null;

  const geometryOptions = useMemo(
    () => ({
      canonicalizeStays: canonicalizeStayGeometry,
      canonicalizeDrives: canonicalizeDriveGeometry,
    }),
    [canonicalizeDriveGeometry, canonicalizeStayGeometry],
  );

  const buildTripPlot = useCallback(
    (result: TripsBenchmarkResult) =>
      sortLocationPointsByTime(
        segmentsToLocationRows(result.segments, geometryOptions),
      ),
    [geometryOptions],
  );

  const resetResults = useCallback(() => {
    setStopsResult(null);
    setTripsResult(null);
    setPowerResult(null);
    setSelectedStopId(null);
    setSelectedSegmentId(null);
    setPlottedPoints([]);
    setMapStops([]);
    setStopsBaseline(null);
    setTripBaseline(null);
    setError(null);
  }, []);

  const runBenchmarkForDate = useCallback(
    async (dateKey: string, benchmarkMode: BenchmarkMode) => {
      setRunning(true);
      setError(null);
      resetResults();
      try {
        if (benchmarkMode === 'stops') {
          const result = await runStopsBenchmark([dateKey]);
          setStopsResult(result);
          setPlottedPoints(result.points);
          setMapStops(result.stops);
          setStopsBaseline({ points: result.points, stops: result.stops });
        } else if (benchmarkMode === 'trips') {
          const result = await runTripsBenchmark([dateKey]);
          setTripsResult(result);
          const plotted = buildTripPlot(result);
          const stopsById = new Map<string, Stop>();
          for (const day of result.days) {
            for (const stop of day.result.stops) {
              stopsById.set(stop.id, stop);
            }
          }
          const stops = [...stopsById.values()];
          setPlottedPoints(plotted);
          setMapStops(stops);
          setTripBaseline({ points: plotted, stops });
        } else {
          const result = await runPowerBenchmark([dateKey]);
          setPowerResult(result);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Benchmark failed');
      } finally {
        setRunning(false);
      }
    },
    [buildTripPlot, resetResults],
  );

  const handleBenchmarkDateChange = useCallback(
    (dateKey: string) => {
      setSelectedDateKey(dateKey);
      if (mode === 'power' && powerResult != null && !running) {
        void runBenchmarkForDate(dateKey, 'power');
      } else if (mode !== 'power') {
        resetResults();
      }
    },
    [mode, powerResult, resetResults, runBenchmarkForDate, running],
  );

  const handleSelectMode = useCallback(
    (nextMode: BenchmarkMode) => {
      setMode(nextMode);
      resetResults();
    },
    [resetResults],
  );

  const powerDayResult = powerResult?.dayFetches.find(
    day => day.dateKey === activeDateKey,
  );

  const highlightedPointIds = useMemo(() => {
    if (selectedStopId == null) {
      return null;
    }
    if (mode === 'stops' && stopsBaseline != null) {
      const stop = stopsBaseline.stops.find(item => item.id === selectedStopId);
      if (stop == null) {
        return null;
      }
      if (canonicalizeStayGeometry) {
        const rows = stopToLocationRows(stop, stopsBaseline.points, {
          canonicalizeStays: true,
        });
        return new Set(rows.map(point => point.id));
      }
      return new Set(stop.pointIds);
    }
    const stop = mapStops.find(item => item.id === selectedStopId);
    return stop ? new Set(stop.pointIds) : null;
  }, [canonicalizeStayGeometry, mapStops, mode, selectedStopId, stopsBaseline]);

  const toggleStop = useCallback((stopId: string) => {
    setSelectedStopId(previous => (previous === stopId ? null : stopId));
  }, []);

  const showAllStops = useCallback(() => {
    setSelectedStopId(null);
    if (stopsBaseline != null) {
      setPlottedPoints(stopsBaseline.points);
      setMapStops(stopsBaseline.stops);
    }
  }, [stopsBaseline]);

  const showAllTrips = useCallback(() => {
    setSelectedSegmentId(null);
    setSelectedStopId(null);
    if (tripBaseline != null) {
      setPlottedPoints(tripBaseline.points);
      setMapStops(tripBaseline.stops);
    }
  }, [tripBaseline]);

  const handleSelectSegment = useCallback(
    (segment: TripSegment) => {
      if (selectedSegmentId === segment.id) {
        showAllTrips();
        return;
      }

      setSelectedSegmentId(segment.id);
      setPlottedPoints(segmentToLocationRows(segment, geometryOptions));

      if (segment.kind === 'stay') {
        setMapStops([segment.stop]);
        setSelectedStopId(segment.stop.id);
        return;
      }

      if (segment.kind === 'drive') {
        const context = [segment.fromStop, segment.toStop].filter(
          (stop): stop is Stop => stop != null,
        );
        setMapStops(context);
        setSelectedStopId(null);
        return;
      }

      setMapStops([]);
      setSelectedStopId(null);
    },
    [geometryOptions, selectedSegmentId, showAllTrips],
  );

  useEffect(() => {
    if (tripsResult == null || selectedSegmentId != null) {
      return;
    }
    const plotted = buildTripPlot(tripsResult);
    const stopsById = new Map<string, Stop>();
    for (const day of tripsResult.days) {
      for (const stop of day.result.stops) {
        stopsById.set(stop.id, stop);
      }
    }
    const stops = [...stopsById.values()];
    setPlottedPoints(plotted);
    setMapStops(stops);
    setTripBaseline({ points: plotted, stops });
  }, [
    buildTripPlot,
    canonicalizeDriveGeometry,
    canonicalizeStayGeometry,
    selectedSegmentId,
    tripsResult,
  ]);

  const handleRun = useCallback(() => {
    if (activeDateKey == null) {
      return;
    }
    void runBenchmarkForDate(activeDateKey, mode);
  }, [activeDateKey, mode, runBenchmarkForDate]);

  const actionLabel =
    mode === 'stops'
      ? 'Identify stops'
      : mode === 'trips'
      ? 'Identify trips'
      : 'Run power benchmark';

  const panelTitle = activePanel === 'geometry' ? 'Geometry' : 'Results';

  const hasResults =
    (mode === 'stops' && stopsResult != null) ||
    (mode === 'trips' && tripsResult != null) ||
    (mode === 'power' && powerResult != null);

  const railGeometrySummary = formatRailGeometrySummary(
    canonicalizeStayGeometry,
    canonicalizeDriveGeometry,
  );
  const railResultsSummary = formatRailResultsSummary(
    mode,
    stopsResult,
    tripsResult,
    powerResult,
  );

  return (
    <SafeAreaView className="bg-background flex-1" edges={['bottom']}>
      <View className="min-h-0 flex-[11] px-3 pb-2">
        {plottedPoints.length > 0 ? (
          <BenchmarkMapView
            points={plottedPoints}
            stops={mapStops}
            selectedStopId={selectedStopId}
            highlightedPointIds={highlightedPointIds}
            variant={mode === 'stops' ? 'stops' : 'trips'}
            className="flex-1 rounded-2xl"
          />
        ) : (
          <View className="bg-muted flex-1 items-center justify-center rounded-2xl">
            <Text variant="muted" className="text-sm">
              Map
            </Text>
          </View>
        )}
      </View>

      <View className="border-border min-h-0 flex-[9] flex-row border-t">
        <ScrollView
          className="min-h-0 flex-1"
          contentContainerClassName="gap-4 p-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-base font-semibold">{panelTitle}</Text>

          {activePanel === 'geometry' ? (
            <View className="gap-2">
              <GeometryToggle
                title="Canonical stay geometry"
                description="Centroid + arrival + departure (stops & stays)"
                enabled={canonicalizeStayGeometry}
                onToggle={() =>
                  setCanonicalizeStayGeometry(previous => !previous)
                }
              />
              <GeometryToggle
                title="Canonical drive geometry"
                description="Turn-anchored Douglas–Peucker (trips drives)"
                enabled={canonicalizeDriveGeometry}
                onToggle={() =>
                  setCanonicalizeDriveGeometry(previous => !previous)
                }
              />
            </View>
          ) : null}

          {activePanel === 'results' ? (
            <View className="gap-4">
              {loadingDates ? (
                <ActivityIndicator color={colors.primary} />
              ) : availableDateKeys.length === 0 ? (
                <Text variant="muted">No GPS data in the database yet.</Text>
              ) : (
                <HistoryDayNav
                  dateKey={activeDateKey}
                  onDateKeyChange={handleBenchmarkDateChange}
                  onOpenDatePicker={() => setDatePickerOpen(true)}
                />
              )}

              {error ? <Text className="text-destructive">{error}</Text> : null}

              {!hasResults && error == null && !running ? (
                <Text variant="muted">Pick a mode below and tap Identify.</Text>
              ) : null}

              {running ? <ActivityIndicator color={colors.primary} /> : null}

              {mode === 'stops' && stopsResult ? (
                <StopsResults
                  result={stopsResult}
                  selectedStopId={selectedStopId}
                  onToggleStop={toggleStop}
                  onShowAll={showAllStops}
                />
              ) : null}

              {mode === 'trips' && tripsResult ? (
                <TripsResults
                  result={tripsResult}
                  selectedSegmentId={selectedSegmentId}
                  onSelectSegment={handleSelectSegment}
                  onShowAll={showAllTrips}
                />
              ) : null}

              {mode === 'power' && powerResult ? (
                <PowerResults
                  result={powerResult}
                  day={powerDayResult}
                  viewDateKey={activeDateKey}
                />
              ) : null}

              <BenchmarkModeBar mode={mode} onSelectMode={handleSelectMode} />

              <Pressable
                accessibilityRole="button"
                disabled={!canRun}
                onPress={handleRun}
                className={`items-center rounded-2xl px-4 py-3.5 ${
                  canRun ? 'bg-primary' : 'bg-muted'
                }`}
              >
                {running ? (
                  <ActivityIndicator color={colors.primaryForeground} />
                ) : (
                  <Text
                    className={`font-semibold ${
                      canRun
                        ? 'text-primary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {actionLabel}
                  </Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        <BenchmarkRail
          active={activePanel}
          onSelect={setActivePanel}
          geometrySummary={railGeometrySummary}
          resultsSummary={railResultsSummary}
        />
      </View>

      <HistoryDatePickerSheet
        visible={datePickerOpen}
        selectedDateKey={activeDateKey}
        onSelectDate={handleBenchmarkDateChange}
        onClose={() => setDatePickerOpen(false)}
      />
    </SafeAreaView>
  );
}
