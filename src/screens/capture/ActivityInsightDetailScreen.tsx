import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import {
  getActivityById,
  type ActivityRow,
} from '@/db/repositories/activities';
import {
  listMomentsForActivity,
  type MomentRow,
} from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { MAP_MOMENTS_BAR_GAP } from '@/lib/app-constants';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';
import { ActivityInsightDetailContent } from '@/screens/capture/ActivityInsightDetailContent';

/**
 * Loads one activity's logs and shows the insights UI.
 * Used as a stack screen and embedded in the You → Insights hub.
 */
export function ActivityInsightDetailView({
  activityId,
  contentBottomInset,
  footerBottomInset,
  footerAccessibilityLabel,
  footerIcon,
  showFooter = true,
  onClose,
}: {
  activityId: number;
  /** Extra scroll padding above floating chrome (You + category bars). */
  contentBottomInset?: number;
  /** Absolute footer button offset from the screen bottom. */
  footerBottomInset?: number;
  footerAccessibilityLabel?: string;
  footerIcon?: ReactNode;
  /** When false, omit the floating back/close control (hub supplies its own). */
  showFooter?: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [moments, setMoments] = useState<MomentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [row, logs] = await Promise.all([
        getActivityById(activityId),
        listMomentsForActivity(activityId),
        ensureHistoryCalendarBounds(),
      ]);
      setActivity(row);
      setMoments(logs);
    } finally {
      setLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const footerPad =
    footerBottomInset ?? Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {loading || activity == null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ActivityInsightDetailContent
          activity={activity}
          moments={moments}
          contentBottomInset={contentBottomInset}
        />
      )}

      {showFooter && footerIcon != null && footerAccessibilityLabel != null ? (
        <View
          pointerEvents="box-none"
          style={[styles.footer, { paddingBottom: footerPad }]}
        >
          <MapGlassCircleButton
            accessibilityLabel={footerAccessibilityLabel}
            onPress={onClose}
          >
            {footerIcon}
          </MapGlassCircleButton>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Activity insights — stack entry that reads `activityId` from the route.
 */
export function ActivityInsightDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'ActivityInsightDetail'>>();
  const colors = useThemeColors();
  const closesToMap = useClosesToMap();

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  return (
    <ActivityInsightDetailView
      activityId={route.params.activityId}
      footerAccessibilityLabel={closesToMap ? 'Close' : 'Back'}
      footerIcon={
        closesToMap ? (
          <X size={20} color={colors.primary} strokeWidth={2.25} />
        ) : (
          <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
        )
      }
      onClose={handleClose}
    />
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
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
