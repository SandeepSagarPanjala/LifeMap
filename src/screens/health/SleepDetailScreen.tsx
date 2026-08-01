import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { ChevronDown, ChevronLeft, ChevronUp, Info, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
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
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { Text } from '@/components/ui/text';
import {
  getDaySleep,
  listDaySleepBefore,
  listSleepSamplesOverlapping,
  type HealthDaySleepRow,
  type HealthSleepSampleRow,
} from '@/db/repositories/health';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { shiftDateKey } from '@/lib/day-utils';
import {
  formatSleepDetailDuration,
  formatSleepDetailMinutes,
  formatSleepRangeLine,
  formatStageDuration,
  sleepAsleepDisplayMinutes,
  sleepAsleepDisplayMs,
} from '@/lib/healthkit/display';
import { subscribeHealthData } from '@/lib/healthkit/events';
import {
  SLEEP_SCORE_FORMULA_FOOTNOTE,
  SLEEP_STAGE_AIMS,
  SLEEP_STAGES_AIM_COPY,
  computeLifeMapSleepScore,
  type SleepScoreResult,
} from '@/lib/healthkit/sleep-score';
import {
  buildSleepTimelineModel,
  timelineLeftPct,
} from '@/lib/healthkit/sleep-timeline';
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
      "It takes time to fall asleep and we wake up periodically throughout the night. This time is represented as Awake in your charts.",
  },
  {
    key: 'rem',
    label: 'REM',
    color: STAGE_COLORS.rem,
    ms: (row: HealthDaySleepRow) => row.remMs,
    blurb:
      'Studies show that REM sleep may play a key role in memory and refreshing your brain. It’s where most of your dreaming happens. REM sleep first occurs about 90 minutes after falling asleep.',
  },
  {
    key: 'core',
    label: 'Core',
    color: STAGE_COLORS.core,
    // Fold unspecified asleep into Core (matches history bars / Apple-style display).
    ms: (row: HealthDaySleepRow) => row.coreMs + row.unspecifiedMs,
    blurb:
      'This stage, where muscle activity lowers and body temperature drops, represents the bulk of your time asleep. While it’s sometimes referred to as light sleep, it’s just as critical as any other sleep stage.',
  },
  {
    key: 'deep',
    label: 'Deep',
    color: STAGE_COLORS.deep,
    ms: (row: HealthDaySleepRow) => row.deepMs,
    blurb:
      'Also known as slow wave sleep, this stage allows the body to repair itself and release essential hormones. It happens in longer periods during the first half of the night.',
  },
] as const;

