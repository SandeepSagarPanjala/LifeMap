import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import {
  Activity,
  AudioLines,
  Book,
  Camera,
  ChevronLeft,
  Construction,
  Map as MapIcon,
  Sparkles,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { ActivityRow } from '@/db/repositories/activities';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { ActivityInsightDetailView } from '@/screens/capture/ActivityInsightDetailScreen';
import { ActivityInsightsScreen } from '@/screens/capture/ActivityInsightsScreen';
import { DiaryInsightsScreen } from '@/screens/capture/DiaryInsightsScreen';
import { MoodInsightsScreen } from '@/screens/capture/MoodInsightsScreen';
import { CameraInsightsScreen } from '@/screens/capture/CameraInsightsScreen';
import { VoiceInsightsScreen } from '@/screens/capture/VoiceInsightsScreen';
import { MapInsightsScreen } from '@/screens/map/MapInsightsScreen';
import {
  getYouTabBeforeInsights,
  type YouTabParamList,
} from '@/screens/you/YouScreen';

export type InsightsCategoryId =
  | 'map'
  | 'activities'
  | 'diary'
  | 'mood'
  | 'voice'
  | 'camera';

type InsightsCategory = {
  id: InsightsCategoryId;
  label: string;
  icon: LucideIcon;
};

/** Icons match MapMomentsGlassBar (map has no capture twin — uses Map). */
const CATEGORIES: readonly InsightsCategory[] = [
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'activities', label: 'Activities', icon: Activity },
  { id: 'diary', label: 'Diary', icon: Book },
  { id: 'mood', label: 'Mood', icon: Sparkles },
  { id: 'voice', label: 'Voice', icon: AudioLines },
  { id: 'camera', label: 'Camera', icon: Camera },
] as const;

const TAB_SIZE = 44;
const ICON_SIZE = 20;
const H_PADDING = 4;
const ACTIVE_PILL_SIZE = 36;

function UnderDevelopmentPanel({ title }: { title: string }) {
  const colors = useThemeColors();

  return (
    <View className="bg-background flex-1 items-center justify-center px-8">
      <View className="bg-muted/70 mb-5 h-16 w-16 items-center justify-center rounded-3xl">
        <Icon as={Construction} size={28} color={colors.mutedForeground} />
      </View>
      <Text variant="h3" className="text-center">
        {title}
      </Text>
      <Text variant="muted" className="mt-2 text-center">
        Under development
      </Text>
    </View>
  );
}

function InsightsCategoryBar({
  selectedId,
  onSelect,
}: {
  selectedId: InsightsCategoryId;
  onSelect: (id: InsightsCategoryId) => void;
}) {
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const accent = colors.primary;
  const activePillBg =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const selectedIndex = Math.max(
    0,
    CATEGORIES.findIndex(category => category.id === selectedId),
  );

  return (
    <View style={styles.shadowWrap}>
      <AdaptiveGlassSurface style={styles.pill}>
        <View
          pointerEvents="none"
          style={[
            styles.activePill,
            {
              backgroundColor: activePillBg,
              transform: [{ translateX: selectedIndex * TAB_SIZE }],
            },
          ]}
        />
        {CATEGORIES.map(category => {
          const isSelected = category.id === selectedId;
          const color = isSelected ? accent : colors.mutedForeground;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={category.label}
              onPress={() => onSelect(category.id)}
              style={styles.tab}
            >
              <Icon
                as={category.icon}
                size={ICON_SIZE}
                color={color}
                strokeWidth={2}
              />
            </Pressable>
          );
        })}
      </AdaptiveGlassSurface>
    </View>
  );
}

/**
 * Global insights hub on the You tab — You bar is hidden; one chrome row with
 * category bar | back. All insight categories use real UIs. Back returns to
 * the activity picker when a detail is open, otherwise to the You tab before
 * Insights.
 */
