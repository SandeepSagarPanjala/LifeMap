import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, ChevronDown, ChevronLeft, ChevronUp, ListFilter, Map as MapIcon, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  defaultPersistedMapInsightSelection,
  loadPersistedMapInsightSelection,
  persistMapInsightSelection,
} from '@/lib/map/map-insight-selection';
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
  type MapDestinationOverview,
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
const sessionDefaults = defaultPersistedMapInsightSelection();
let persistedMapInsightTab: MapInsightTab = sessionDefaults.tab;
let persistedMapInsightFilter: MapInsightFilterOption | null =
  sessionDefaults.filter;
let persistedWeekFocus: MapInsightFilterOption = sessionDefaults.weekFocus;

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
  // Year / Today ranges should not drag Month/Week chrome to Jan 1 / today-only.
  if (selection.id.startsWith('year:') || selection.id.startsWith('today:')) {
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
  collapsible,
  expanded = true,
  onToggleExpand,
}: {
  title: string;
  children: ReactNode;
  tint: string;
  accent: string;
  collapsible?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const isExpanded = !collapsible || expanded;

  return (
    <View style={[styles.widget, { backgroundColor: tint }]}>
      {collapsible && onToggleExpand != null ? (
        <View style={styles.widgetHeaderRow}>
          <View style={styles.widgetTitleWrap}>
            <RNText
              style={[styles.widgetTitle, { color: accent }]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {title}
            </RNText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isExpanded }}
            accessibilityLabel={
              isExpanded
                ? `${title}. ${APP_COPY.mapInsights.overviewCollapse}`
                : `${title}. ${APP_COPY.mapInsights.overviewExpand}`
            }
            hitSlop={8}
            onPress={onToggleExpand}
            style={({ pressed }) =>
              pressed ? styles.collapseChipPressed : null
            }
          >
            <View style={styles.collapseChipRow}>
              <RNText
                style={[styles.collapseChipLabel, { color: accent }]}
                allowFontScaling={false}
              >
                {isExpanded
                  ? APP_COPY.mapInsights.overviewCollapse
                  : APP_COPY.mapInsights.overviewExpand}
              </RNText>
              {isExpanded ? (
                <ChevronUp size={16} color={accent} strokeWidth={2.25} />
              ) : (
                <ChevronDown size={16} color={accent} strokeWidth={2.25} />
              )}
            </View>
          </Pressable>
        </View>
      ) : (
        <RNText
          style={[styles.widgetTitle, { color: accent }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {title}
        </RNText>
      )}
      {isExpanded ? children : null}
    </View>
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
  const row = (
    <View style={styles.statRowInner}>
      <RNText
        style={[styles.statLabel, { color: muted }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {label}
      </RNText>
      <RNText
        style={[styles.statValue, { color: valueColor }]}
        allowFontScaling={false}
        numberOfLines={1}
      >
        {value}
      </RNText>
    </View>
  );

  if (onPress != null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} ${value}`}
        onPress={onPress}
        style={({ pressed }) => [
          styles.statRow,
          pressed ? { opacity: 0.72 } : null,
        ]}
      >
        {row}
      </Pressable>
    );
  }

  return <View style={styles.statRow}>{row}</View>;
}

function OverviewSection({
  title,
  accent,
  children,
}: {
  title?: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.overviewSection}>
      {title != null ? (
        <Text style={[styles.overviewSectionTitle, { color: accent }]}>
          {title}
        </Text>
      ) : null}
      <View style={styles.statsList}>{children}</View>
    </View>
  );
}

function destinationCopy(kind: 'work' | 'favorite') {
  if (kind === 'work') {
    return {
      hours: APP_COPY.mapInsights.hoursAtWork,
      distance: APP_COPY.mapInsights.distanceToWork,
      stayMin: APP_COPY.mapInsights.workStayMin,
      stayMax: APP_COPY.mapInsights.workStayMax,
      stayAvg: APP_COPY.mapInsights.workStayAvg,
      weekdays: APP_COPY.mapInsights.workWeekdays,
    };
  }
  return {
    hours: APP_COPY.mapInsights.hoursAtPlace,
    distance: APP_COPY.mapInsights.distanceFromHome,
    stayMin: APP_COPY.mapInsights.placeStayMin,
    stayMax: APP_COPY.mapInsights.placeStayMax,
    stayAvg: APP_COPY.mapInsights.placeStayAvg,
    weekdays: APP_COPY.mapInsights.placeWeekdays,
  };
}

function DestinationOverviewBody({
  destination,
  muted,
  foreground,
  accent,
  soft,
  distanceUnit,
  onDrill,
}: {
  destination: MapDestinationOverview;
  muted: string;
  foreground: string;
  accent: string;
  soft: string;
  distanceUnit: DistanceUnit;
  onDrill: (
    kind: MapOverviewDrillKind,
    title: string,
    weekday?: number,
  ) => void;
}) {
  const copy = destinationCopy(destination.kind);

  if (destination.visitCount <= 0) {
    return (
      <Text style={[styles.emptyBlock, { color: muted }]}>
        {APP_COPY.mapInsights.overviewNoVisitData}
      </Text>
    );
  }

  return (
    <View style={styles.overviewSections}>
      <OverviewSection accent={accent}>
        <StatCell
          label={APP_COPY.mapInsights.workVisits}
          value={String(destination.visitCount)}
          muted={muted}
          foreground={foreground}
          highlight={accent}
          onPress={() =>
            onDrill('work_stays_all', APP_COPY.mapInsights.workVisits)
          }
        />
        <StatCell
          label={copy.hours}
          value={formatTripDuration(destination.totalMs)}
          muted={muted}
          foreground={foreground}
          highlight={accent}
          onPress={() => onDrill('work_stays_all', copy.hours)}
        />
        <StatCell
          label={copy.distance}
          value={
            destination.distanceFromHomeKm != null
              ? formatDistance(destination.distanceFromHomeKm, distanceUnit)
              : '—'
          }
          muted={muted}
          foreground={foreground}
        />
      </OverviewSection>

      <View style={[styles.overviewDivider, { backgroundColor: soft }]} />

      <OverviewSection accent={accent}>
        <StatCell
          label={APP_COPY.mapInsights.commuteMin}
          value={
            destination.commuteMinMs != null
              ? formatTripDuration(destination.commuteMinMs)
              : '—'
          }
          muted={muted}
          foreground={foreground}
          highlight={accent}
          onPress={
            destination.commuteMinMs != null
              ? () =>
                  onDrill(
                    'work_commute_fastest',
                    APP_COPY.mapInsights.commuteMin,
                  )
              : undefined
          }
        />
        <StatCell
          label={APP_COPY.mapInsights.commuteMax}
          value={
            destination.commuteMaxMs != null
              ? formatTripDuration(destination.commuteMaxMs)
              : '—'
          }
          muted={muted}
          foreground={foreground}
          highlight={accent}
          onPress={
            destination.commuteMaxMs != null
              ? () =>
                  onDrill(
                    'work_commute_slowest',
                    APP_COPY.mapInsights.commuteMax,
                  )
              : undefined
          }
        />
        <StatCell
          label={APP_COPY.mapInsights.commuteAvg}
          value={
            destination.commuteAvgMs != null
              ? formatTripDuration(destination.commuteAvgMs)
              : '—'
          }
          muted={muted}
          foreground={foreground}
        />
      </OverviewSection>

      <View style={[styles.overviewDivider, { backgroundColor: soft }]} />

      <OverviewSection accent={accent}>
        <StatCell
          label={copy.stayMin}
          value={
            destination.stayMinMs != null
              ? formatTripDuration(destination.stayMinMs)
              : '—'
          }
          muted={muted}
          foreground={foreground}
          highlight={accent}
          onPress={
            destination.stayMinMs != null
              ? () => onDrill('work_stay_shortest', copy.stayMin)
              : undefined
          }
        />
        <StatCell
          label={copy.stayMax}
          value={
            destination.stayMaxMs != null
              ? formatTripDuration(destination.stayMaxMs)
              : '—'
          }
          muted={muted}
          foreground={foreground}
          highlight={accent}
          onPress={
            destination.stayMaxMs != null
              ? () => onDrill('work_stay_longest', copy.stayMax)
              : undefined
          }
        />
        <StatCell
          label={copy.stayAvg}
          value={
            destination.stayAvgMs != null
              ? formatTripDuration(destination.stayAvgMs)
              : '—'
          }
          muted={muted}
          foreground={foreground}
        />
      </OverviewSection>

      <View style={[styles.overviewDivider, { backgroundColor: soft }]} />

      <OverviewSection accent={accent}>
        <StatCell
          label={APP_COPY.mapInsights.commuteSpeedMin}
          value={
            destination.speedMinKmh != null
              ? formatSpeedKmh(destination.speedMinKmh, distanceUnit)
              : '—'
          }
          muted={muted}
          foreground={foreground}
          highlight={accent}
          onPress={
            destination.speedMinKmh != null
              ? () =>
                  onDrill(
                    'work_commute_speed_min',
                    APP_COPY.mapInsights.commuteSpeedMin,
                  )
              : undefined
          }
        />
        <StatCell
          label={APP_COPY.mapInsights.commuteSpeedMax}
          value={
            destination.speedMaxKmh != null
              ? formatSpeedKmh(destination.speedMaxKmh, distanceUnit)
              : '—'
          }
          muted={muted}
          foreground={foreground}
          highlight={accent}
          onPress={
            destination.speedMaxKmh != null
              ? () =>
                  onDrill(
                    'work_commute_speed_max',
                    APP_COPY.mapInsights.commuteSpeedMax,
                  )
              : undefined
          }
        />
        <StatCell
          label={APP_COPY.mapInsights.commuteSpeedAvg}
          value={
            destination.speedAvgKmh != null
              ? formatSpeedKmh(destination.speedAvgKmh, distanceUnit)
              : '—'
          }
          muted={muted}
          foreground={foreground}
        />
      </OverviewSection>

      <View style={[styles.overviewDivider, { backgroundColor: soft }]} />

      <OverviewSection accent={accent}>
        <StatCell
          label={APP_COPY.mapInsights.typicalArriveWork}
          value={
            destination.typicalArriveMinutes != null
              ? formatTimeMinutes(destination.typicalArriveMinutes)
              : '—'
          }
          muted={muted}
          foreground={foreground}
        />
        <StatCell
          label={APP_COPY.mapInsights.typicalLeaveWork}
          value={
            destination.typicalLeaveMinutes != null
              ? formatTimeMinutes(destination.typicalLeaveMinutes)
              : '—'
          }
          muted={muted}
          foreground={foreground}
        />
      </OverviewSection>

      {destination.weekdayCounts.length > 0 ? (
        <>
          <View style={[styles.overviewDivider, { backgroundColor: soft }]} />
          <View style={styles.overviewSection}>
            <Text style={[styles.overviewSectionTitle, { color: accent }]}>
              {copy.weekdays}
            </Text>
            <View style={styles.statsList}>
              {destination.weekdayCounts.map(day => (
                <Pressable
                  key={day.weekday}
                  accessibilityRole="button"
                  accessibilityLabel={`${day.label} ${day.count}`}
                  onPress={() => onDrill('work_weekday', day.label, day.weekday)}
                  style={({ pressed }) => [
                    styles.statRow,
                    pressed ? { opacity: 0.72 } : null,
                  ]}
                >
                  <View style={styles.statRowInner}>
                    <RNText
                      style={[styles.statLabel, { color: muted }]}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      {day.label}
                    </RNText>
                    <RNText
                      style={[styles.statValue, { color: accent }]}
                      allowFontScaling={false}
                      numberOfLines={1}
                    >
                      {String(day.count)}
                    </RNText>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      ) : null}
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
  const [selectionReady, setSelectionReady] = useState(false);
  const [collapsedOverviewIds, setCollapsedOverviewIds] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const [filterMenuPos, setFilterMenuPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const filterAnchorRef = useRef<View>(null);
  const overviewRef = useRef<MapOverviewInsights | null>(null);
  const summaryRef = useRef<MapInsightsSummary | null>(null);
  overviewRef.current = overview;
  summaryRef.current = summary;

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
        width: 78,
      },
      {
        id: 'today' as const,
        label: APP_COPY.mapInsights.today,
        width: 56,
      },
      {
        id: 'week' as const,
        label: mapInsightWeekBarLabel(weekFocus.weekIndex ?? 1),
        width: 68,
      },
      {
        id: 'month' as const,
        label: mapInsightMonthBarLabel(focusContext.monthKey),
        width: 54,
      },
      {
        id: 'year' as const,
        label: mapInsightYearBarLabel(focusContext.year),
        width: 54,
      },
    ],
    [focusContext.monthKey, focusContext.year, weekFocus.weekIndex],
  );

  const filterOptions = useMemo(() => {
    if (tab === 'overview' || tab === 'today') {
      return [];
    }
    return listMapInsightFilterOptions({
      period: tab,
      dateKeysWithData,
      monthKey: focusContext.monthKey,
    });
  }, [dateKeysWithData, focusContext.monthKey, tab]);

  const showFilterButton =
    tab === 'overview' || tab === 'today'
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
        // Keep prior overview on screen while refreshing — avoids full wipe flicker.
        if (overviewRef.current == null) {
          setLoading(true);
        }
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
        } finally {
          setLoading(false);
        }
        return;
      }

      if (summaryPeriod == null || selection == null) {
        setLoading(false);
        const daySummaries = await listTripDaySummaries();
        setDateKeysWithData(daySummaries.map(day => day.dateKey));
        return;
      }

      if (summaryRef.current == null) {
        setLoading(true);
      }
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
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    void loadPersistedMapInsightSelection().then(saved => {
      if (cancelled) {
        return;
      }
      persistedMapInsightTab = saved.tab;
      persistedMapInsightFilter = saved.filter;
      persistedWeekFocus = saved.weekFocus;
      setTab(saved.tab);
      setFilterOption(saved.filter);
      setWeekFocus(saved.weekFocus);
      setSelectionReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectionReady) {
      return;
    }
    void load(tab, filterOption);
  }, [filterOption, load, selectionReady, tab]);

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
      void persistMapInsightSelection({
        tab: 'week',
        filter: picked,
        weekFocus: picked,
      });
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
      void persistMapInsightSelection({
        tab: next,
        filter: nextFilter,
        weekFocus: nextWeek,
      });
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
      void persistMapInsightSelection({
        tab,
        filter: option,
        weekFocus: nextWeek,
      });
    },
    [dateKeysWithData, tab, weekFocus],
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
    (
      kind: MapOverviewDrillKind,
      title: string,
      weekday?: number,
      placeId?: number,
    ) => {
      navigation.navigate('MapOverviewDrillDown', {
        kind,
        title,
        weekday,
        placeId,
      });
    },
    [navigation],
  );

  const toggleOverviewCollapsed = useCallback((id: string) => {
    setCollapsedOverviewIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  /** Work + favorites with visits first; “no data” cards last. */
  const overviewDestinations = useMemo(() => {
    if (overview == null) {
      return [];
    }
    const items: MapDestinationOverview[] = [];
    if (overview.work.configured) {
      items.push(overview.work);
    }
    items.push(...overview.favorites);
    const withData = items.filter(item => item.visitCount > 0);
    const noData = items.filter(item => item.visitCount <= 0);
    return [...withData, ...noData];
  }, [overview]);

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
    !selectionReady ||
    (loading && (tab === 'overview' ? overview == null : summary == null));

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
              width: windowWidth,
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
                  collapsible
                  expanded={!collapsedOverviewIds.has('home')}
                  onToggleExpand={() => toggleOverviewCollapsed('home')}
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
                    <View style={styles.statsList}>
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

                {!overview.work.configured ? (
                  <WidgetCard
                    title={overview.work.label || APP_COPY.mapInsights.overviewWork}
                    tint={THEME.tint}
                    accent={THEME.strong}
                    collapsible
                    expanded={!collapsedOverviewIds.has('work')}
                    onToggleExpand={() => toggleOverviewCollapsed('work')}
                  >
                    <Text
                      style={[
                        styles.emptyBlock,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      {APP_COPY.mapInsights.overviewWorkEmpty}
                    </Text>
                  </WidgetCard>
                ) : null}

                {overviewDestinations.map(place => {
                  const collapseId =
                    place.kind === 'work'
                      ? 'work'
                      : `place:${place.placeId}`;
                  return (
                    <WidgetCard
                      key={collapseId}
                      title={
                        place.kind === 'work'
                          ? place.label || APP_COPY.mapInsights.overviewWork
                          : place.label
                      }
                      tint={THEME.tint}
                      accent={THEME.strong}
                      collapsible
                      expanded={!collapsedOverviewIds.has(collapseId)}
                      onToggleExpand={() => toggleOverviewCollapsed(collapseId)}
                    >
                      <DestinationOverviewBody
                        destination={place}
                        muted={colors.mutedForeground}
                        foreground={colors.foreground}
                        accent={THEME.strong}
                        soft={THEME.soft}
                        distanceUnit={distanceUnit}
                        onDrill={(kind, title, weekday) =>
                          openOverviewDrill(
                            kind,
                            title,
                            weekday,
                            place.placeId ?? undefined,
                          )
                        }
                      />
                    </WidgetCard>
                  );
                })}
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
                <View style={styles.statsList}>
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
                  <View style={styles.statsList}>
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
                  <View style={styles.statsList}>
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
    width: '100%',
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'stretch',
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
    alignSelf: 'stretch',
    width: '100%',
  },
  widgetHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    width: '100%',
  },
  widgetTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
    justifyContent: 'center',
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  collapseChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  collapseChipPressed: {
    opacity: 0.72,
  },
  collapseChipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  statsList: {
    gap: 0,
  },
  overviewSections: {
    gap: 12,
  },
  overviewSection: {
    gap: 4,
  },
  overviewSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  overviewDivider: {
    height: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
  statRow: {
    alignSelf: 'stretch',
    height: 34,
  },
  statRowInner: {
    flex: 1,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  statValue: {
    flexShrink: 0,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'right',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
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
