import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { Text } from '@/components/ui/text';
import type { ActivityRow } from '@/db/repositories/activities';
import type { MomentRow } from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  buildActivityExperience,
  type ActivityInsightCandidate,
} from '@/lib/activities/activity-experience';
import {
  buildInsightCalendarMonth,
  countLogsByDateKey,
  listMonthsInclusive,
  resolveInsightCalendarStartDate,
  type InsightCalendarCell,
  type InsightCalendarCellState,
} from '@/lib/activities/activity-insights';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { useAppStore } from '@/stores/app-store';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const INTENT_THEME: Record<
  ActivityIntent,
  {
    tint: string;
    strong: string;
    soft: string;
    chipBg: string;
  }
> = {
  more: {
    tint: '#ECFDF5',
    strong: '#059669',
    soft: '#A7F3D0',
    chipBg: '#D1FAE5',
  },
  less: {
    tint: '#FFF7ED',
    strong: '#EA580C',
    soft: '#FED7AA',
    chipBg: '#FFEDD5',
  },
  track: {
    tint: '#EFF6FF',
    strong: '#2563EB',
    soft: '#BFDBFE',
    chipBg: '#DBEAFE',
  },
};

const CELL_FILL: Record<InsightCalendarCellState, string> = {
  success: '#34D399',
  miss: '#FCA5A5',
  relapse: '#FB923C',
  empty: 'transparent',
  future: '#E5E7EB',
  unscheduled: '#F3F4F6',
};

function SectionCard({
  title,
  children,
  tint,
  accent,
}: {
  title?: string;
  children: ReactNode;
  tint: string;
  accent: string;
}) {
  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.section, { backgroundColor: tint }]}
    >
      {title != null ? (
        <Text style={[styles.sectionTitle, { color: accent }]}>{title}</Text>
      ) : null}
      {children}
    </Animated.View>
  );
}

function OverviewGrid({
  items,
  muted,
  foreground,
}: {
  items: Array<{ label: string; value: string }>;
  muted: string;
  foreground: string;
}) {
  return (
    <View style={styles.overviewGrid}>
      {items.map(item => (
        <View key={item.label} style={styles.overviewCell}>
          <Text style={[styles.overviewLabel, { color: muted }]}>
            {item.label}
          </Text>
          <RNText
            style={[styles.overviewValue, { color: foreground }]}
            allowFontScaling={false}
            numberOfLines={1}
          >
            {item.value}
          </RNText>
        </View>
      ))}
    </View>
  );
}

