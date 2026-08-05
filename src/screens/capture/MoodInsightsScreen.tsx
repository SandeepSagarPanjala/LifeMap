import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Sparkles, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { MomentLogInsightsPeriods } from '@/components/capture/MomentLogInsightsPeriods';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import { listMoodMoments, type MomentRow } from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import {
  moodInsightImageSource,
  rankTopMoods,
  type RankedMoodInsight,
} from '@/lib/moments/mood-insights';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';

const THEME = {
  tint: '#FFF0F6',
  strong: '#FF2D55',
  soft: '#FECDD3',
  chipBg: '#FFE0EC',
};

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

function TopMoodsGrid({
  moods,
  muted,
  foreground,
}: {
  moods: readonly RankedMoodInsight[];
  muted: string;
  foreground: string;
}) {
  if (moods.length === 0) {
    return null;
  }
  return (
    <View style={styles.topMoodsGrid}>
      {moods.map(mood => (
        <View key={mood.emotion.id} style={styles.topMoodCell}>
          <View
            style={[
              styles.topMoodArtWrap,
              { backgroundColor: mood.emotion.tint },
            ]}
          >
            <Image
              source={moodInsightImageSource(mood)}
              resizeMode="contain"
              style={styles.topMoodArt}
            />
          </View>
          <Text
            style={[styles.topMoodLabel, { color: foreground }]}
            numberOfLines={1}
          >
            {mood.emotion.label}
          </Text>
          <Text style={[styles.topMoodCount, { color: muted }]}>
            {mood.count} {mood.count === 1 ? 'time' : 'times'}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Mood insights — today / week / month / year (same pattern as activity) + top 6.
 * Also embeds in You → Insights (no close button).
 */
export function MoodInsightsScreen({
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

  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows] = await Promise.all([
        listMoodMoments(),
        ensureHistoryCalendarBounds(),
      ]);
      setMoments(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topMoods = useMemo(() => rankTopMoods(moments, 6), [moments]);
  const isEmpty = moments.length === 0;

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  const bottomPad =
    contentBottomInset ??
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {loading ? (
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
              <Sparkles size={22} color={THEME.strong} strokeWidth={2.25} />
            </View>
            <View style={styles.heroText}>
              <RNText
                style={[styles.heroTitle, { color: colors.foreground }]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {APP_COPY.mood.insightsTitle}
              </RNText>
              <Text
                style={[styles.heroSubtitle, { color: colors.mutedForeground }]}
              >
                {APP_COPY.mood.insightsSubtitle}
              </Text>
            </View>
          </View>

          <WidgetCard title="Logs" tint={THEME.tint} accent={THEME.strong}>
            <MomentLogInsightsPeriods
              moments={moments}
              accent={THEME.strong}
              soft={THEME.soft}
              muted={colors.mutedForeground}
              foreground={colors.foreground}
              momentKind="mood"
            />
          </WidgetCard>

          {topMoods.length > 0 ? (
            <WidgetCard
              title="Top moods"
              tint={THEME.tint}
              accent={THEME.strong}
            >
              <TopMoodsGrid
                moods={topMoods}
                muted={colors.mutedForeground}
                foreground={colors.foreground}
              />
            </WidgetCard>
          ) : null}

          {isEmpty ? (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {APP_COPY.mood.insightsEmpty}
            </Text>
          ) : null}
        </ScrollView>
      )}

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
    gap: 8,
  },
  widgetTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topMoodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  topMoodCell: {
    width: '33.333%',
    alignItems: 'center',
    paddingHorizontal: 4,
    gap: 4,
  },
  topMoodArtWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  topMoodArt: {
    width: 52,
    height: 52,
  },
  topMoodLabel: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  topMoodCount: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
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
