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
  listMoodMoments,
  listNoteMoments,
  listPhotoMoments,
  listVideoMoments,
  listVoiceMoments,
  type MomentRow,
} from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { momentsInRange } from '@/lib/activities/activity-insight-period-logs';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { toDateKey } from '@/lib/day-utils';
import { formatVoiceDurationMs } from '@/lib/moments/format-voice-duration';
import { resolveGalleryPlaceLabelsForMoments } from '@/lib/moments/gallery-moment-place-labels';
import { queueMomentPreview } from '@/lib/moments/moment-preview-navigation';
import type { RootStackParamList } from '@/navigation/types';

export type MomentInsightKind =
  RootStackParamList['MomentInsightPeriodDetail']['momentKind'];

const KIND_META: Record<
  MomentInsightKind,
  { tint: string; strong: string; chipBg: string; title: string }
> = {
  mood: {
    tint: '#FFF0F6',
    strong: '#FF2D55',
    chipBg: '#FFE0EC',
    title: 'Mood',
  },
  note: {
    tint: '#FFF7ED',
    strong: '#EA580C',
    chipBg: '#FFEDD5',
    title: 'Diary',
  },
  voice: {
    tint: '#F7F2FF',
    strong: '#AF52DE',
    chipBg: '#EDE4FF',
    title: 'Voice',
  },
  photo: {
    tint: '#F2F8FF',
    strong: '#007AFF',
    chipBg: '#DCEBFF',
    title: 'Photos',
  },
  video: {
    tint: '#F2F8FF',
    strong: '#007AFF',
    chipBg: '#DCEBFF',
    title: 'Videos',
  },
};

async function loadMomentsForKind(
  kind: MomentInsightKind,
): Promise<MomentRow[]> {
  switch (kind) {
    case 'mood':
      return listMoodMoments();
    case 'note':
      return listNoteMoments();
    case 'voice':
      return listVoiceMoments();
    case 'photo':
      return listPhotoMoments();
    case 'video':
      return listVideoMoments();
  }
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

function formatVoiceDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }
  const whole = Math.round(seconds);
  if (whole < 60) {
    return `${whole}s`;
  }
  const minutes = Math.floor(whole / 60);
  const rem = whole % 60;
  return rem === 0 ? `${minutes}m` : `${minutes}m ${rem}s`;
}

function momentPrimaryLabel(moment: MomentRow): string {
  switch (moment.type) {
    case 'mood': {
      const label = moment.moodLabel?.trim();
      return label || 'Mood';
    }
    case 'note': {
      const title = moment.title?.trim();
      if (title) {
        return title;
      }
      const body = moment.textBody?.trim().replace(/\s+/g, ' ');
      if (body) {
        return body.length > 72 ? `${body.slice(0, 72).trim()}…` : body;
      }
      return 'Diary entry';
    }
    case 'voice': {
      const duration = formatVoiceDuration(moment.voiceDurationSec);
      return duration != null ? `Voice · ${duration}` : 'Voice memo';
    }
    case 'photo': {
      const caption = moment.caption?.trim();
      return caption || 'Photo';
    }
    case 'video': {
      const caption = moment.caption?.trim();
      return caption || 'Video';
    }
    default:
      return 'Moment';
  }
}

type DrilldownRow = {
  moment: MomentRow;
  title: string;
  whenLabel: string;
  placeLabel: string;
  /** Trailing value when meaningful (e.g. voice duration); omit for plain logs. */
  valueLabel: string | null;
};

function momentValueLabel(moment: MomentRow): string | null {
  if (moment.kind === 'voice') {
    const sec = moment.voiceDurationSec;
    if (sec != null && Number.isFinite(sec) && sec > 0) {
      return formatVoiceDurationMs(Math.round(sec * 1000));
    }
    return null;
  }
  return null;
}

/**
 * Period drill-down for mood / diary / voice / camera logs.
 */
export function MomentInsightPeriodDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'MomentInsightPeriodDetail'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const { momentKind, periodTitle, startMs, endMs } = route.params;
  const meta = KIND_META[momentKind];
  const rangeStart = useMemo(() => new Date(startMs), [startMs]);
  const rangeEnd = useMemo(() => new Date(endMs), [endMs]);

  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [placeLabels, setPlaceLabels] = useState<Map<number, string>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const logs = await loadMomentsForKind(momentKind);
      setMoments(logs);
      const inRange = momentsInRange(
        logs,
        new Date(startMs),
        new Date(endMs),
      );
      setPlaceLabels(await resolveGalleryPlaceLabelsForMoments(inRange));
    } finally {
      setLoading(false);
    }
  }, [endMs, momentKind, startMs]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo((): DrilldownRow[] => {
    return momentsInRange(moments, rangeStart, rangeEnd).map(moment => {
      const place = placeLabels.get(moment.id)?.trim() || null;
      return {
        moment,
        title: momentPrimaryLabel(moment),
        whenLabel: formatLoggedAt(moment.timestamp),
        placeLabel: place ?? 'No place',
        valueLabel: momentValueLabel(moment),
      };
    });
  }, [moments, placeLabels, rangeEnd, rangeStart]);

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
        accessibilityLabel={
          item.valueLabel != null
            ? `${item.title}, ${item.valueLabel}, ${item.whenLabel}`
            : `${item.title}, ${item.whenLabel}`
        }
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
            style={[styles.rowTitle, { color: colors.foreground }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {item.valueLabel != null ? (
            <RNText
              style={[styles.rowValue, { color: colors.foreground }]}
              allowFontScaling={false}
            >
              {item.valueLabel}
            </RNText>
          ) : null}
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
    ],
  );

  const listHeader = useMemo(
    () => (
      <View style={[styles.hero, { backgroundColor: meta.tint }]}>
        <View style={[styles.heroChip, { backgroundColor: meta.chipBg }]}>
          <Text style={[styles.heroChipLabel, { color: meta.strong }]}>
            {meta.title}
          </Text>
        </View>
        <View style={styles.heroText}>
          <RNText
            style={[styles.heroTitle, { color: colors.foreground }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {periodTitle}
          </RNText>
          <Text
            style={[styles.heroPeriod, { color: colors.mutedForeground }]}
            numberOfLines={1}
          >
            {rows.length} {rows.length === 1 ? 'log' : 'logs'}
          </Text>
        </View>
      </View>
    ),
    [
      colors.foreground,
      colors.mutedForeground,
      meta.chipBg,
      meta.strong,
      meta.tint,
      meta.title,
      periodTitle,
      rows.length,
    ],
  );

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
          {String(rows.length)}
        </RNText>
      </View>
    ),
    [
      colors.border,
      colors.card,
      colors.foreground,
      colors.mutedForeground,
      rows.length,
    ],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {loading ? (
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
  heroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  heroChipLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
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
  rowTitle: {
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