const STAGE_INFO_INTRO =
  'While we sleep, our brains and bodies restore themselves. Each sleep stage plays a different role, but they’re all essential to waking up refreshed.';

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
  const closesToMap = useClosesToMap();
  const initialDateKey = route.params.dateKey;

  const [selectedDateKey, setSelectedDateKey] = useState(initialDateKey);
  const [chartDays, setChartDays] = useState<ChartDay[]>([]);
  const [selected, setSelected] = useState<HealthDaySleepRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ChartRange>('W');
  const [stagesInfoOpen, setStagesInfoOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scoreExpanded, setScoreExpanded] = useState(false);
  const [timelineSamples, setTimelineSamples] = useState<
    HealthSleepSampleRow[]
  >([]);

  const loadChart = useCallback(async (isCancelled?: () => boolean) => {
    try {
      const rows = await listDaySleepBefore(
        shiftDateKey(initialDateKey, 1),
        RANGE_LIMITS[range],
      );
      if (isCancelled?.()) {
        return;
      }
      const days = rows
        .reverse()
        .map(row => ({
          dateKey: row.dateKey,
          asleepMs: sleepAsleepDisplayMs({
            remMs: row.remMs,
            coreMs: row.coreMs,
            deepMs: row.deepMs,
            unspecifiedMs: row.unspecifiedMs,
          }),
          row,
        }));
      if (isCancelled?.()) {
        return;
      }
      setChartDays(days);
      const focusKey =
        days.find(d => d.dateKey === initialDateKey)?.dateKey ??
        days.at(-1)?.dateKey ??
        initialDateKey;
      if (isCancelled?.()) {
        return;
      }
      setSelectedDateKey(focusKey);
      const row =
        days.find(d => d.dateKey === focusKey)?.row ??
        (await getDaySleep(focusKey));
      if (isCancelled?.()) {
        return;
      }
      setSelected(row);
    } finally {
      if (!isCancelled?.()) {
        setLoading(false);
      }
    }
  }, [initialDateKey, range]);

  useEffect(() => {
    let cancelled = false;
    void loadChart(() => cancelled);
    const unsubscribe = subscribeHealthData(() => {
      void loadChart(() => cancelled);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [loadChart]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setSyncing(true);
      void (async () => {
        try {
          await syncHealthKitOnDemand();
        } catch {
          // Detail screen still shows last cached rollups.
        }
        if (cancelled) {
          return;
        }
        setSyncing(false);
        await loadChart(() => cancelled);
      })();
      return () => {
        cancelled = true;
        setSyncing(false);
      };
    }, [loadChart]),
  );

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

  const sleepScore = useMemo(() => {
    if (selected == null || selected.asleepMs <= 0) {
      return null;
    }
    return computeLifeMapSleepScore({
      asleepMs: selected.asleepMs,
      awakeMs: selected.awakeMs,
      awakeningsOver5Min: selected.awakeningsOver5Min,
      remMs: selected.remMs,
      coreMs: selected.coreMs,
      deepMs: selected.deepMs,
    });
  }, [selected]);

  const asleepDisplayLabel = useMemo(() => {
    if (selected == null || selected.asleepMs <= 0) {
      return null;
    }
    return formatSleepDetailMinutes(
      sleepAsleepDisplayMinutes({
        remMs: selected.remMs,
        coreMs: selected.coreMs,
        deepMs: selected.deepMs,
        unspecifiedMs: selected.unspecifiedMs,
      }),
    );
  }, [selected]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (
        selected?.sleepStartAt == null ||
        selected.sleepEndAt == null ||
        selected.asleepMs <= 0
      ) {
        if (!cancelled) {
          setTimelineSamples([]);
        }
        return;
      }
      try {
        const samples = await listSleepSamplesOverlapping(
          selected.sleepStartAt,
          selected.sleepEndAt,
        );
        if (!cancelled) {
          setTimelineSamples(samples);
        }
      } catch {
        if (!cancelled) {
          setTimelineSamples([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

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
            <View style={styles.durationRow}>
              <Text className="text-4xl font-bold tracking-tight">
                {asleepDisplayLabel ??
                  formatSleepDetailDuration(selected.asleepMs)}
              </Text>
              <MapGlassCircleButton
                accessibilityLabel="About sleep stages and score"
                onPress={() => setStagesInfoOpen(true)}
                size={32}
              >
                <Info size={16} color={colors.primary} strokeWidth={2.25} />
              </MapGlassCircleButton>
            </View>
            {selected.sleepStartAt && selected.sleepEndAt ? (
              <Text variant="muted" className="mt-1 text-base">
                {formatSleepRangeLine(
                  selected.sleepStartAt,
                  selected.sleepEndAt,
                )}
              </Text>
            ) : null}

            <View style={styles.stageChips}>
              {STAGE_EXPLAINERS.map(stage => (
                <StageChip
                  key={stage.key}
                  label={stage.label}
                  value={formatStageDuration(stage.ms(selected))}
                  color={stage.color}
                />
              ))}
            </View>

            {selected.sleepStartAt && selected.sleepEndAt ? (
              <SleepTimelineGraph
                samples={timelineSamples}
                windowStart={selected.sleepStartAt}
                windowEnd={selected.sleepEndAt}
                labelColor={colors.mutedForeground}
              />
            ) : null}

            {sleepScore != null ? (
              <SleepScoreCard
                score={sleepScore}
                expanded={scoreExpanded}
                onToggleExpand={() => setScoreExpanded(value => !value)}
              />
            ) : null}

            {syncing ? (
              <Text variant="muted" className="mt-3 text-[12px]">
                Updating from Apple Health…
              </Text>
            ) : null}
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
      <AppBottomSheet
        visible={stagesInfoOpen}
        onClose={() => setStagesInfoOpen(false)}
        enableDynamicSizing
        scrollable
      >
        <View style={styles.infoSheetHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            onPress={() => setStagesInfoOpen(false)}
            style={styles.infoCloseButton}
          >
            <X size={18} color={colors.primary} strokeWidth={2.25} />
          </Pressable>
          <Text className="text-[17px] font-semibold">Sleep Stages</Text>
          <View style={styles.infoCloseSpacer} />
        </View>
        <Text variant="muted" className="mb-4 text-[14px] leading-5">
          {STAGE_INFO_INTRO}
        </Text>
        <View style={styles.infoStageList}>
          {STAGE_EXPLAINERS.map(stage => (
            <View key={stage.key} style={styles.infoStageRow}>
              <View
                style={[
                  styles.stageDot,
                  styles.infoStageDot,
                  { backgroundColor: stage.color },
                ]}
              />
              <View style={styles.infoStageCopy}>
                <Text className="text-[15px] font-semibold">{stage.label}</Text>
                <Text variant="muted" className="mt-1 text-[13px] leading-5">
                  {stage.blurb}
                </Text>
              </View>
            </View>
          ))}
        </View>
        <Text className="mt-5 text-[15px] font-semibold">Sleep score</Text>
        <Text variant="muted" className="mt-1 text-[13px] leading-5">
          Duration is half the score (toward 8 hours). Continuity is sleep
          efficiency (asleep ÷ time in bed). Stages reward healthy Deep and REM
          amounts on a 7–9 hour night ({SLEEP_STAGES_AIM_COPY.replace(/^Aim for /, '')}).
          Not Apple Sleep Score.
        </Text>
      </AppBottomSheet>
      <View
        pointerEvents="box-none"
        style={[
          styles.closeWrap,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <MapGlassCircleButton
          accessibilityLabel={closesToMap ? 'Close sleep' : 'Back'}
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

function StageChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.stageChip}>
      <View style={styles.stageLabelRow}>
        <View style={[styles.stageDot, { backgroundColor: color }]} />
        <Text style={[styles.stageChipLabel, { color }]}>{label}</Text>
      </View>
      <Text className="mt-1 text-[15px] font-semibold">{value}</Text>
    </View>
  );
}

/** Soft sleep blue — clearer than map accent green on a light timeline. */
const TIMELINE_SLEEP_BAR = '#5B8DEF';
const TIMELINE_RULE = 'rgba(142, 142, 147, 0.4)';

function SleepTimelineGraph({
  samples,
  windowStart,
  windowEnd,
  labelColor,
}: {
  samples: HealthSleepSampleRow[];
  windowStart: Date;
  windowEnd: Date;
  labelColor: string;
}) {
  const model = useMemo(
    () => buildSleepTimelineModel(samples, windowStart, windowEnd),
    [samples, windowStart, windowEnd],
  );
  const { axisStartMs, axisEndMs, blocks, ticks } = model;
  const [plotWidth, setPlotWidth] = useState(0);
  const labeledTicks = ticks.filter(tick => tick.label != null);

  return (
    <View style={styles.timelineWrap}>
      <View
        style={styles.timelinePlot}
        onLayout={event => setPlotWidth(event.nativeEvent.layout.width)}
      >
        {plotWidth > 0 ? (
          <Svg width={plotWidth} height={56}>
            {ticks.map((tick, index) => {
              const x =
                (timelineLeftPct(tick.atMs, axisStartMs, axisEndMs) / 100) *
                plotWidth;
              const lineX = Math.min(plotWidth - 1, Math.max(0, x));
              return (
                <Rect
                  key={`rule-${index}`}
                  x={lineX}
                  y={0}
                  width={StyleSheet.hairlineWidth * 2}
                  height={40}
                  fill={TIMELINE_RULE}
                />
              );
            })}
            {blocks.map((block, index) => {
              const left =
                (timelineLeftPct(block.startMs, axisStartMs, axisEndMs) /
                  100) *
                plotWidth;
              const right =
                (timelineLeftPct(block.endMs, axisStartMs, axisEndMs) / 100) *
                plotWidth;
              const width = Math.max(2, right - left);
              return (
                <Rect
                  key={`block-${index}`}
                  x={left}
                  y={10}
                  width={width}
                  height={20}
                  rx={5}
                  ry={5}
                  fill={TIMELINE_SLEEP_BAR}
                />
              );
            })}
          </Svg>
        ) : null}
      </View>
      <View style={styles.timelineTicks}>
        {labeledTicks.map((tick, index) => {
          const isLast = index === labeledTicks.length - 1;
          const isFirst = index === 0;
          return (
            <Text
              key={`label-${tick.atMs}`}
              numberOfLines={1}
              style={[
                styles.timelineTickLabel,
                {
                  color: labelColor,
                  left: `${timelineLeftPct(tick.atMs, axisStartMs, axisEndMs)}%`,
                  transform: [
                    {
                      translateX: isFirst ? 0 : isLast ? -32 : -14,
                    },
                  ],
                },
              ]}
            >
              {tick.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

function SleepScoreCard({
  score,
  expanded,
  onToggleExpand,
}: {
  score: SleepScoreResult;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const colors = useThemeColors();
  const bandColor =
    score.total >= 75
      ? '#34C759'
      : score.total >= 50
        ? '#FF9F0A'
        : '#FF3B30';

  return (
    <AdaptiveGlassSurface style={styles.scoreCard}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={
          expanded ? 'Collapse sleep score details' : 'Expand sleep score details'
        }
        onPress={onToggleExpand}
        style={styles.scoreHeaderPressable}
      >
        <View style={styles.scoreHeaderTop}>
          <Text
            variant="muted"
            className="text-[11px] font-semibold uppercase tracking-wide"
          >
            LifeMap Sleep Score
          </Text>
          <View style={styles.expandChip}>
            <Text style={[styles.expandChipLabel, { color: colors.primary }]}>
              {expanded ? 'Collapse' : 'Expand'}
            </Text>
            {expanded ? (
              <ChevronUp size={16} color={colors.primary} strokeWidth={2.25} />
            ) : (
              <ChevronDown size={16} color={colors.primary} strokeWidth={2.25} />
            )}
          </View>
        </View>
        <View style={styles.scoreHero}>
          <Text
            className="text-[44px] font-bold leading-[52px] tracking-tight"
            style={{ color: bandColor }}
          >
            {score.total}
          </Text>
          <View
            style={[styles.bandPill, { backgroundColor: `${bandColor}22` }]}
          >
            <View style={[styles.bandDot, { backgroundColor: bandColor }]} />
            <Text style={[styles.bandLabel, { color: bandColor }]}>
              {score.band}
            </Text>
          </View>
        </View>
      </Pressable>

      <ScoreGauge score={score.total} />

      {expanded ? (
        <>
          <ScoreMetricRow
            title="Duration"
            points={score.durationPoints}
            maxPoints={50}
            barColor="#0A84FF"
            detail="Aim for 7–9 hours of sleep."
          />
          <ScoreMetricRow
            title="Stages"
            points={score.compositionPoints}
            maxPoints={30}
            barColor="#5856D6"
            detail="On a 7–9 hour night, aim for:"
          >
            <View style={styles.stageSubRows}>
              {SLEEP_STAGE_AIMS.map(stage => (
                <StageSubRow
                  key={stage.key}
                  label={stage.label}
                  value={stage.aim}
                  color={stage.color}
                />
              ))}
            </View>
          </ScoreMetricRow>
          <ScoreMetricRow
            title="Continuity"
            points={score.efficiencyPoints}
            maxPoints={20}
            barColor="#32ADE6"
            detail={`Awake ${score.awakePct}% of the night. Full points when efficiency is ≥85%.`}
          />
          <View style={styles.scoreFooter}>
            <Text variant="muted" className="text-[11px]">
              {SLEEP_SCORE_FORMULA_FOOTNOTE}
            </Text>
            <Text style={[styles.scoreTarget, { color: bandColor }]}>
              Target 75+ · {score.band}
            </Text>
          </View>
        </>
      ) : null}
    </AdaptiveGlassSurface>
  );
}

function StageSubRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.stageSubRow}>
      <View style={styles.stageLabelRow}>
        <View style={[styles.stageDot, { backgroundColor: color }]} />
        <Text style={[styles.stageSubLabel, { color }]}>{label}</Text>
      </View>
      <Text className="text-[13px] font-semibold">{value}</Text>
    </View>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <View style={styles.gaugeWrap}>
      <Svg width="100%" height={10} viewBox="0 0 100 10" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="sleepScoreGauge" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#FF3B30" />
            <Stop offset="45%" stopColor="#FF9F0A" />
            <Stop offset="100%" stopColor="#34C759" />
          </LinearGradient>
        </Defs>
        <Rect
          x="0"
          y="2"
          width="100"
          height="6"
          rx="3"
          fill="url(#sleepScoreGauge)"
        />
      </Svg>
      <View
        pointerEvents="none"
        style={[styles.gaugeThumb, { left: `${clamped}%` }]}
      />
    </View>
  );
}

function ScoreMetricRow({
  title,
  points,
  maxPoints,
  barColor,
  detail,
  children,
}: {
  title: string;
  points: number;
  maxPoints: number;
  barColor: string;
  detail: string;
  children?: ReactNode;
}) {
  const ratio = maxPoints > 0 ? Math.min(1, points / maxPoints) : 0;
  return (
    <View style={styles.metricBlock}>
      <View style={styles.metricHeader}>
        <Text className="text-[15px] font-semibold">{title}</Text>
        <Text className="text-[15px] font-semibold">
          {points}/{maxPoints}
        </Text>
      </View>
      <View style={styles.metricTrack}>
        <View
          style={[
            styles.metricFill,
            {
              width: `${Math.round(ratio * 100)}%`,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
      <Text variant="muted" className="mt-1.5 text-[12px] leading-4">
        {detail}
      </Text>
      {children}
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
  // Fold unspecified asleep into Core for the history chart — that gray was
  // "asleep without a Watch stage," already counted in Time Asleep but not
  // shown in the stage chips.
  const coreDisplayMs = row.coreMs + row.unspecifiedMs;
  const total = Math.max(
    1,
    row.awakeMs + row.remMs + coreDisplayMs + row.deepMs,
  );
  const segments = [
    { key: 'awake', ms: row.awakeMs, color: STAGE_COLORS.awake },
    { key: 'rem', ms: row.remMs, color: STAGE_COLORS.rem },
    { key: 'core', ms: coreDisplayMs, color: STAGE_COLORS.core },
    { key: 'deep', ms: row.deepMs, color: STAGE_COLORS.deep },
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
    paddingHorizontal: 20,
  },
  durationRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stageChips: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  stageChip: {
    minWidth: '22%',
    flexGrow: 1,
    flexBasis: '22%',
  },
  stageChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  scoreCard: {
    marginTop: 18,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
    overflow: 'visible',
  },
  scoreHeaderPressable: {
    gap: 8,
  },
  scoreHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  expandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  expandChipLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  scoreHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  bandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  bandDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  bandLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  timelineWrap: {
    marginTop: 18,
    marginBottom: 4,
  },
  timelinePlot: {
    height: 56,
    width: '100%',
  },
  timelineTicks: {
    marginTop: 2,
    height: 16,
    position: 'relative',
  },
  timelineTickLabel: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  stageSubRows: {
    marginTop: 10,
    gap: 8,
  },
  stageSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stageSubLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  gaugeWrap: {
    height: 18,
    justifyContent: 'center',
  },
  gaugeThumb: {
    position: 'absolute',
    top: 1,
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.18)',
  },
  metricBlock: {
    gap: 6,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(120,120,128,0.18)',
    overflow: 'hidden',
  },
  metricFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  scoreTarget: {
    fontSize: 11,
    fontWeight: '600',
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  infoCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCloseSpacer: {
    width: 32,
  },
  infoStageList: {
    gap: 18,
    paddingBottom: 8,
  },
  infoStageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoStageCopy: {
    flex: 1,
  },
  stageLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  infoStageDot: {
    marginTop: 5,
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
