import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronLeft, ListFilter, Map as MapIcon, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { InsightSegmentBar } from '@/components/capture/InsightSegmentBar';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import { listSleepSessionsOverlapping } from '@/db/repositories/health';
import { listSavedPlaces } from '@/db/repositories/saved-places';
import {
  listAllTrips,
  listTripDaySummaries,
  listTripsForDateKeyRange,
} from '@/db/repositories/trips';
import { maxGpsSpeedMsForTripIds } from '@/db/repositories/trip-points';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import {
  getHealthKitMasterEnabled,
  getHealthKitSleepEnabled,
} from '@/lib/healthkit/settings';
import { formatDistance, type DistanceUnit } from '@/lib/location-geo';
import {
  contextFromFilterOption,
  defaultMapInsightFilterOption,
  listMapInsightFilterOptions,
  listWeekOptionsForMonth,
  mapInsightMonthBarLabel,
  mapInsightWeekBarLabel,
  mapInsightYearBarLabel,
  mapInsightYearFilterAvailable,
  monthKeyFromDateKey,
  parseMonthKeyToDate,
  pickWeekOptionWithData,
  resolveFilterForTabChange,
  resolveMapInsightFilterBounds,
  type MapInsightFilterOption,
  type MapInsightTab,
} from '@/lib/map/map-insight-period-options';
import {
  buildMapInsightsSummary,
  mapInsightFetchStartForRange,
  type MapFrequentTravel,
  type MapInsightPeriod,
  type MapInsightsSummary,
  type MapNewPlaceRow,
  type MapPlaceTimeRow,
  type MapTopPlaceRow,
} from '@/lib/map/map-insights';
import {
  buildMapOverviewInsights,
  withCommuteGpsTopSpeed,
  type MapOverviewDrillKind,
  type MapOverviewInsights,
} from '@/lib/map/map-overview-insights';
import { formatTimeMinutes } from '@/lib/notifications/schedule-math';
import { formatTripDuration } from '@/lib/trip-format';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';
import { useAppStore } from '@/stores/app-store';

const THEME = {
  tint: '#F0FDFA',
  strong: '#0D9488',
  soft: '#99F6E4',
  chipBg: '#CCFBF1',
};

const FILTER_BUTTON_SIZE = 36;

/** Survives leaving Map for other insight categories in the same session. */
let persistedMapInsightTab: MapInsightTab = 'week';
let persistedMapInsightFilter: MapInsightFilterOption | null =
  defaultMapInsightFilterOption('week');
let persistedWeekFocus: MapInsightFilterOption =
  defaultMapInsightFilterOption('week');

function tabToSummaryPeriod(tab: MapInsightTab): MapInsightPeriod | null {
  if (tab === 'overview') {
    return null;
  }
  return tab;
}

function weekFocusFromSelection(
  selection: MapInsightFilterOption | null,
  dateKeysWithData: readonly string[],
  fallback: MapInsightFilterOption,
): MapInsightFilterOption {
  if (selection == null) {
    return fallback;
  }
  if (selection.weekIndex != null) {
    return selection;
  }
  // Year range starts Jan 1 — do not drag Month/Week chrome to January.
  if (selection.id.startsWith('year:')) {
    return fallback;
  }
  const monthKey = monthKeyFromDateKey(selection.startDateKey);
  const weeks = listWeekOptionsForMonth(parseMonthKeyToDate(monthKey));
  // Keep the same Week N when changing month if that week still has data.
  return pickWeekOptionWithData({
    weeks,
    dateKeysWithData,
    preferredWeekIndex: fallback.weekIndex ?? null,
    preferredWeekStartKey: fallback.startDateKey,
  });
}
function WidgetCard({
  title,
  children,
  tint,
  accent,
}: {
  title: string;
  children: ReactNode;
  tint: string;
  accent: string;
}) {
  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.widget, { backgroundColor: tint }]}
    >
      <Text style={[styles.widgetTitle, { color: accent }]}>{title}</Text>
      {children}
    </Animated.View>
  );
}

function StatCell({
  label,
  value,
  muted,
  foreground,
  highlight,
  onPress,
}: {
  label: string;
  value: string;
  muted: string;
  foreground: string;
  /** Clickable values use highlight; averages stay on foreground. */
  highlight?: string;
  onPress?: () => void;
}) {
  const valueColor = onPress != null && highlight != null ? highlight : foreground;
  const body = (
    <>
      <Text style={[styles.statLabel, { color: muted }]} numberOfLines={1}>
        {label}
      </Text>
      <RNText
        style={[styles.statValue, { color: valueColor }]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {value}
      </RNText>
    </>
  );

  if (onPress != null) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.statCell}
      >
        {body}
      </Pressable>
    );
  }

  return <View style={styles.statCell}>{body}</View>;
}

function OverviewSection({
  title,
  accent,
  children,
}: {
  title: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.overviewSection}>
      <Text style={[styles.overviewSectionTitle, { color: accent }]}>
        {title}
      </Text>
      <View style={styles.statsGrid}>{children}</View>
    </View>
  );
}

