import { useCallback, useEffect, useState } from 'react';
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
 * Activity insights — loads activity logs and shows the insights UI.
 */
export function ActivityInsightDetailScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route =
    useRoute<RouteProp<RootStackParamList, 'ActivityInsightDetail'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const closesToMap = useClosesToMap();
  const activityId = route.params.activityId;

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

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

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
        />
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.footer,
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
