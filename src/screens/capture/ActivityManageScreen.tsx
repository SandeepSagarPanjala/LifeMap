import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { ActivityManageList } from '@/components/map/ActivityManageList';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import {
  archiveActivity,
  listActiveActivities,
  reorderActivities,
  type ActivityRow,
} from '@/db/repositories/activities';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Full-page activity list (reorder / edit / remove).
 * Add / Edit push ActivityForm (full page) — reliable keyboard handling.
 */
export function ActivityManageScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ActivityManage'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const openedCreateRef = useRef(false);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listActiveActivities();
      setActivities(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadActivities();
    }, [loadActivities]),
  );

  useEffect(() => {
    if (!route.params?.openCreate || openedCreateRef.current) {
      return;
    }
    openedCreateRef.current = true;
    navigation.setParams({ openCreate: undefined });
    navigation.navigate('ActivityForm', { kind: 'create' });
  }, [navigation, route.params?.openCreate]);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleAdd = useCallback(() => {
    navigation.navigate('ActivityForm', { kind: 'create' });
  }, [navigation]);

  const handleReorder = useCallback(
    async (data: ActivityRow[]) => {
      setActivities(data);
      try {
        await reorderActivities(data.map(row => row.id));
      } catch {
        await loadActivities();
        Alert.alert(
          APP_COPY.common.couldNotReorder,
          APP_COPY.common.pleaseTryAgain,
        );
      }
    },
    [loadActivities],
  );

  const handleEdit = useCallback(
    (activity: ActivityRow) => {
      navigation.navigate('ActivityForm', {
        kind: 'edit',
        activityId: activity.id,
      });
    },
    [navigation],
  );

  const confirmArchive = useCallback(
    (activity: ActivityRow) => {
      Alert.alert(
        `Remove ${activity.label}?`,
        'Past logs keep their emoji and label. You can add it again later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => {
              void (async () => {
                try {
                  await archiveActivity(activity.id);
                  const rows = await listActiveActivities();
                  setActivities(rows);
                  if (rows.length === 0) {
                    navigation.navigate('ActivityForm', {
                      kind: 'create-first',
                    });
                  }
                } catch (error) {
                  Alert.alert(
                    APP_COPY.alerts.couldNotSaveActivity,
                    errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
                  );
                }
              })();
            },
          },
        ],
      );
    },
    [navigation],
  );

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT +
    Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) +
    16;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.listWrap,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: bottomPad,
          },
        ]}
      >
        {loading && activities.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ActivityManageList
            activities={activities}
            onReorder={data => {
              void handleReorder(data);
            }}
            onBeginEdit={handleEdit}
            onArchive={confirmArchive}
          />
        )}
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.barWrap,
          { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
        ]}
      >
        <View style={styles.barRow}>
          <View style={styles.shadowWrap}>
            <AdaptiveGlassSurface style={styles.pill}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add activity"
                onPress={handleAdd}
                style={styles.addPressable}
              >
                <Plus size={18} color={colors.primary} strokeWidth={2.5} />
                <Text style={[styles.addLabel, { color: colors.primary }]}>
                  Add Activity
                </Text>
              </Pressable>
            </AdaptiveGlassSurface>
          </View>

          <MapGlassCircleButton
            accessibilityLabel="Close"
            onPress={handleClose}
            style={styles.closeButton}
          >
            <X size={20} color={colors.primary} strokeWidth={2.25} />
          </MapGlassCircleButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
    paddingHorizontal: 20,
    minHeight: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MAP_MOMENTS_SIDE_BTN_GAP,
  },
  shadowWrap: {
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  pill: {
    height: MAP_MOMENTS_BAR_HEIGHT,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  addPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: 18,
  },
  addLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
