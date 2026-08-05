import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text as RNText,
  View,
  type ListRenderItem,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import {
  getActivityById,
  type ActivityRow,
} from '@/db/repositories/activities';
import {
  listMomentsForActivity,
  type MomentRow,
} from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  momentsInRange,
  resolveShopNameFieldId,
  shopNameFromMoment,
} from '@/lib/activities/activity-insight-period-logs';
import {
  activityExperienceIntentLabel,
  type ActivityIntent,
} from '@/lib/activities/activity-intent';
import {
  formatMetricCompact,
  momentMetricContribution,
  sumMetricInRange,
  type InsightPeriodMetric,
} from '@/lib/activities/insight-period-metric';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { toDateKey } from '@/lib/day-utils';
import { resolveGalleryPlaceLabelsForMoments } from '@/lib/moments/gallery-moment-place-labels';
import { queueMomentPreview } from '@/lib/moments/moment-preview-navigation';
import type { RootStackParamList } from '@/navigation/types';

type PeriodMetricParam = RootStackParamList['ActivityInsightPeriodDetail']['metric'];

const INTENT_THEME: Record<
  ActivityIntent,
  { tint: string; strong: string; chipBg: string }
> = {
  more: {
    tint: '#ECFDF5',
    strong: '#059669',
    chipBg: '#D1FAE5',
  },
  less: {
    tint: '#FFF7ED',
    strong: '#EA580C',
    chipBg: '#FFEDD5',
  },
  track: {
    tint: '#EFF6FF',
    strong: '#2563EB',
    chipBg: '#DBEAFE',
  },
};

function metricFromParam(param: PeriodMetricParam): InsightPeriodMetric {
  if (param.kind === 'logs') {
    return { id: 'logs', kind: 'logs' };
  }
  return {
    id: param.fieldId,
    kind: param.kind,
    fieldId: param.fieldId,
    label: param.label,
  };
}