function HourHistogram({
  counts,
  peakHour,
  accent,
  soft,
}: {
  counts: number[];
  peakHour: number;
  accent: string;
  soft: string;
}) {
  const max = Math.max(1, ...counts);
  return (
    <View style={styles.histogram}>
      {counts.map((count, hour) => {
        const height = Math.max(3, Math.round((count / max) * 36));
        const isPeak = hour === peakHour;
        return (
          <View key={hour} style={styles.histogramBarWrap}>
            <View
              style={[
                styles.histogramBar,
                {
                  height,
                  backgroundColor: isPeak ? accent : soft,
                  opacity: count === 0 ? 0.25 : 1,
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

function WeekdayBars({
  counts,
  peakWeekday,
  accent,
  soft,
  muted,
}: {
  counts: number[];
  peakWeekday: number;
  accent: string;
  soft: string;
  muted: string;
}) {
  const max = Math.max(1, ...counts);
  return (
    <View style={styles.weekdayRow}>
      {counts.map((count, day) => {
        const height = Math.max(4, Math.round((count / max) * 40));
        const isPeak = day === peakWeekday;
        return (
          <View key={day} style={styles.weekdayCell}>
            <View
              style={[
                styles.weekdayBar,
                {
                  height,
                  backgroundColor: isPeak ? accent : soft,
                  opacity: count === 0 ? 0.3 : 1,
                },
              ]}
            />
            <Text
              style={[
                styles.weekdayLabel,
                { color: isPeak ? accent : muted, fontWeight: isPeak ? '800' : '600' },
              ]}
            >
              {WEEKDAY_SHORT[day]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function InsightBody({
  insight,
  accent,
  soft,
  muted,
  foreground,
}: {
  insight: ActivityInsightCandidate;
  accent: string;
  soft: string;
  muted: string;
  foreground: string;
}) {
  return (
    <View style={styles.insightBody}>
      <Text style={[styles.insightSentence, { color: foreground }]}>
        {insight.sentence}
      </Text>
      {insight.subtitle != null ? (
        <Text style={[styles.insightSubtitle, { color: muted }]}>
          {insight.subtitle}
        </Text>
      ) : null}
      {insight.viz?.kind === 'hour_histogram' ? (
        <HourHistogram
          counts={insight.viz.counts}
          peakHour={insight.viz.peakHour}
          accent={accent}
          soft={soft}
        />
      ) : null}
      {insight.viz?.kind === 'weekday_bars' ? (
        <WeekdayBars
          counts={insight.viz.counts}
          peakWeekday={insight.viz.peakWeekday}
          accent={accent}
          soft={soft}
          muted={muted}
        />
      ) : null}
      {insight.viz?.kind === 'change' && insight.viz.percent != null ? (
        <RNText
          style={[
            styles.changePercent,
            { color: insight.viz.intentAligned ? accent : muted },
          ]}
          allowFontScaling={false}
        >
          {insight.viz.percent > 0 ? '+' : ''}
          {insight.viz.percent}%
        </RNText>
      ) : null}
    </View>
  );
}

function CalendarLogCountMarker({
  logCount,
  onFill,
}: {
  logCount: number;
  onFill: boolean;
}) {
  if (logCount <= 1) {
    return null;
  }
  if (logCount <= 3) {
    return (
      <View style={styles.calendarDots}>
        {Array.from({ length: logCount }, (_, index) => (
          <View
            key={index}
            style={[
              styles.calendarDot,
              { backgroundColor: onFill ? '#FFFFFF' : '#4B5563' },
            ]}
          />
        ))}
      </View>
    );
  }
  return (
    <AdaptiveGlassSurface style={styles.calendarCountGlass} effect="regular">
      <RNText style={styles.calendarCountText} allowFontScaling={false}>
        {logCount}
      </RNText>
    </AdaptiveGlassSurface>
  );
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y!, (m ?? 1) - 1, 1);
  return date.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function CalendarMonthGrid({
  cells,
  monthKey,
}: {
  cells: InsightCalendarCell[];
  monthKey: string;
}) {
  return (
    <View>
      <Text style={styles.calendarMonth}>{formatMonthLabel(monthKey)}</Text>
      <View style={styles.calendarWeekdays}>
        {WEEKDAY_LABELS.map((label, index) => (
          <Text key={`${label}-${index}`} style={styles.calendarWeekday}>
            {label}
          </Text>
        ))}
      </View>
      <View style={styles.calendarGrid}>
        {cells.map(cell => {
          const onFill =
            cell.state === 'success' ||
            cell.state === 'miss' ||
            cell.state === 'relapse';
          return (
            <View key={cell.dateKey} style={styles.calendarCellWrap}>
              <View
                style={[
                  styles.calendarCell,
                  {
                    backgroundColor: CELL_FILL[cell.state],
                    opacity: cell.state === 'empty' ? 0 : 1,
                  },
                ]}
              >
                {cell.state !== 'empty' ? (
                  <>
                    <RNText
                      style={[
                        styles.calendarDay,
                        onFill ? styles.calendarDayOnFill : null,
                      ]}
                      allowFontScaling={false}
                    >
                      {cell.dayOfMonth}
                    </RNText>
                    <CalendarLogCountMarker
                      logCount={cell.logCount}
                      onFill={onFill}
                    />
                  </>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

function MonthCalendarPager({
  activity,
  moments,
  intent,
}: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
  intent: ActivityIntent;
}) {
  const pagerRef = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const didInitialScroll = useRef(false);
  const now = useMemo(() => new Date(), []);
  const historyEarliestDateKey = useAppStore(
    state => state.historyEarliestDateKey,
  );

  const loggedCounts = useMemo(() => countLogsByDateKey(moments), [moments]);

  const monthDates = useMemo(() => {
    const start = resolveInsightCalendarStartDate({
      moments,
      activityCreatedAt: activity.createdAt,
      historyEarliestDateKey,
      now,
    });
    return listMonthsInclusive(start, now);
  }, [activity.createdAt, historyEarliestDateKey, moments, now]);

  const pages = useMemo(
    () =>
      monthDates.map(monthDate =>
        buildInsightCalendarMonth({
          intent,
          reminderEnabled: activity.reminderEnabled,
          reminderRepeat: activity.reminderRepeat,
          loggedCounts,
          monthDate,
          now,
        }),
      ),
    [
      activity.reminderEnabled,
      activity.reminderRepeat,
      intent,
      loggedCounts,
      monthDates,
      now,
    ],
  );

  const legend =
    intent === 'less' ? (
      <>
        <LegendDot color={CELL_FILL.success} label="Clean" />
        <LegendDot color={CELL_FILL.relapse} label="Logged" />
      </>
    ) : intent === 'more' ? (
      <>
        <LegendDot color={CELL_FILL.success} label="Logged" />
        <LegendDot color={CELL_FILL.miss} label="Missed" />
      </>
    ) : (
      <LegendDot color={CELL_FILL.success} label="Logged" />
    );

  const scrollToCurrentMonth = useCallback(
    (width: number) => {
      if (width <= 0 || didInitialScroll.current) {
        return;
      }
      didInitialScroll.current = true;
      requestAnimationFrame(() => {
        pagerRef.current?.scrollTo({
          x: (monthDates.length - 1) * width,
          animated: false,
        });
      });
    },
    [monthDates.length],
  );

  return (
    <View style={styles.calendar}>
      <Text style={styles.calendarHint}>Swipe for other months</Text>
      <View
        style={styles.calendarPagerHost}
        onLayout={event => {
          const width = Math.round(event.nativeEvent.layout.width);
          if (width <= 0 || width === pageWidth) {
            return;
          }
          setPageWidth(width);
          scrollToCurrentMonth(width);
        }}
      >
        {pageWidth > 0 ? (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            scrollEnabled
            bounces
            alwaysBounceHorizontal
            nestedScrollEnabled
            directionalLockEnabled
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={{ width: pageWidth }}
          >
            {pages.map(page => (
              <View
                key={page.monthKey}
                style={[styles.calendarPage, { width: pageWidth }]}
              >
                <CalendarMonthGrid
                  cells={page.cells}
                  monthKey={page.monthKey}
                />
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.calendarPagePlaceholder} />
        )}
      </View>
      <View style={styles.calendarLegend}>{legend}</View>
    </View>
  );
}

/**
 * Activity Experience (v2) — story-first pattern insights.
 */
export function ActivityInsightDetailV2Content({
  activity,
  moments,
}: {
  activity: ActivityRow;
  moments: readonly MomentRow[];
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  const experience = useMemo(
    () => buildActivityExperience({ activity, moments }),
    [activity, moments],
  );

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  const theme = INTENT_THEME[experience.intent];

  const featuredId = experience.patternOfTheDay?.id ?? null;
  const behaviorCards = experience.behaviorPatterns.filter(
    item => item.id !== featuredId,
  );
  const dynamicCards = experience.dynamicInsights.filter(
    item => item.id !== featuredId,
  );
  const showChangingCard =
    experience.whatsChanging != null &&
    experience.whatsChanging.id !== featuredId;

  return (
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
      <View style={[styles.hero, { backgroundColor: theme.tint }]}>
        <RNText style={styles.heroEmoji} allowFontScaling={false}>
          {activity.emoji}
        </RNText>
        <View style={styles.heroText}>
          <RNText
            style={[styles.heroTitle, { color: colors.foreground }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {activity.label}
          </RNText>
          <View style={styles.heroMetaRow}>
            <View
              style={[styles.intentChip, { backgroundColor: theme.chipBg }]}
            >
              <Text style={[styles.intentChipLabel, { color: theme.strong }]}>
                {experience.intentLabel}
              </Text>
            </View>
            <Text
              style={[styles.heroLastLogged, { color: colors.mutedForeground }]}
            >
              Last logged {experience.overview.lastLoggedLabel.toLowerCase()}
            </Text>
          </View>
        </View>
      </View>

          {experience.patternOfTheDay != null ? (
            <SectionCard tint={theme.tint} accent={theme.strong}>
              <Text style={[styles.patternEyebrow, { color: theme.strong }]}>
                Pattern of the day
              </Text>
              <InsightBody
                insight={experience.patternOfTheDay}
                accent={theme.strong}
                soft={theme.soft}
                muted={colors.mutedForeground}
                foreground={colors.foreground}
              />
            </SectionCard>
          ) : experience.emptyReason === 'no_logs' ? (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Log this activity to unlock insights.
            </Text>
          ) : experience.emptyReason === 'not_enough' ? (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              Not enough history yet. Keep logging — patterns appear with time.
            </Text>
          ) : null}

          <SectionCard
            title="Overview"
            tint="#F8FAFC"
            accent={colors.mutedForeground}
          >
            <OverviewGrid
              muted={colors.mutedForeground}
              foreground={colors.foreground}
              items={[
                {
                  label: 'Last logged',
                  value: experience.overview.lastLoggedLabel,
                },
                {
                  label: 'Tracking since',
                  value: experience.overview.trackingSinceLabel,
                },
                {
                  label: 'Total logs',
                  value: String(experience.overview.totalLogs),
                },
                {
                  label: 'Typical / week',
                  value:
                    experience.overview.typicalPerWeek != null
                      ? String(experience.overview.typicalPerWeek)
                      : '—',
                },
              ]}
            />
          </SectionCard>

          {showChangingCard && experience.whatsChanging != null ? (
            <SectionCard
              title="What's changing"
              tint={theme.tint}
              accent={theme.strong}
            >
              <InsightBody
                insight={experience.whatsChanging}
                accent={theme.strong}
                soft={theme.soft}
                muted={colors.mutedForeground}
                foreground={colors.foreground}
              />
            </SectionCard>
          ) : null}

          {behaviorCards.map(insight => (
            <SectionCard
              key={insight.id}
              title={insight.title}
              tint="#F8FAFC"
              accent={theme.strong}
            >
              <InsightBody
                insight={insight}
                accent={theme.strong}
                soft={theme.soft}
                muted={colors.mutedForeground}
                foreground={colors.foreground}
              />
            </SectionCard>
          ))}

          {dynamicCards.map(insight => (
            <SectionCard
              key={insight.id}
              title={insight.title}
              tint="#ECFEFF"
              accent="#0891B2"
            >
              <InsightBody
                insight={insight}
                accent="#0891B2"
                soft="#A5F3FC"
                muted={colors.mutedForeground}
                foreground={colors.foreground}
              />
            </SectionCard>
          ))}

          <SectionCard title="History" tint={theme.tint} accent={theme.strong}>
            <MonthCalendarPager
              activity={activity}
              moments={moments}
              intent={experience.intent}
            />
          </SectionCard>
    </ScrollView>
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
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    gap: 12,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    overflow: 'visible',
  },
  heroEmoji: {
    fontSize: 36,
    lineHeight: 44,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  heroLastLogged: {
    fontSize: 12,
    fontWeight: '600',
  },
  intentChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  intentChipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    overflow: 'hidden',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  patternEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightBody: {
    gap: 8,
  },
  insightSentence: {
    fontSize: 18,
    lineHeight: 26,
    fontWeight: '700',
  },
  insightSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  changePercent: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    marginTop: 2,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overviewCell: {
    width: '45%',
    minWidth: 120,
    gap: 2,
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  overviewValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  histogram: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 40,
    gap: 1,
    marginTop: 4,
  },
  histogramBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  histogramBar: {
    width: '100%',
    borderRadius: 2,
  },
  weekdayRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  weekdayBar: {
    width: '70%',
    borderRadius: 4,
  },
  weekdayLabel: {
    fontSize: 10,
  },
  calendar: {
    gap: 8,
  },
  calendarPagerHost: {
    width: '100%',
    overflow: 'hidden',
  },
  calendarPage: {
    paddingBottom: 4,
  },
  calendarPagePlaceholder: {
    height: 280,
  },
  calendarMonth: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  calendarHint: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  calendarWeekdays: {
    flexDirection: 'row',
  },
  calendarWeekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCellWrap: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    padding: 2,
  },
  calendarCell: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'visible',
    paddingVertical: 2,
  },
  calendarDay: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#4B5563',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  calendarDayOnFill: {
    color: '#FFFFFF',
  },
  calendarDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 6,
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  calendarCountGlass: {
    minWidth: 16,
    height: 14,
    paddingHorizontal: 4,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  calendarCountText: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '800',
    color: '#111827',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  emptyHint: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginVertical: 8,
    paddingHorizontal: 8,
  },
  closeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
