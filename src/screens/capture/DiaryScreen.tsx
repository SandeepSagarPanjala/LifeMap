import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { DiaryList } from '@/components/diary/DiaryList';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { listNoteMoments, type MomentRow } from '@/db/repositories/moments';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY } from '@/lib/app-copy';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { toDateKey } from '@/lib/day-utils';
import { queueMomentPreview } from '@/lib/moments/moment-preview-navigation';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Diary feed — browse existing note moments, then compose via Add Diary.
 * Bottom liquid-glass: Add Diary + close — same chrome as ActivityManage.
 */
export function DiaryScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<MomentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const backgroundStyle = useMemo(
    () => ({
      backgroundColor:
        colorScheme === 'dark' ? colors.background : '#F4F1F0',
    }),
    [colorScheme, colors.background],
  );

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listNoteMoments();
      setEntries(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadEntries().catch(() => undefined);
    }, [loadEntries]),
  );

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  const handleAdd = useCallback(() => {
    navigation.navigate('CaptureNote');
  }, [navigation]);

  const handlePressEntry = useCallback(
    (entry: MomentRow, index: number) => {
      queueMomentPreview({
        moments: entries,
        initialIndex: index,
        dateKey: toDateKey(entry.timestamp),
      });
      navigation.navigate('MomentPreview');
    },
    [entries, navigation],
  );

  const bottomPad =
    MAP_MOMENTS_BAR_HEIGHT + Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) + 16;

  return (
    <View style={[styles.root, backgroundStyle]}>
      <View
        style={[
          styles.content,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: bottomPad,
          },
        ]}
      >
        {loading && entries.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <DiaryList
            entries={entries}
            onPressEntry={handlePressEntry}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                  {APP_COPY.diary.emptyTitle}
                </Text>
                <Text
                  style={[styles.emptyBody, { color: colors.mutedForeground }]}
                >
                  {APP_COPY.diary.emptyBody}
                </Text>
              </View>
            }
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
          <GlassPressable
            accessibilityLabel={APP_COPY.diary.addDiary}
            onPress={handleAdd}
            style={styles.shadowWrap}
          >
            <AdaptiveGlassSurface style={styles.pill}>
              <View style={styles.addPressable}>
                <Plus size={18} color={colors.primary} strokeWidth={2.5} />
                <Text style={[styles.addLabel, { color: colors.primary }]}>
                  {APP_COPY.diary.addDiary}
                </Text>
              </View>
            </AdaptiveGlassSurface>
          </GlassPressable>

          <MapGlassCircleButton
            accessibilityLabel={APP_COPY.common.close}
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    minHeight: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
