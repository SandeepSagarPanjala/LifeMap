import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, NotebookPen, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { MomentLogInsightsPeriods } from '@/components/capture/MomentLogInsightsPeriods';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import { listNoteMoments, type MomentRow } from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';

const THEME = {
  tint: '#FFF7ED',
  strong: '#EA580C',
  soft: '#FED7AA',
  chipBg: '#FFEDD5',
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

/**
 * Diary insights — today / week / month / year (same pattern as activity).
 * Also embeds in You → Insights (no close button).
 */
export function DiaryInsightsScreen({
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
        listNoteMoments(),
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
              <NotebookPen size={22} color={THEME.strong} strokeWidth={2.25} />
            </View>
            <View style={styles.heroText}>
              <RNText
                style={[styles.heroTitle, { color: colors.foreground }]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {APP_COPY.diary.insightsTitle}
              </RNText>
              <Text
                style={[styles.heroSubtitle, { color: colors.mutedForeground }]}
              >
                {APP_COPY.diary.insightsSubtitle}
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
              momentKind="note"
            />
          </WidgetCard>

          {isEmpty ? (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {APP_COPY.diary.insightsEmpty}
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
