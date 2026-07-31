import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import {
  getDaySleep,
  listDaySleepBefore,
  type HealthDaySleepRow,
} from '@/db/repositories/health';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { shiftDateKey } from '@/lib/day-utils';
import {
  formatSleepDetailDuration,
  formatSleepRangeLine,
  formatStageDuration,
} from '@/lib/healthkit/display';
import { subscribeHealthData } from '@/lib/healthkit/events';
import { APP_TIMEZONE } from '@/lib/timezone';
import type { RootStackParamList } from '@/navigation/types';

type ChartRange = 'W' | 'M' | '6M' | 'ALL';

const RANGE_LIMITS: Record<ChartRange, number> = {
  W: 7,
  M: 30,
  '6M': 183,
  ALL: 1500,
};

const BAR_WIDTH = 34;
const BAR_MAX_HEIGHT = 138;
const CHART_LABEL_HEIGHT = 34;
const CHART_MAX_MS = 10 * 3600_000;
const RULER_HOURS = [8, 6, 4, 2, 0] as const;
const RANGE_TAB_WIDTH = 44;
const RANGE_INDICATOR_WIDTH = RANGE_TAB_WIDTH - 4;
const RANGE_SPRING = {
  damping: 17,
  stiffness: 190,
  mass: 0.8,
  reduceMotion: ReduceMotion.System,
};

const STAGE_COLORS = {
  awake: '#FF7D6B',
  rem: '#08BCD4',
  core: '#0A84FF',
  deep: '#4036B8',
  unspecified: '#8E8E93',
} as const;

const STAGE_EXPLAINERS = [
  {
    key: 'awake',
    label: 'Awake',
    color: STAGE_COLORS.awake,
    ms: (row: HealthDaySleepRow) => row.awakeMs,
    blurb:
      'Time you were awake during the night — tossing, bathroom trips, or brief wake-ups.',
  },
  {
    key: 'rem',
    label: 'REM',
    color: STAGE_COLORS.rem,
    ms: (row: HealthDaySleepRow) => row.remMs,
    blurb:
      'Dreaming sleep. Helps with memory, learning, and mood. Usually grows longer toward morning.',
  },
  {
    key: 'core',
    label: 'Core',
    color: STAGE_COLORS.core,
    ms: (row: HealthDaySleepRow) => row.coreMs,
    blurb:
      'Light sleep that makes up most of the night. Bridges deeper stages and keeps sleep going.',
  },
  {
    key: 'deep',
    label: 'Deep',
    color: STAGE_COLORS.deep,
    ms: (row: HealthDaySleepRow) => row.deepMs,
    blurb:
      'Slow-wave sleep. The most restorative stage for body recovery, usually earlier in the night.',
  },
] as const;

type ChartDay = {
  dateKey: string;
  asleepMs: number;
  row: HealthDaySleepRow | null;
};

function formatDetailDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new TZDate(y!, m! - 1, d!, APP_TIMEZONE);
  return format(date, 'EEEE, MMM d');
}

function shortDayLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new TZDate(y!, m! - 1, d!, APP_TIMEZONE);
  return format(date, 'MMM d');
}