export function InsightsScreen() {
  const navigation =
    useNavigation<BottomTabNavigationProp<YouTabParamList>>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [selectedId, setSelectedId] = useState<InsightsCategoryId>('map');
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(
    null,
  );

  const selected = useMemo(
    () =>
      CATEGORIES.find(category => category.id === selectedId) ?? CATEGORIES[0]!,
    [selectedId],
  );

  const chromeBottom = Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP);
  const contentBottomInset = chromeBottom + MAP_MOMENTS_BAR_HEIGHT + 16;

  const onSelect = useCallback(
    (id: InsightsCategoryId) => {
      // Re-tapping Activities while on a detail view returns to the picker.
      if (id === 'activities' && selectedId === 'activities') {
        setSelectedActivityId(null);
      }
      setSelectedId(id);
      if (id !== 'activities') {
        setSelectedActivityId(null);
      }
    },
    [selectedId],
  );

  const handleSelectActivity = useCallback((activity: ActivityRow) => {
    setSelectedActivityId(activity.id);
  }, []);

  const handleBack = useCallback(() => {
    // Activity detail → picker first; otherwise restore the prior You tab.
    if (selectedActivityId != null) {
      setSelectedActivityId(null);
      return;
    }
    navigation.navigate(getYouTabBeforeInsights());
  }, [navigation, selectedActivityId]);

  let body: ReactNode;
  if (selectedId === 'activities') {
    body =
      selectedActivityId == null ? (
        <ActivityInsightsScreen
          embedded
          contentBottomInset={contentBottomInset}
          onSelectActivity={handleSelectActivity}
        />
      ) : (
        <ActivityInsightDetailView
          activityId={selectedActivityId}
          contentBottomInset={contentBottomInset}
          showFooter={false}
          onClose={handleBack}
        />
      );
  } else if (selectedId === 'diary') {
    body = (
      <DiaryInsightsScreen
        embedded
        contentBottomInset={contentBottomInset}
      />
    );
  } else if (selectedId === 'mood') {
    body = (
      <MoodInsightsScreen
        embedded
        contentBottomInset={contentBottomInset}
      />
    );
  } else if (selectedId === 'voice') {
    body = (
      <VoiceInsightsScreen
        embedded
        contentBottomInset={contentBottomInset}
      />
    );
  } else if (selectedId === 'camera') {
    body = (
      <CameraInsightsScreen
        embedded
        contentBottomInset={contentBottomInset}
      />
    );
  } else if (selectedId === 'map') {
    body = (
      <MapInsightsScreen
        embedded
        contentBottomInset={contentBottomInset}
      />
    );
  } else {
    body = <UnderDevelopmentPanel title={selected.label} />;
  }

  return (
    <View style={styles.root}>
      {body}
      <View
        pointerEvents="box-none"
        style={[styles.chromeWrap, { paddingBottom: chromeBottom }]}
      >
        <View style={styles.chromeRow}>
          <InsightsCategoryBar selectedId={selectedId} onSelect={onSelect} />
          <MapGlassCircleButton
            accessibilityLabel={
              selectedActivityId != null ? 'Back to activities' : 'Back'
            }
            onPress={handleBack}
            style={styles.sideButton}
          >
            <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
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
  chromeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  chromeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MAP_MOMENTS_SIDE_BTN_GAP,
  },
  sideButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
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
    flexDirection: 'row',
    alignItems: 'center',
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: H_PADDING,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  tab: {
    width: TAB_SIZE,
    height: MAP_MOMENTS_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    position: 'absolute',
    left: H_PADDING + (TAB_SIZE - ACTIVE_PILL_SIZE) / 2,
    top: (MAP_MOMENTS_BAR_HEIGHT - ACTIVE_PILL_SIZE) / 2,
    width: ACTIVE_PILL_SIZE,
    height: ACTIVE_PILL_SIZE,
    borderRadius: ACTIVE_PILL_SIZE / 2,
  },
});