function PlaceRow({
  title,
  meta,
  value,
  muted,
  foreground,
}: {
  title: string;
  meta: string;
  value: string;
  muted: string;
  foreground: string;
}) {
  return (
    <View style={styles.listRow}>
      <View style={styles.listRowText}>
        <Text style={[styles.listRowTitle, { color: foreground }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.listRowMeta, { color: muted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <RNText
        style={[styles.listRowValue, { color: foreground }]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {value}
      </RNText>
    </View>
  );
}

function placeTimeLabel(place: MapPlaceTimeRow): string {
  if (place.kind === 'home') {
    return APP_COPY.mapInsights.atHome;
  }
  if (place.kind === 'work') {
    return APP_COPY.mapInsights.atWork;
  }
  return place.label;
}

function formatSignedDuration(deltaMs: number): string {
  const abs = formatTripDuration(Math.abs(deltaMs));
  if (deltaMs > 0) {
    return `+${abs}`;
  }
  if (deltaMs < 0) {
    return `−${abs}`;
  }
  return abs;
}

function formatSignedDistance(
  deltaKm: number,
  distanceUnit: 'km' | 'mi',
): string {
  const abs = formatDistance(Math.abs(deltaKm), distanceUnit);
  if (deltaKm > 0) {
    return `+${abs}`;
  }
  if (deltaKm < 0) {
    return `−${abs}`;
  }
  return abs;
}

function formatSpeedKmh(kmh: number, unit: DistanceUnit): string {
  if (unit === 'mi') {
    const mph = kmh * 0.621371;
    return `${mph < 10 ? mph.toFixed(1) : Math.round(mph)} mph`;
  }
  return `${kmh < 10 ? kmh.toFixed(1) : Math.round(kmh)} km/h`;
}

function formatSignedCount(delta: number): string {
  if (delta > 0) {
    return `+${delta}`;
  }
  if (delta < 0) {
    return `−${Math.abs(delta)}`;
  }
  return '0';
}

function TravelRow({
  travel,
  muted,
  foreground,
  accent,
}: {
  travel: MapFrequentTravel;
  muted: string;
  foreground: string;
  accent: string;
}) {
  return (
    <View style={styles.travelRow}>
      <Text style={[styles.travelTitle, { color: foreground }]} numberOfLines={2}>
        {travel.fromLabel} → {travel.toLabel}
      </Text>
      <Text style={[styles.travelMeta, { color: muted }]}>
        {APP_COPY.mapInsights.trips(travel.count)}
      </Text>
      <View style={styles.travelStats}>
        <Text style={[styles.travelStat, { color: accent }]}>
          {APP_COPY.mapInsights.avg} {formatTripDuration(travel.avgMs)}
        </Text>
        <Text style={[styles.travelStat, { color: muted }]}>
          {APP_COPY.mapInsights.min} {formatTripDuration(travel.minMs)}
        </Text>
        <Text style={[styles.travelStat, { color: muted }]}>
          {APP_COPY.mapInsights.max} {formatTripDuration(travel.maxMs)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Dense map insights — pulse, places, routes, rhythm, new places, and
 * vs-previous deltas. Not the period-drill pattern used for moment logs.
 */
export function MapInsightsScreen({
  embedded = false,
  contentBottomInset,
}: {
  embedded?: boolean;
  contentBottomInset?: number;
} = {}) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const closesToMap = useClosesToMap();
  const { width: windowWidth } = useWindowDimensions();
  const distanceUnit = useAppStore(state => state.distanceUnit);

  const [tab, setTab] = useState<MapInsightTab>(
    () => persistedMapInsightTab,
  );
  const [filterOption, setFilterOption] = useState<MapInsightFilterOption | null>(
    () => persistedMapInsightFilter,
  );
  const [weekFocus, setWeekFocus] = useState<MapInsightFilterOption>(
    () => persistedWeekFocus,
  );
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [dateKeysWithData, setDateKeysWithData] = useState<string[]>([]);
  const [summary, setSummary] = useState<MapInsightsSummary | null>(null);
  const [overview, setOverview] = useState<MapOverviewInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterMenuPos, setFilterMenuPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const filterAnchorRef = useRef<View>(null);

  const focusContext = useMemo(() => {
    const fromWeek = contextFromFilterOption(weekFocus);
    if (filterOption != null && filterOption.id.startsWith('month:')) {
      const fromMonth = contextFromFilterOption(filterOption);
      return {
        year: fromMonth.year,
        monthKey: fromMonth.monthKey,
      };
    }
    if (filterOption != null && filterOption.id.startsWith('year:')) {
      return {
        year: contextFromFilterOption(filterOption).year,
        monthKey: fromWeek.monthKey,
      };
    }
    return fromWeek;
  }, [filterOption, weekFocus]);

  const periodSegments = useMemo(
    () => [
      {
        id: 'overview' as const,
        label: APP_COPY.mapInsights.overview,
        width: 88,
      },
      {
        id: 'week' as const,
        label: mapInsightWeekBarLabel(weekFocus.weekIndex ?? 1),
        width: 70,
      },
      {
        id: 'month' as const,
        label: mapInsightMonthBarLabel(focusContext.monthKey),
        width: 58,
      },
      {
        id: 'year' as const,
        label: mapInsightYearBarLabel(focusContext.year),
        width: 58,
      },
    ],
    [focusContext.monthKey, focusContext.year, weekFocus.weekIndex],
  );

  const filterOptions = useMemo(() => {
    if (tab === 'overview') {
      return [];
    }
    return listMapInsightFilterOptions({
      period: tab,
      dateKeysWithData,
      monthKey: focusContext.monthKey,
    });
  }, [dateKeysWithData, focusContext.monthKey, tab]);

  const showFilterButton =
    tab === 'overview'
      ? false
      : tab === 'year'
        ? mapInsightYearFilterAvailable(dateKeysWithData)
        : filterOptions.length > 1;

  const filterIsNonDefault =
    filterOption != null && !filterOption.isCurrent;

  const load = useCallback(
    async (
      nextTab: MapInsightTab,
      selection: MapInsightFilterOption | null,
    ) => {
      const summaryPeriod = tabToSummaryPeriod(nextTab);
      if (nextTab === 'overview') {
        setLoading(true);
        try {
          const [trips, savedPlaces, daySummaries] = await Promise.all([
            listAllTrips(),
            listSavedPlaces(),
            listTripDaySummaries(),
          ]);
          setDateKeysWithData(daySummaries.map(day => day.dateKey));
          const base = buildMapOverviewInsights({ trips, savedPlaces });
          const gpsTop = await maxGpsSpeedMsForTripIds(
            base.work.commuteTravelIds,
          );
          setOverview(withCommuteGpsTopSpeed(base, gpsTop));
          setSummary(null);
        } finally {
          setLoading(false);
        }
        return;
      }

      if (summaryPeriod == null || selection == null) {
        setSummary(null);
        setOverview(null);
        setLoading(false);
        const daySummaries = await listTripDaySummaries();
        setDateKeysWithData(daySummaries.map(day => day.dateKey));
        return;
      }

      setLoading(true);
      try {
        const bounds = resolveMapInsightFilterBounds(selection);
        const fetchStart = mapInsightFetchStartForRange(
          bounds.startDateKey,
          bounds.endDateKey,
        );
        const [trips, savedPlaces, masterOn, sleepToggle, daySummaries] =
          await Promise.all([
            listTripsForDateKeyRange(fetchStart, bounds.endDateKey),
            listSavedPlaces(),
            getHealthKitMasterEnabled(),
            getHealthKitSleepEnabled(),
            listTripDaySummaries(),
          ]);
        setDateKeysWithData(daySummaries.map(day => day.dateKey));
        const sleepEnabled = masterOn && sleepToggle;
        const sleepSessions = sleepEnabled
          ? await listSleepSessionsOverlapping(bounds.start, bounds.end)
          : [];
        setSummary(
          buildMapInsightsSummary({
            trips,
            savedPlaces,
            period: summaryPeriod,
            range: {
              startDateKey: bounds.startDateKey,
              endDateKey: bounds.endDateKey,
            },
            sleepEnabled,
            sleepSessions,
          }),
        );
        setOverview(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(tab, filterOption);
  }, [filterOption, load, tab]);

  // After trip-day keys load, if the focused week has no data, jump to one that does.
  useEffect(() => {
    if (tab !== 'week' || filterOption == null || dateKeysWithData.length === 0) {
      return;
    }
    const hasData = dateKeysWithData.some(
      key =>
        key >= filterOption.startDateKey && key <= filterOption.endDateKey,
    );
    if (hasData) {
      return;
    }
    const weeks = listWeekOptionsForMonth(
      parseMonthKeyToDate(monthKeyFromDateKey(filterOption.startDateKey)),
    );
    const picked = pickWeekOptionWithData({
      weeks,
      dateKeysWithData,
      preferredWeekStartKey: filterOption.startDateKey,
    });
    if (picked.id !== filterOption.id) {
      persistedMapInsightFilter = picked;
      persistedWeekFocus = picked;
      setFilterOption(picked);
      setWeekFocus(picked);
    }
  }, [dateKeysWithData, filterOption, tab]);

  const handlePeriodChange = useCallback(
    (next: MapInsightTab) => {
      const focusMonthKey = monthKeyFromDateKey(weekFocus.startDateKey);
      const nextFilter = resolveFilterForTabChange({
        nextTab: next,
        previousTab: tab,
        previousFilter: filterOption,
        focusMonthKey,
        focusWeekStartKey: weekFocus.startDateKey,
        dateKeysWithData,
      });
      const nextWeek = weekFocusFromSelection(
        nextFilter,
        dateKeysWithData,
        weekFocus,
      );
      persistedMapInsightTab = next;
      persistedMapInsightFilter = nextFilter;
      persistedWeekFocus = nextWeek;
      setFilterMenuOpen(false);
      setFilterMenuPos(null);
      setTab(next);
      setFilterOption(nextFilter);
      setWeekFocus(nextWeek);
    },
    [dateKeysWithData, filterOption, tab, weekFocus],
  );

  const handleSelectFilter = useCallback(
    (option: MapInsightFilterOption) => {
      const nextWeek = weekFocusFromSelection(
        option,
        dateKeysWithData,
        weekFocus,
      );
      persistedMapInsightFilter = option;
      persistedWeekFocus = nextWeek;
      setFilterOption(option);
      setWeekFocus(nextWeek);
      setFilterMenuOpen(false);
      setFilterMenuPos(null);
    },
    [dateKeysWithData, weekFocus],
  );

  const handleCloseFilterMenu = useCallback(() => {
    setFilterMenuOpen(false);
    setFilterMenuPos(null);
  }, []);

  const handleToggleFilterMenu = useCallback(() => {
    if (filterMenuOpen) {
      handleCloseFilterMenu();
      return;
    }
    filterAnchorRef.current?.measureInWindow((x, y, width, height) => {
      setFilterMenuPos({
        top: y + height + 8,
        right: Math.max(16, windowWidth - (x + width)),
      });
      setFilterMenuOpen(true);
    });
  }, [filterMenuOpen, handleCloseFilterMenu, windowWidth]);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  const openOverviewDrill = useCallback(
    (kind: MapOverviewDrillKind, title: string, weekday?: number) => {
      navigation.navigate('MapOverviewDrillDown', {
        kind,
        title,
        weekday,
      });
    },
    [navigation],
  );

  const bottomPad =
    contentBottomInset ??
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  const isEmpty = summary != null && summary.daysWithData === 0;
  const hasRhythm =
    summary != null &&
    (summary.rhythm.typicalLeaveHomeMinutes != null ||
      summary.rhythm.typicalReturnHomeMinutes != null);
  const hasComparison = summary != null && summary.daysWithData > 0;
  const showInitialLoading =
    loading &&
    (tab === 'overview' ? overview == null : summary == null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {showInitialLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: bottomPad,
              maxWidth: windowWidth,
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { backgroundColor: THEME.tint }]}>
            <View style={[styles.heroIcon, { backgroundColor: THEME.chipBg }]}>
              <MapIcon size={22} color={THEME.strong} strokeWidth={2.25} />
            </View>
            <View style={styles.heroText}>
              <RNText
                style={[styles.heroTitle, { color: colors.foreground }]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {APP_COPY.mapInsights.insightsTitle}
              </RNText>
              <Text
                style={[styles.heroSubtitle, { color: colors.mutedForeground }]}
              >
                {APP_COPY.mapInsights.insightsSubtitle}
              </Text>
            </View>
          </View>

          <View style={styles.periodRow}>
            <View style={styles.periodBarCenter} pointerEvents="box-none">
              <InsightSegmentBar
                options={periodSegments}
                valueId={tab}
                onChange={handlePeriodChange}
                accent={THEME.strong}
                muted={colors.mutedForeground}
              />
            </View>
            {showFilterButton ? (
              <View ref={filterAnchorRef} style={styles.filterAnchor}>
                <MapGlassCircleButton
                  accessibilityLabel={APP_COPY.mapInsights.filterA11y}
                  onPress={handleToggleFilterMenu}
                  size={FILTER_BUTTON_SIZE}
                  style={styles.filterButton}
                >
                  <ListFilter
                    size={18}
                    color={colors.primary}
                    strokeWidth={2.25}
                  />
                </MapGlassCircleButton>
                {filterIsNonDefault ? (
                  <View pointerEvents="none" style={styles.filterDot} />
                ) : null}
              </View>
            ) : null}
          </View>

          {tab === 'overview' ? (
            overview == null && loading ? null : overview == null ? (
              <Text
                style={[styles.emptyHint, { color: colors.mutedForeground }]}
              >
                {APP_COPY.mapInsights.overviewPlaceholder}
              </Text>
            ) : (
              <>
                <WidgetCard
                  title={overview.home.label || APP_COPY.mapInsights.overviewHome}
                  tint={THEME.tint}
                  accent={THEME.strong}
                >
                  {!overview.home.configured ? (
                    <Text
                      style={[
                        styles.emptyBlock,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {APP_COPY.mapInsights.overviewHomeEmpty}
                    </Text>
                  ) : (
                    <View style={styles.statsGrid}>
                      <StatCell
                        label={APP_COPY.mapInsights.hoursAtHome}
                        value={formatTripDuration(overview.home.totalMs)}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                      />
                      <StatCell
                        label={APP_COPY.mapInsights.fullDayHomeStays}
                        value={String(overview.home.fullDayStayCount)}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                        highlight={THEME.strong}
                        onPress={
                          overview.home.fullDayStayCount > 0
                            ? () =>
                                openOverviewDrill(
                                  'home_stays_full_day',
                                  APP_COPY.mapInsights.fullDayHomeStays,
                                )
                            : undefined
                        }
                      />
                      <StatCell
                        label={APP_COPY.mapInsights.longestHomeStay}
                        value={
                          overview.home.longestStayMs != null
                            ? formatTripDuration(overview.home.longestStayMs)
                            : '—'
                        }
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                        highlight={THEME.strong}
                        onPress={
                          overview.home.longestStayMs != null
                            ? () =>
                                openOverviewDrill(
                                  'home_stay_longest',
                                  APP_COPY.mapInsights.longestHomeStay,
                                )
                            : undefined
                        }
                      />
                      <StatCell
                        label={APP_COPY.mapInsights.shortestHomeStay}
                        value={
                          overview.home.shortestStayMs != null
                            ? formatTripDuration(overview.home.shortestStayMs)
                            : '—'
                        }
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                        highlight={THEME.strong}
                        onPress={
                          overview.home.shortestStayMs != null
                            ? () =>
                                openOverviewDrill(
                                  'home_stay_shortest',
                                  APP_COPY.mapInsights.shortestHomeStay,
                                )
                            : undefined
                        }
                      />
                      <StatCell
                        label={APP_COPY.mapInsights.avgHomeStay}
                        value={
                          overview.home.avgStayMs != null
                            ? formatTripDuration(overview.home.avgStayMs)
                            : '—'
                        }
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                      />
                    </View>
                  )}
                </WidgetCard>

                <WidgetCard
                  title={overview.work.label || APP_COPY.mapInsights.overviewWork}
                  tint={THEME.tint}
                  accent={THEME.strong}
                >
                  {!overview.work.configured ? (
                    <Text
                      style={[
                        styles.emptyBlock,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {APP_COPY.mapInsights.overviewWorkEmpty}
                    </Text>
                  ) : (
                    <View style={styles.overviewSections}>
                      <OverviewSection
                        title={APP_COPY.mapInsights.workSectionSummary}
                        accent={THEME.strong}
                      >
                        <StatCell
                          label={APP_COPY.mapInsights.workVisits}
                          value={String(overview.work.visitCount)}
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                          highlight={THEME.strong}
                          onPress={
                            overview.work.visitCount > 0
                              ? () =>
                                  openOverviewDrill(
                                    'work_stays_all',
                                    APP_COPY.mapInsights.workVisits,
                                  )
                              : undefined
                          }
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.hoursAtWork}
                          value={formatTripDuration(overview.work.totalMs)}
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                          highlight={THEME.strong}
                          onPress={
                            overview.work.visitCount > 0
                              ? () =>
                                  openOverviewDrill(
                                    'work_stays_all',
                                    APP_COPY.mapInsights.hoursAtWork,
                                  )
                              : undefined
                          }
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.distanceToWork}
                          value={
                            overview.work.distanceToWorkKm != null
                              ? formatDistance(
                                  overview.work.distanceToWorkKm,
                                  distanceUnit,
                                )
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                        />
                      </OverviewSection>

                      <View
                        style={[
                          styles.overviewDivider,
                          { backgroundColor: THEME.soft },
                        ]}
                      />

                      <OverviewSection
                        title={APP_COPY.mapInsights.workSectionCommute}
                        accent={THEME.strong}
                      >
                        <StatCell
                          label={APP_COPY.mapInsights.commuteMin}
                          value={
                            overview.work.commuteMinMs != null
                              ? formatTripDuration(overview.work.commuteMinMs)
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                          highlight={THEME.strong}
                          onPress={
                            overview.work.commuteMinMs != null
                              ? () =>
                                  openOverviewDrill(
                                    'work_commute_fastest',
                                    APP_COPY.mapInsights.commuteMin,
                                  )
                              : undefined
                          }
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.commuteMax}
                          value={
                            overview.work.commuteMaxMs != null
                              ? formatTripDuration(overview.work.commuteMaxMs)
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                          highlight={THEME.strong}
                          onPress={
                            overview.work.commuteMaxMs != null
                              ? () =>
                                  openOverviewDrill(
                                    'work_commute_slowest',
                                    APP_COPY.mapInsights.commuteMax,
                                  )
                              : undefined
                          }
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.commuteAvg}
                          value={
                            overview.work.commuteAvgMs != null
                              ? formatTripDuration(overview.work.commuteAvgMs)
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                        />
                      </OverviewSection>

                      <View
                        style={[
                          styles.overviewDivider,
                          { backgroundColor: THEME.soft },
                        ]}
                      />

                      <OverviewSection
                        title={APP_COPY.mapInsights.workSectionStay}
                        accent={THEME.strong}
                      >
                        <StatCell
                          label={APP_COPY.mapInsights.workStayMin}
                          value={
                            overview.work.stayMinMs != null
                              ? formatTripDuration(overview.work.stayMinMs)
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                          highlight={THEME.strong}
                          onPress={
                            overview.work.stayMinMs != null
                              ? () =>
                                  openOverviewDrill(
                                    'work_stay_shortest',
                                    APP_COPY.mapInsights.workStayMin,
                                  )
                              : undefined
                          }
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.workStayMax}
                          value={
                            overview.work.stayMaxMs != null
                              ? formatTripDuration(overview.work.stayMaxMs)
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                          highlight={THEME.strong}
                          onPress={
                            overview.work.stayMaxMs != null
                              ? () =>
                                  openOverviewDrill(
                                    'work_stay_longest',
                                    APP_COPY.mapInsights.workStayMax,
                                  )
                              : undefined
                          }
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.workStayAvg}
                          value={
                            overview.work.stayAvgMs != null
                              ? formatTripDuration(overview.work.stayAvgMs)
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                        />
                      </OverviewSection>

                      <View
                        style={[
                          styles.overviewDivider,
                          { backgroundColor: THEME.soft },
                        ]}
                      />

                      <OverviewSection
                        title={APP_COPY.mapInsights.workSectionSpeed}
                        accent={THEME.strong}
                      >
                        <StatCell
                          label={APP_COPY.mapInsights.commuteSpeedMin}
                          value={
                            overview.work.speedMinKmh != null
                              ? formatSpeedKmh(
                                  overview.work.speedMinKmh,
                                  distanceUnit,
                                )
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                          highlight={THEME.strong}
                          onPress={
                            overview.work.speedMinKmh != null
                              ? () =>
                                  openOverviewDrill(
                                    'work_commute_speed_min',
                                    APP_COPY.mapInsights.commuteSpeedMin,
                                  )
                              : undefined
                          }
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.commuteSpeedMax}
                          value={
                            overview.work.speedMaxKmh != null
                              ? formatSpeedKmh(
                                  overview.work.speedMaxKmh,
                                  distanceUnit,
                                )
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                          highlight={THEME.strong}
                          onPress={
                            overview.work.speedMaxKmh != null
                              ? () =>
                                  openOverviewDrill(
                                    'work_commute_speed_max',
                                    APP_COPY.mapInsights.commuteSpeedMax,
                                  )
                              : undefined
                          }
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.commuteSpeedAvg}
                          value={
                            overview.work.speedAvgKmh != null
                              ? formatSpeedKmh(
                                  overview.work.speedAvgKmh,
                                  distanceUnit,
                                )
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                        />
                      </OverviewSection>

                      <View
                        style={[
                          styles.overviewDivider,
                          { backgroundColor: THEME.soft },
                        ]}
                      />

                      <OverviewSection
                        title={APP_COPY.mapInsights.workSectionSchedule}
                        accent={THEME.strong}
                      >
                        <StatCell
                          label={APP_COPY.mapInsights.typicalArriveWork}
                          value={
                            overview.work.typicalArriveMinutes != null
                              ? formatTimeMinutes(
                                  overview.work.typicalArriveMinutes,
                                )
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                        />
                        <StatCell
                          label={APP_COPY.mapInsights.typicalLeaveWork}
                          value={
                            overview.work.typicalLeaveMinutes != null
                              ? formatTimeMinutes(
                                  overview.work.typicalLeaveMinutes,
                                )
                              : '—'
                          }
                          muted={colors.mutedForeground}
                          foreground={colors.foreground}
                        />
                      </OverviewSection>

                      {overview.work.weekdayCounts.length > 0 ? (
                        <>
                          <View
                            style={[
                              styles.overviewDivider,
                              { backgroundColor: THEME.soft },
                            ]}
                          />
                          <View style={styles.overviewSection}>
                            <Text
                              style={[
                                styles.overviewSectionTitle,
                                { color: THEME.strong },
                              ]}
                            >
                              {APP_COPY.mapInsights.workWeekdays}
                            </Text>
                            <View style={styles.list}>
                              {overview.work.weekdayCounts.map(day => (
                                <Pressable
                                  key={day.weekday}
                                  accessibilityRole="button"
                                  onPress={() =>
                                    openOverviewDrill(
                                      'work_weekday',
                                      day.label,
                                      day.weekday,
                                    )
                                  }
                                  style={styles.listRow}
                                >
                                  <View style={styles.listRowText}>
                                    <Text
                                      style={[
                                        styles.listRowTitle,
                                        { color: colors.foreground },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {day.label}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.listRowMeta,
                                        { color: colors.mutedForeground },
                                      ]}
                                      numberOfLines={1}
                                    >
                                      {APP_COPY.mapInsights.visits(day.count)}
                                    </Text>
                                  </View>
                                  <RNText
                                    style={[
                                      styles.listRowValue,
                                      { color: THEME.strong },
                                    ]}
                                    allowFontScaling={false}
                                    numberOfLines={1}
                                  >
                                    {String(day.count)}
                                  </RNText>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        </>
                      ) : null}
                    </View>
                  )}
                </WidgetCard>
              </>
            )
          ) : null}

          {tab === 'week' && filterOption != null ? (
            <Text
              style={[styles.weekHeader, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {filterOption.label}
            </Text>
          ) : null}

          {tab !== 'overview' && summary != null && !isEmpty ? (
            <>
              <WidgetCard
                title={APP_COPY.mapInsights.pulse}
                tint={THEME.tint}
                accent={THEME.strong}
              >
                <View style={styles.statsGrid}>
                  <StatCell
                    label={APP_COPY.mapInsights.distance}
                    value={formatDistance(summary.distanceKm, distanceUnit)}
                    muted={colors.mutedForeground}
                    foreground={colors.foreground}
                  />
                  <StatCell
                    label={APP_COPY.mapInsights.daysTracked}
                    value={String(summary.daysWithData)}
                    muted={colors.mutedForeground}
                    foreground={colors.foreground}
                  />
                  <StatCell
                    label={APP_COPY.mapInsights.nightsAway}
                    value={String(summary.nightsAway)}
                    muted={colors.mutedForeground}
                    foreground={colors.foreground}
                  />
                  {summary.sleepEnabled && summary.sleepMs > 0 ? (
                    <StatCell
                      label={APP_COPY.mapInsights.sleeping}
                      value={formatTripDuration(summary.sleepMs)}
                      muted={colors.mutedForeground}
                      foreground={colors.foreground}
                    />
                  ) : null}
                </View>
              </WidgetCard>

              {summary.placeTimes.length > 0 ? (
                <WidgetCard
                  title={APP_COPY.mapInsights.savedPlaces}
                  tint={THEME.tint}
                  accent={THEME.strong}
                >
                  <View style={styles.list}>
                    {summary.placeTimes.map((place: MapPlaceTimeRow) => (
                      <PlaceRow
                        key={place.key}
                        title={placeTimeLabel(place)}
                        meta={APP_COPY.mapInsights.visits(place.visitCount)}
                        value={formatTripDuration(place.durationMs)}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                      />
                    ))}
                  </View>
                </WidgetCard>
              ) : null}

              {summary.topPlaces.length > 0 ? (
                <WidgetCard
                  title={APP_COPY.mapInsights.topPlaces}
                  tint={THEME.tint}
                  accent={THEME.strong}
                >
                  <View style={styles.list}>
                    {summary.topPlaces.map((place: MapTopPlaceRow) => (
                      <PlaceRow
                        key={place.key}
                        title={place.label}
                        meta={APP_COPY.mapInsights.visits(place.visitCount)}
                        value={formatTripDuration(place.durationMs)}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                      />
                    ))}
                  </View>
                </WidgetCard>
              ) : null}

              {summary.frequentTravels.length > 0 ? (
                <WidgetCard
                  title={APP_COPY.mapInsights.frequentTravels}
                  tint={THEME.tint}
                  accent={THEME.strong}
                >
                  <View style={styles.travelList}>
                    {summary.frequentTravels.map(travel => (
                      <TravelRow
                        key={travel.key}
                        travel={travel}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                        accent={THEME.strong}
                      />
                    ))}
                  </View>
                </WidgetCard>
              ) : null}

              <WidgetCard
                title={APP_COPY.mapInsights.rhythm}
                tint={THEME.tint}
                accent={THEME.strong}
              >
                {hasRhythm ? (
                  <View style={styles.statsGrid}>
                    {summary.rhythm.typicalLeaveHomeMinutes != null ? (
                      <StatCell
                        label={APP_COPY.mapInsights.leaveHome}
                        value={formatTimeMinutes(
                          summary.rhythm.typicalLeaveHomeMinutes,
                        )}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                      />
                    ) : null}
                    {summary.rhythm.typicalReturnHomeMinutes != null ? (
                      <StatCell
                        label={APP_COPY.mapInsights.returnHome}
                        value={formatTimeMinutes(
                          summary.rhythm.typicalReturnHomeMinutes,
                        )}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                      />
                    ) : null}
                  </View>
                ) : (
                  <Text
                    style={[styles.emptyBlock, { color: colors.mutedForeground }]}
                  >
                    {APP_COPY.mapInsights.rhythmEmpty}
                  </Text>
                )}
              </WidgetCard>

              {summary.newPlaces.length > 0 ? (
                <WidgetCard
                  title={APP_COPY.mapInsights.newPlaces}
                  tint={THEME.tint}
                  accent={THEME.strong}
                >
                  <View style={styles.list}>
                    {summary.newPlaces.map((place: MapNewPlaceRow) => (
                      <PlaceRow
                        key={place.key}
                        title={place.label}
                        meta={APP_COPY.mapInsights.visits(place.visitCount)}
                        value={formatTripDuration(place.durationMs)}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                      />
                    ))}
                  </View>
                </WidgetCard>
              ) : null}

              {hasComparison ? (
                <WidgetCard
                  title={APP_COPY.mapInsights.vsPrevious}
                  tint={THEME.tint}
                  accent={THEME.strong}
                >
                  <View style={styles.statsGrid}>
                    <StatCell
                      label={APP_COPY.mapInsights.distanceChange}
                      value={formatSignedDistance(
                        summary.comparison.distanceKmDelta,
                        distanceUnit,
                      )}
                      muted={colors.mutedForeground}
                      foreground={colors.foreground}
                    />
                    {summary.comparison.homeMsDelta != null ? (
                      <StatCell
                        label={APP_COPY.mapInsights.homeChange}
                        value={formatSignedDuration(
                          summary.comparison.homeMsDelta,
                        )}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                      />
                    ) : null}
                    <StatCell
                      label={APP_COPY.mapInsights.nightsAwayChange}
                      value={formatSignedCount(
                        summary.comparison.nightsAwayDelta,
                      )}
                      muted={colors.mutedForeground}
                      foreground={colors.foreground}
                    />
                  </View>
                </WidgetCard>
              ) : null}
            </>
          ) : null}

          {tab !== 'overview' && isEmpty ? (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {APP_COPY.mapInsights.insightsEmpty}
            </Text>
          ) : null}
        </ScrollView>
      )}

      {filterMenuOpen && showFilterButton && filterMenuPos != null ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filter menu"
            onPress={handleCloseFilterMenu}
            style={styles.filterBackdrop}
          />
          <View
            style={[
              styles.filterMenu,
              {
                top: filterMenuPos.top,
                right: filterMenuPos.right,
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterMenuTitle,
                { color: colors.mutedForeground },
              ]}
            >
              {APP_COPY.mapInsights.filterTitle}
            </Text>
            <ScrollView
              style={styles.filterMenuScroll}
              bounces={false}
              showsVerticalScrollIndicator={false}
            >
              {filterOptions.map(option => {
                const selected = option.id === filterOption?.id;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected }}
                    onPress={() => handleSelectFilter(option)}
                    style={[
                      styles.filterMenuItem,
                      selected ? { backgroundColor: colors.accent } : undefined,
                    ]}
                  >
                    <View style={styles.filterMenuItemText}>
                      <Text
                        style={[
                          styles.filterMenuItemLabel,
                          {
                            color: selected
                              ? colors.primary
                              : colors.cardForeground,
                          },
                        ]}
                        numberOfLines={2}
                      >
                        {option.label}
                      </Text>
                      {option.isCurrent ? (
                        <Text
                          style={[
                            styles.filterMenuItemSub,
                            { color: colors.mutedForeground },
                          ]}
                        >
                          {APP_COPY.mapInsights.current}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? (
                      <Check
                        size={17}
                        color={colors.primary}
                        strokeWidth={2.5}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </>
      ) : null}

      {embedded ? null : (
        <View
          pointerEvents="box-none"
          style={[
            styles.closeWrap,
            { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
          ]}
        >
          <MapGlassCircleButton
            accessibilityLabel={closesToMap ? 'Close' : 'Back'}
            onPress={handleClose}
          >
            {closesToMap ? (
              <X size={20} color={colors.primary} strokeWidth={2.25} />
            ) : (
              <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
            )}
          </MapGlassCircleButton>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    gap: 12,
  },
  periodRow: {
    height: FILTER_BUTTON_SIZE,
    justifyContent: 'center',
  },
  periodBarCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekHeader: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  filterAnchor: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: FILTER_BUTTON_SIZE,
    height: FILTER_BUTTON_SIZE,
  },
  filterButton: {
    width: FILTER_BUTTON_SIZE,
    height: FILTER_BUTTON_SIZE,
  },
  filterDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 2,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  filterMenu: {
    position: 'absolute',
    zIndex: 21,
    width: 260,
    maxHeight: 320,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  filterMenuScroll: {
    maxHeight: 280,
  },
  filterMenuTitle: {
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 5,
    fontSize: 12,
    fontWeight: '600',
  },
  filterMenuItem: {
    minHeight: 44,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  filterMenuItemText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  filterMenuItemLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  filterMenuItemSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  widget: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: 'hidden',
    gap: 10,
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewSections: {
    gap: 14,
  },
  overviewSection: {
    gap: 10,
  },
  overviewSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  overviewDivider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  statCell: {
    width: '47%',
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '800',
  },
  list: {
    gap: 12,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listRowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  listRowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  listRowMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  listSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  listRowValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  travelList: {
    gap: 14,
  },
  travelRow: {
    gap: 4,
  },
  travelTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  travelMeta: {
    fontSize: 12,
    fontWeight: '600',
  },
  travelStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  travelStat: {
    fontSize: 12,
    fontWeight: '700',
  },
  emptyBlock: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4,
  },
  closeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
