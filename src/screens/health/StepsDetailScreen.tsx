import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, X } from 'lucide-react-native';
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
  getDaySteps,
  listDayStepsBefore,
  type HealthDayStepsRow,
} from '@/db/repositories/health';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { shiftDateKey } from '@/lib/day-utils';
import { subscribeHealthData } from '@/lib/healthkit/events';
import { syncHealthKitOnDemand } from '@/lib/healthkit/sync';
import { APP_TIMEZONE } from '@/lib/timezone';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';

type ChartRange = 'W' | 'M' | '6M' | 'ALL';

const RANGE_LIMITS: Record<ChartRange, number> = {
  W: 7,
  M: 30,
  '6M': 183,
  ALL: 1500,
};

const STEPS_COLOR = '#FF9F0A';
const BAR_WIDTH = 34;
const BAR_MAX_HEIGHT = 138;
const BAR_DRAW_HEIGHT = BAR_MAX_HEIGHT - 16;
const CHART_LABEL_HEIGHT = 34;
const RANGE_TAB_WIDTH = 44;
const RANGE_INDICATOR_WIDTH = RANGE_TAB_WIDTH - 4;
const RANGE_SPRING = {
  damping: 17,
  stiffness: 190,
  mass: 0.8,
  reduceMotion: ReduceMotion.System,
};

function detailDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return format(new TZDate(y!, m! - 1, d!, APP_TIMEZONE), 'EEEE, MMM d');
}

function shortDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return format(new TZDate(y!, m! - 1, d!, APP_TIMEZONE), 'MMM d');
}

/** Whole-thousand labels only: 0, 1k, 2k, 10k. */
function formatStepTick(steps: number): string {
  if (steps <= 0) {
    return '0';
  }
  if (steps < 1000) {
    return String(Math.round(steps));
  }
  return `${Math.round(steps / 1000)}k`;
}

/**
 * Scale like sleep’s hour ruler: even ticks from 0 to max, every tick has a grid line.
 * Caps at 4 intervals above the data (e.g. 0/1k/2k/3k/4k or 0/2k/4k/6k/8k).
 */
function chartScale(rows: HealthDayStepsRow[]): {
  max: number;
  ticks: number[];
} {
  const highest = Math.max(0, ...rows.map(row => row.steps));
  const step =
    highest <= 4_000 ? 1_000 : highest <= 12_000 ? 2_000 : 5_000;
  const max = Math.max(step * 4, Math.ceil(Math.max(highest, 1) / step) * step);
  const ticks: number[] = [];
  for (let value = max; value >= 0; value -= step) {
    ticks.push(value);
  }
  return { max, ticks };
}

