import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
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
  MAP_MOMENTS_BAR_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { ensureHistoryCalendarBounds } from '@/lib/history-calendar-bounds';
import type { RootStackParamList } from '@/navigation/types';
import { useClosesToMap } from '@/navigation/use-closes-to-map';
import { ActivityInsightDetailV1Content } from '@/screens/capture/ActivityInsightDetailV1';
import { ActivityInsightDetailV2Content } from '@/screens/capture/ActivityInsightDetailV2';
import {
  useAppStore,
  type ActivityInsightsUiVersion,
} from '@/stores/app-store';

const VERSION_OPTIONS: Array<{
  value: ActivityInsightsUiVersion;
  label: string;
}> = [
  { value: 'v1', label: 'V1' },
  { value: 'v2', label: 'V2' },
];

function InsightsVersionSwitch({
  value,
  onChange,
}: {
  value: ActivityInsightsUiVersion;
  onChange: (version: ActivityInsightsUiVersion) => void;
}) {
  const colors = useThemeColors();

  return (
    <AdaptiveGlassSurface style={styles.versionGlass}>
      {VERSION_OPTIONS.map(option => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`Show insights ${option.label}`}
            onPress={() => onChange(option.value)}
            style={[
              styles.versionTab,
              active ? { backgroundColor: 'rgba(0,0,0,0.08)' } : null,
            ]}
          >
            <Text
              style={[
                styles.versionLabel,
                {
                  color: active ? colors.primary : colors.mutedForeground,
                  fontWeight: active ? '800' : '600',
                },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </AdaptiveGlassSurface>
  );
}

/**
 * Activity insights shell — loads data once and swaps classic (v1) vs
 * experience (v2) UI so both can be compared before a store release.
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

  const version = useAppStore(state => state.activityInsightsUiVersion);
  const setVersion = useAppStore(state => state.setActivityInsightsUiVersion);

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
      ) : version === 'v1' ? (
        <ActivityInsightDetailV1Content
          activity={activity}
          moments={moments}
        />
      ) : (
        <ActivityInsightDetailV2Content
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
        <InsightsVersionSwitch value={version} onChange={setVersion} />
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
    gap: 10,
  },
  versionGlass: {
    height: MAP_STACK_BUTTON_SIZE,
    borderRadius: MAP_STACK_BUTTON_SIZE / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
  },
  versionTab: {
    minWidth: 44,
    height: MAP_STACK_BUTTON_SIZE - 8,
    borderRadius: (MAP_STACK_BUTTON_SIZE - 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  versionLabel: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