export function SleepDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SleepDetail'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const initialDateKey = route.params.dateKey;

  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [chartDays, setChartDays] = useState<ChartDay[]>([]);
  const [selected, setSelected] = useState<HealthDaySleepRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ChartRange>('W');

  const loadChart = useCallback(async () => {
    try {
      const rows = await listDaySleepBefore(
        shiftDateKey(initialDateKey, 1),
        RANGE_LIMITS[range],
      );
      const days = rows
        .reverse()
        .map(row => ({
          dateKey: row.dateKey,
          asleepMs: row.asleepMs,
          row,
        }));
      setChartDays(days);
      const focusKey =
        days.find(d => d.dateKey === initialDateKey)?.dateKey ??
        days.at(-1)?.dateKey ??
        initialDateKey;
      setSelectedDateKey(focusKey);
      const row =
        days.find(d => d.dateKey === focusKey)?.row ??
        (await getDaySleep(focusKey));
      setSelected(row);
    } finally {
      setLoading(false);
    }
  }, [initialDateKey, range]);

  useEffect(() => {
    void loadChart();
    return subscribeHealthData(() => {
      void loadChart();
    });
  }, [loadChart]);

  const handleSelect = useCallback(async (day: ChartDay) => {
    setSelectedDateKey(day.dateKey);
    if (day.row) {
      setSelected(day.row);
      return;
    }
    setSelected(await getDaySleep(day.dateKey));
  }, []);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  if (loading) {
    return (
      <View
        style={[
          styles.root,
          styles.centered,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20) + 76,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="muted" className="text-sm">
          {formatDetailDate(selectedDateKey)}
        </Text>

        {selected != null && selected.asleepMs > 0 ? (
          <>
            <Text className="mt-2 text-4xl font-bold tracking-tight">
              {formatSleepDetailDuration(selected.asleepMs)}
            </Text>
            {selected.sleepStartAt && selected.sleepEndAt ? (
              <Text variant="muted" className="mt-1 text-base">
                {formatSleepRangeLine(
                  selected.sleepStartAt,
                  selected.sleepEndAt,
                )}
              </Text>
            ) : null}

            <View style={styles.stageList}>
              {STAGE_EXPLAINERS.map(stage => (
                <StageExplainRow
                  key={stage.key}
                  label={stage.label}
                  value={formatStageDuration(stage.ms(selected))}
                  color={stage.color}
                  blurb={stage.blurb}
                />
              ))}
            </View>
          </>
        ) : (
          <Text className="mt-3 text-2xl font-semibold">No sleep data</Text>
        )}

        {chartDays.length > 0 ? (
          <>
            <View style={styles.chartHeading}>
              <Text className="text-sm font-semibold uppercase tracking-wide">
                Sleep history
              </Text>
              <SleepRangeBar selected={range} onChange={setRange} />
            </View>
            <AdaptiveGlassSurface style={styles.chartGlass}>
              <View style={styles.chartGrid}>
                <View style={styles.ruler}>
                  {RULER_HOURS.map(hour => (
                    <Text
                      key={hour}
                      variant="muted"
                      style={[
                        styles.rulerLabel,
                        {
                          bottom:
                            CHART_LABEL_HEIGHT +
                            (hour / 10) * BAR_MAX_HEIGHT -
                            6,
                          color: colors.mutedForeground,
                        },
                      ]}
                    >
                      {hour}h
                    </Text>
                  ))}
                </View>
                <View style={styles.plot}>
                  {RULER_HOURS.map(hour => (
                    <View
                      key={hour}
                      style={[
                        styles.gridLine,
                        {
                          bottom:
                            CHART_LABEL_HEIGHT +
                            (hour / 10) * BAR_MAX_HEIGHT,
                        },
                      ]}
                    />
                  ))}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chartContent}
                  >
                    {chartDays.map(day => {
                      const height = Math.max(
                        18,
                        Math.min(1, day.asleepMs / CHART_MAX_MS) *
                          BAR_MAX_HEIGHT,
                      );
                      const selectedBar = day.dateKey === selectedDateKey;
                      return (
                        <Pressable
                          key={day.dateKey}
                          accessibilityRole="button"
                          accessibilityLabel={`Sleep ${shortDayLabel(day.dateKey)}`}
                          onPress={() => {
                            void handleSelect(day);
                          }}
                          style={styles.barCol}
                        >
                          <View style={styles.barTrack}>
                            <SleepStageBar
                              row={day.row}
                              height={height}
                              selected={selectedBar}
                            />
                          </View>
                          <View style={styles.barFooter}>
                            <Text
                              className="text-[10px]"
                              style={{
                                color: selectedBar
                                  ? colors.foreground
                                  : colors.mutedForeground,
                              }}
                            >
                              {shortDayLabel(day.dateKey)}
                            </Text>
                            {selectedBar ? (
                              <View
                                style={[
                                  styles.selectedDot,
                                  { backgroundColor: colors.primary },
                                ]}
                              />
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </AdaptiveGlassSurface>
          </>
        ) : null}
      </ScrollView>
      <View
        pointerEvents="box-none"
        style={[
          styles.closeWrap,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <MapGlassCircleButton
          accessibilityLabel="Close sleep"
          onPress={handleClose}
        >
          <X size={21} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

function StageExplainRow({
  label,
  value,
  color,
  blurb,
}: {
  label: string;
  value: string;
  color: string;
  blurb: string;
}) {
  return (
    <View style={styles.stageRow}>
      <View style={styles.stageRowHeader}>
        <View style={styles.stageLabelRow}>
          <View style={[styles.stageDot, { backgroundColor: color }]} />
          <Text style={[styles.stageLabel, { color }]}>{label}</Text>
        </View>
        <Text className="text-base font-semibold">{value}</Text>
      </View>
      <Text variant="muted" className="text-[12px] leading-4">
        {blurb}
      </Text>
    </View>
  );
}

function SleepRangeBar({
  selected,
  onChange,
}: {
  selected: ChartRange;
  onChange: (range: ChartRange) => void;
}) {
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const options: ChartRange[] = ['W', 'M', '6M', 'ALL'];
  const selectedIndex = Math.max(options.indexOf(selected), 0);
  const indicatorBackground =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.09)';
  const indicatorX = useSharedValue(selectedIndex * RANGE_TAB_WIDTH);
  const indicatorOpacity = useSharedValue(1);
  const indicatorScaleX = useSharedValue(1);
  const indicatorScaleY = useSharedValue(1);
  const parentScale = useSharedValue(1);

  useEffect(() => {
    indicatorX.value = withSpring(
      selectedIndex * RANGE_TAB_WIDTH,
      RANGE_SPRING,
    );
    indicatorOpacity.value = withSequence(
      withTiming(0.38, {
        duration: 80,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1, {
        duration: 110,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
    indicatorScaleX.value = withSequence(
      withTiming(1.22, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, RANGE_SPRING),
    );
    indicatorScaleY.value = withSequence(
      withTiming(1.18, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, RANGE_SPRING),
    );
    parentScale.value = withSequence(
      withTiming(1.035, {
        duration: 105,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, RANGE_SPRING),
    );
  }, [
    indicatorOpacity,
    indicatorScaleX,
    indicatorScaleY,
    indicatorX,
    parentScale,
    selectedIndex,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [
      { translateX: indicatorX.value },
      { scaleX: indicatorScaleX.value },
      { scaleY: indicatorScaleY.value },
    ],
  }));
  const parentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: parentScale.value }],
  }));

  return (
    <Animated.View style={[styles.rangeShadow, parentStyle]}>
      <AdaptiveGlassSurface style={styles.rangeGlass}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.rangeSelection,
            { backgroundColor: indicatorBackground },
            indicatorStyle,
          ]}
        />
        {options.map(option => {
          const active = option === selected;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Show ${option} sleep history`}
              onPress={() => onChange(option)}
              style={styles.rangeTab}
            >
              <Text
                style={[
                  styles.rangeLabel,
                  {
                    color: active
                      ? colors.primary
                      : colors.mutedForeground,
                  },
                  active ? styles.rangeLabelSelected : null,
                ]}
              >
                {option}
              </Text>
            </Pressable>
          );
        })}
      </AdaptiveGlassSurface>
    </Animated.View>
  );
}

function SleepStageBar({
  row,
  height,
  selected,
}: {
  row: HealthDaySleepRow | null;
  height: number;
  selected: boolean;
}) {
  if (row == null || row.asleepMs <= 0) {
    return null;
  }
  const total = Math.max(
    1,
    row.awakeMs +
      row.remMs +
      row.coreMs +
      row.deepMs +
      row.unspecifiedMs,
  );
  const segments = [
    { key: 'awake', ms: row.awakeMs, color: STAGE_COLORS.awake },
    { key: 'rem', ms: row.remMs, color: STAGE_COLORS.rem },
    { key: 'core', ms: row.coreMs, color: STAGE_COLORS.core },
    { key: 'deep', ms: row.deepMs, color: STAGE_COLORS.deep },
    {
      key: 'unspecified',
      ms: row.unspecifiedMs,
      color: STAGE_COLORS.unspecified,
    },
  ].filter(segment => segment.ms > 0);

  return (
    <View
      style={[
        styles.stackedBar,
        { height, opacity: selected ? 1 : 0.64 },
      ]}
    >
      {segments.map(segment => (
        <View
          key={segment.key}
          style={{
            flex: segment.ms / total,
            backgroundColor: segment.color,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageList: {
    marginTop: 22,
    gap: 16,
  },
  stageRow: {
    gap: 4,
  },
  stageRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  stageLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  chartHeading: {
    marginTop: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rangeShadow: {
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 5,
      },
    }),
  },
  rangeGlass: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderRadius: 20,
    overflow: 'hidden',
  },
  rangeTab: {
    width: RANGE_TAB_WIDTH,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeSelection: {
    position: 'absolute',
    left: 5,
    top: 4,
    width: RANGE_INDICATOR_WIDTH,
    height: 32,
    borderRadius: 16,
  },
  rangeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  rangeLabelSelected: {
    fontWeight: '700',
  },
  chartGlass: {
    marginTop: 12,
    borderRadius: 22,
    overflow: 'hidden',
  },
  chartGrid: {
    height: BAR_MAX_HEIGHT + 60,
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingTop: 12,
    paddingBottom: 10,
  },
  ruler: {
    width: 30,
    height: BAR_MAX_HEIGHT + CHART_LABEL_HEIGHT,
  },
  rulerLabel: {
    position: 'absolute',
    right: 6,
    fontSize: 9,
  },
  plot: {
    flex: 1,
    height: BAR_MAX_HEIGHT + CHART_LABEL_HEIGHT,
    overflow: 'hidden',
  },
  chartContent: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: 12,
    paddingHorizontal: 8,
    zIndex: 2,
  },
  barCol: {
    width: BAR_WIDTH,
    alignItems: 'center',
  },
  barTrack: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'flex-end',
  },
  barFooter: {
    height: CHART_LABEL_HEIGHT,
    alignItems: 'center',
    paddingTop: 8,
  },
  stackedBar: {
    width: BAR_WIDTH - 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(127,127,127,0.18)',
  },
  selectedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
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