export function StepsDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'StepsDetail'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const closesToMap = useClosesToMap();
  const initialDateKey = route.params.dateKey;

  const [range, setRange] = useState<ChartRange>('W');
  const [rows, setRows] = useState<HealthDayStepsRow[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [selectedSteps, setSelectedSteps] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadChart = useCallback(async (isCancelled?: () => boolean) => {
    try {
      const newestFirst = await listDayStepsBefore(
        shiftDateKey(initialDateKey, 1),
        RANGE_LIMITS[range],
      );
      if (isCancelled?.()) {
        return;
      }
      const nextRows = newestFirst.reverse();
      setRows(nextRows);
      const focusKey =
        nextRows.find(row => row.dateKey === initialDateKey)?.dateKey ??
        nextRows.at(-1)?.dateKey ??
        initialDateKey;
      if (isCancelled?.()) {
        return;
      }
      setSelectedDateKey(focusKey);
      const focused = nextRows.find(row => row.dateKey === focusKey);
      const steps = focused?.steps ?? (await getDaySteps(focusKey));
      if (isCancelled?.()) {
        return;
      }
      setSelectedSteps(steps);
    } finally {
      if (!isCancelled?.()) {
        setLoading(false);
      }
    }
  }, [initialDateKey, range]);

  const loadChartRef = useRef(loadChart);
  loadChartRef.current = loadChart;
  const skipRangeLoadRef = useRef(true);

  // Subscription + local range reloads (no HealthKit sync).
  useEffect(() => {
    let cancelled = false;
    if (skipRangeLoadRef.current) {
      skipRangeLoadRef.current = false;
    } else {
      void loadChart(() => cancelled);
    }
    const unsubscribe = subscribeHealthData(() => {
      void loadChart(() => cancelled);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadChart]);

  // On-demand sync only on focus/blur — not when the chart range changes.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        try {
          await syncHealthKitOnDemand();
        } catch {
          // Detail screen still shows last cached totals.
        }
        if (cancelled) {
          return;
        }
        await loadChartRef.current(() => cancelled);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const handleSelect = useCallback((row: HealthDayStepsRow) => {
    setSelectedDateKey(row.dateKey);
    setSelectedSteps(row.steps);
  }, []);

  const { max: maxSteps, ticks } = useMemo(() => chartScale(rows), [rows]);

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
          {detailDate(selectedDateKey)}
        </Text>

        {selectedSteps != null ? (
          <>
            <Text className="mt-2 text-4xl font-bold tracking-tight">
              {selectedSteps.toLocaleString()}
            </Text>
            <Text variant="muted" className="mt-1 text-base">
              steps
            </Text>
          </>
        ) : (
          <Text className="mt-3 text-2xl font-semibold">No steps data</Text>
        )}

        {rows.length > 0 ? (
          <>
            <View style={styles.chartHeading}>
              <Text className="text-sm font-semibold uppercase tracking-wide">
                Steps history
              </Text>
              <StepsRangeBar selected={range} onChange={setRange} />
            </View>
            <AdaptiveGlassSurface style={styles.chartGlass}>
              <View style={styles.chartGrid}>
                <View style={styles.ruler}>
                  {ticks.map(tick => (
                    <Text
                      key={tick}
                      variant="muted"
                      style={[
                        styles.rulerLabel,
                        {
                          bottom:
                            CHART_LABEL_HEIGHT +
                            (tick / maxSteps) * BAR_DRAW_HEIGHT -
                            6,
                          color: colors.mutedForeground,
                        },
                      ]}
                    >
                      {formatStepTick(tick)}
                    </Text>
                  ))}
                </View>
                <View style={styles.plot}>
                  {ticks.map(tick => (
                    <View
                      key={tick}
                      style={[
                        styles.gridLine,
                        {
                          bottom:
                            CHART_LABEL_HEIGHT +
                            (tick / maxSteps) * BAR_DRAW_HEIGHT,
                        },
                      ]}
                    />
                  ))}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chartContent}
                  >
                    {rows.map(row => {
                      const height = Math.max(
                        row.steps > 0 ? 3 : 0,
                        (row.steps / maxSteps) * BAR_DRAW_HEIGHT,
                      );
                      const selected = row.dateKey === selectedDateKey;
                      return (
                        <Pressable
                          key={row.dateKey}
                          accessibilityRole="button"
                          accessibilityLabel={`${shortDate(row.dateKey)}, ${row.steps.toLocaleString()} steps`}
                          onPress={() => handleSelect(row)}
                          style={styles.barCol}
                        >
                          <View style={styles.barTrack}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.barValue,
                                {
                                  bottom: height + 3,
                                  color: selected
                                    ? colors.foreground
                                    : colors.mutedForeground,
                                },
                              ]}
                            >
                              {row.steps.toLocaleString()}
                            </Text>
                            <View
                              style={[
                                styles.stepsBar,
                                {
                                  height,
                                  backgroundColor: STEPS_COLOR,
                                  opacity: selected ? 1 : 0.55,
                                },
                              ]}
                            />
                          </View>
                          <View style={styles.barFooter}>
                            <Text
                              className="text-[10px]"
                              style={{
                                color: selected
                                  ? colors.foreground
                                  : colors.mutedForeground,
                              }}
                            >
                              {shortDate(row.dateKey)}
                            </Text>
                            {selected ? (
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
          accessibilityLabel={closesToMap ? 'Close steps' : 'Back'}
          onPress={handleClose}
        >
          {closesToMap ? (
            <X size={21} color={colors.primary} strokeWidth={2.25} />
          ) : (
            <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
          )}
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

function StepsRangeBar({
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
  const indicatorScaleX = useSharedValue(1);
  const parentScale = useSharedValue(1);

  useEffect(() => {
    indicatorX.value = withSpring(
      selectedIndex * RANGE_TAB_WIDTH,
      RANGE_SPRING,
    );
    indicatorScaleX.value = withSequence(
      withTiming(1.22, {
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
  }, [indicatorScaleX, indicatorX, parentScale, selectedIndex]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorX.value },
      { scaleX: indicatorScaleX.value },
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
              accessibilityLabel={`Show ${option} steps history`}
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
    width: 34,
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
    position: 'relative',
    alignItems: 'center',
  },
  barValue: {
    position: 'absolute',
    minWidth: 52,
    textAlign: 'center',
    fontSize: 8,
    fontWeight: '600',
  },
  stepsBar: {
    width: BAR_WIDTH - 8,
    borderRadius: 8,
  },
  barFooter: {
    height: CHART_LABEL_HEIGHT,
    alignItems: 'center',
    paddingTop: 8,
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