function formatLoggedAt(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type DrilldownRow = {
  moment: MomentRow;
  shopName: string;
  valueLabel: string;
  whenLabel: string;
  placeLabel: string;
};

/**
 * Period drill-down: every activity log in Today / Week / Month / Year with
 * shop name, metric total, date/time, POI, and a footer matching the period sum.
 */
export function ActivityInsightPeriodDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'ActivityInsightPeriodDetail'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const {
    activityId,
    periodTitle,
    startMs,
    endMs,
    metric: metricParam,
  } = route.params;

  const metric = useMemo(() => metricFromParam(metricParam), [metricParam]);
  const rangeStart = useMemo(() => new Date(startMs), [startMs]);
  const rangeEnd = useMemo(() => new Date(endMs), [endMs]);

  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [placeLabels, setPlaceLabels] = useState<Map<number, string>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [row, logs] = await Promise.all([
        getActivityById(activityId),
        listMomentsForActivity(activityId),
      ]);
      setActivity(row);
      setMoments(logs);
      const inRange = momentsInRange(
        logs,
        new Date(startMs),
        new Date(endMs),
      );
      const labels = await resolveGalleryPlaceLabelsForMoments(inRange);
      setPlaceLabels(labels);
    } finally {
      setLoading(false);
    }
  }, [activityId, endMs, startMs]);

  useEffect(() => {
    void load();
  }, [load]);

  const shopNameFieldId = useMemo(
    () => (activity != null ? resolveShopNameFieldId(activity.fields) : null),
    [activity],
  );

  const theme = INTENT_THEME[activity?.intent ?? 'track'];

  const rows = useMemo((): DrilldownRow[] => {
    const inRange = momentsInRange(moments, rangeStart, rangeEnd);
    return inRange.map(moment => {
      const shop = shopNameFromMoment(moment, shopNameFieldId);
      const contribution = momentMetricContribution(moment, metric);
      const place = placeLabels.get(moment.id)?.trim() || null;
      return {
        moment,
        shopName: shop ?? 'No shop name',
        valueLabel: formatMetricCompact(metric, contribution),
        whenLabel: formatLoggedAt(moment.timestamp),
        placeLabel: place ?? 'No place',
      };
    });
  }, [
    metric,
    moments,
    placeLabels,
    rangeEnd,
    rangeStart,
    shopNameFieldId,
  ]);

  const periodTotal = useMemo(
    () => sumMetricInRange(moments, metric, rangeStart, rangeEnd),
    [metric, moments, rangeEnd, rangeStart],
  );

  const periodTotalLabel = formatMetricCompact(metric, periodTotal);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  const handleOpenPreview = useCallback(
    (moment: MomentRow) => {
      const index = rows.findIndex(row => row.moment.id === moment.id);
      queueMomentPreview({
        moments: rows.map(row => row.moment),
        initialIndex: Math.max(0, index),
        dateKey: toDateKey(moment.timestamp),
      });
      navigation.navigate('MomentPreview');
    },
    [navigation, rows],
  );

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  const renderItem = useCallback<ListRenderItem<DrilldownRow>>(
    ({ item }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.shopName}, ${item.valueLabel}, ${item.whenLabel}`}
        onPress={() => handleOpenPreview(item.moment)}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.82 : 1,
          },
        ]}
      >
        <View style={styles.rowTop}>
          <Text
            style={[styles.shopName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {item.shopName}
          </Text>
          <RNText
            style={[styles.rowValue, { color: theme.strong }]}
            allowFontScaling={false}
          >
            {item.valueLabel}
          </RNText>
        </View>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {item.whenLabel}
        </Text>
        <Text
          style={[styles.meta, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {item.placeLabel}
        </Text>
      </Pressable>
    ),
    [
      colors.border,
      colors.card,
      colors.foreground,
      colors.mutedForeground,
      handleOpenPreview,
      theme.strong,
    ],
  );

  const listHeader = useMemo(() => {
    if (activity == null) {
      return null;
    }
    const periodLine =
      metric.kind !== 'logs' && metric.label
        ? `${periodTitle} · ${metric.label}`
        : periodTitle;
    return (
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
              <Text
                style={[styles.intentChipLabel, { color: colors.foreground }]}
              >
                {activityExperienceIntentLabel(activity.intent)}
              </Text>
            </View>
            <Text
              style={[styles.heroPeriod, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {periodLine}
            </Text>
          </View>
        </View>
      </View>
    );
  }, [
    activity,
    colors.foreground,
    colors.mutedForeground,
    metric,
    periodTitle,
    theme.chipBg,
    theme.tint,
  ]);

  const listFooter = useMemo(
    () => (
      <View
        style={[
          styles.footerTotal,
          { borderTopColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        <Text style={[styles.footerLabel, { color: colors.mutedForeground }]}>
          Total
        </Text>
        <RNText
          style={[styles.footerValue, { color: colors.foreground }]}
          allowFontScaling={false}
        >
          {periodTotalLabel}
        </RNText>
      </View>
    ),
    [
      colors.border,
      colors.card,
      colors.foreground,
      colors.mutedForeground,
      periodTotalLabel,
    ],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {loading || activity == null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => String(item.moment.id)}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListFooterComponent={rows.length > 0 ? listFooter : null}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.mutedForeground }]}>
              No logs in this period.
            </Text>
          }
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: Math.max(insets.top, 12),
              paddingBottom: bottomPad,
            },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.closeWrap,
          { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
        ]}
      >
        <MapGlassCircleButton accessibilityLabel="Back" onPress={handleClose}>
          <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
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
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
    flexGrow: 1,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    marginBottom: 4,
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
  heroPeriod: {
    fontSize: 12,
    fontWeight: '600',
  },
  row: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  shopName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '800',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  meta: {
    fontSize: 13,
    fontWeight: '500',
  },
  footerTotal: {
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  footerLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  footerValue: {
    fontSize: 18,
    fontWeight: '800',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  empty: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  closeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
});
