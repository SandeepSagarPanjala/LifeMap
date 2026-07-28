import { useCallback, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import type { RootStackParamList } from '@/navigation/types';

export function settingsBottomChromePadding(bottomInset: number): number {
  return (
    MAP_MOMENTS_BAR_HEIGHT + Math.max(bottomInset, MAP_MOMENTS_BAR_GAP) + 16
  );
}

type SettingsScreenLayoutProps = {
  children: ReactNode;
  /**
   * When true (default), children scroll and sit at the bottom of the screen.
   * Set false for full-bleed content (maps, FlatLists that manage their own scroll).
   */
  scroll?: boolean;
};

/**
 * Shared Settings chrome: no nav header, bottom liquid-glass X (goBack),
 * optional bottom-anchored scroll content.
 */
export function SettingsScreenLayout({
  children,
  scroll = true,
}: SettingsScreenLayoutProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 12);
  const bottomPad = settingsBottomChromePadding(insets.bottom);

  const handleClose = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate('Map');
  }, [navigation]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: topPad,
              paddingBottom: bottomPad,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.fill,
            { paddingTop: topPad, paddingBottom: bottomPad },
          ]}
        >
          {children}
        </View>
      )}

      <View
        pointerEvents="box-none"
        style={[
          styles.barWrap,
          { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
        ]}
      >
        <MapGlassCircleButton
          accessibilityLabel="Close"
          onPress={handleClose}
          style={styles.closeButton}
        >
          <X size={20} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  fill: {
    flex: 1,
  },
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  closeButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
