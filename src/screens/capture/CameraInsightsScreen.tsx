import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { Camera, ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { InsightSegmentBar } from '@/components/capture/InsightSegmentBar';
import { MomentLogInsightsPeriods } from '@/components/capture/MomentLogInsightsPeriods';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import {
  listPhotoMoments,
  listVideoMoments,
  type MomentRow,
} from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
} from '@/lib/app-constants';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';

/** Matches CAPTURE_BUTTON_THEMES.camera. */
const THEME = {
  tint: '#F2F8FF',
  strong: '#007AFF',
  soft: '#BFDBFE',
  chipBg: '#DCEBFF',
};

type CameraMediaKind = 'photo' | 'video';

const MEDIA_SEGMENTS = [
  { id: 'photo' as const, label: APP_COPY.camera.photo },
  { id: 'video' as const, label: APP_COPY.camera.video },
];

/** Survives leaving Camera for other insight categories in the same session. */
let persistedCameraMediaKind: CameraMediaKind = 'photo';

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
 * Camera insights — diary-style periods with a Photo / Video segment bar
 * (same chrome as activity field metrics). Embeds in You → Insights.
 */
export function CameraInsightsScreen({
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

  const [photoMoments, setPhotoMoments] = useState<MomentRow[]>([]);
  const [videoMoments, setVideoMoments] = useState<MomentRow[]>([]);
  const [mediaKind, setMediaKind] = useState<CameraMediaKind>(
    () => persistedCameraMediaKind,
  );
  const [loading, setLoading] = useState(true);

  const handleMediaKindChange = useCallback((kind: CameraMediaKind) => {
    persistedCameraMediaKind = kind;
    setMediaKind(kind);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [photos, videos] = await Promise.all([
        listPhotoMoments(),
        listVideoMoments(),
        ensureHistoryCalendarBounds(),
      ]);
      setPhotoMoments(photos);
      setVideoMoments(videos);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const moments = mediaKind === 'photo' ? photoMoments : videoMoments;
  const isEmpty = moments.length === 0;
  const emptyHint = useMemo(
    () =>
      mediaKind === 'photo'
        ? APP_COPY.camera.insightsEmptyPhoto
        : APP_COPY.camera.insightsEmptyVideo,
    [mediaKind],
  );

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
              <Camera size={22} color={THEME.strong} strokeWidth={2.25} />
            </View>
            <View style={styles.heroText}>
              <RNText
                style={[styles.heroTitle, { color: colors.foreground }]}
                numberOfLines={1}
                allowFontScaling={false}
              >
                {APP_COPY.camera.insightsTitle}
              </RNText>
              <Text
                style={[styles.heroSubtitle, { color: colors.mutedForeground }]}
              >
                {APP_COPY.camera.insightsSubtitle}
              </Text>
            </View>
          </View>

          <InsightSegmentBar
            options={MEDIA_SEGMENTS}
            valueId={mediaKind}
            onChange={handleMediaKindChange}
            accent={THEME.strong}
            muted={colors.mutedForeground}
          />

          <WidgetCard title="Logs" tint={THEME.tint} accent={THEME.strong}>
            <MomentLogInsightsPeriods
              moments={moments}
              accent={THEME.strong}
              soft={THEME.soft}
              muted={colors.mutedForeground}
              foreground={colors.foreground}
              momentKind={mediaKind}
            />
          </WidgetCard>

          {isEmpty ? (
            <Text style={[styles.emptyHint, { color: colors.mutedForeground }]}>
              {emptyHint}
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
