import { useCallback, useEffect, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityLogEntryPanel } from '@/components/map/ActivityLogEntrySheet';
import {
  getActivityById,
  type ActivityRow,
} from '@/db/repositories/activities';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { markNeedsTodayRefreshOnMapFocus } from '@/lib/foreground-heavy-resume';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Full-page structured activity log (fields / photo / amount).
 * One-tap activities stay on the map half sheet.
 */
export function ActivityLogEntryScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ActivityLogEntry'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [activity, setActivity] = useState<ActivityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const row = await getActivityById(route.params.activityId);
        if (cancelled) {
          return;
        }
        if (row == null) {
          setLoadError('Activity not found.');
          setLoading(false);
          return;
        }
        setActivity(row);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params.activityId]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handleLogged = useCallback(async () => {
    markNeedsTodayRefreshOnMapFocus();
    navigation.popToTop();
  }, [navigation]);

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError != null || activity == null) {
    return (
      <View
        style={[
          styles.centered,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={styles.errorText}>
          {loadError ?? 'Activity not found.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.body,
          { paddingTop: Math.max(insets.top, 12) },
        ]}
      >
        <ActivityLogEntryPanel
          activity={activity}
          fullPage
          onBack={goBack}
          onLogged={handleLogged}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#FF3B30',
    textAlign: 'center',
  },
});
