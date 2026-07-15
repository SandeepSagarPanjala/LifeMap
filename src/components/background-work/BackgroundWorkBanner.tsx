import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  ACCENT_THEMES,
  BACKGROUND_WORK_BANNER_BODY_HEIGHT,
} from '@/lib/app-constants';
import { useAppStore } from '@/stores/app-store';
import {
  clearBackgroundWorkProgress,
  getBackgroundWorkProgress,
  subscribeBackgroundWork,
} from '@/lib/background-work-events';
import {
  isBackgroundWorkCycleRunning,
  requestBackgroundWorkAbort,
} from '@/lib/background-work-coordinator';

const BANNER_SIDE_INSET = 12;
const BANNER_TOP_GAP = 8;

function softPrimaryFill(primaryHsl: string, alpha: number): string {
  return `hsla(${primaryHsl.replace(/ /g, ', ')}, ${alpha})`;
}

function LivePulse({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.55,
            duration: 900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 900,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.55,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, scale]);

  return (
    <View style={styles.pulseHost}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            backgroundColor: color,
            opacity,
            transform: [{ scale }],
          },
        ]}
      />
      <View style={[styles.pulseCore, { backgroundColor: color }]} />
    </View>
  );
}

export function BackgroundWorkBanner() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const accentTheme = useAppStore(state => state.accentTheme);
  const tokens =
    ACCENT_THEMES[accentTheme][colorScheme === 'dark' ? 'dark' : 'light'];

  const progress = useSyncExternalStore(
    subscribeBackgroundWork,
    getBackgroundWorkProgress,
    getBackgroundWorkProgress,
  );

  const meterWidth = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const ratio =
    progress.total > 0
      ? Math.min(1, Math.max(0, progress.completed / progress.total))
      : 0;
  const workingRatio =
    progress.total > 0
      ? Math.min(1, Math.max(ratio, (progress.completed + 0.35) / progress.total))
      : 0;

  useEffect(() => {
    if (!progress.bannerVisible || progress.phase === 'idle') {
      return;
    }
    Animated.spring(meterWidth, {
      toValue: workingRatio,
      friction: 12,
      tension: 60,
      useNativeDriver: false,
    }).start();
  }, [meterWidth, progress.bannerVisible, progress.phase, workingRatio]);

  useEffect(() => {
    if (!progress.bannerVisible || progress.phase === 'idle') {
      shimmer.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => {
      loop.stop();
      shimmer.setValue(0);
    };
  }, [progress.bannerVisible, progress.phase, shimmer]);

  if (!progress.bannerVisible || progress.phase === 'idle') {
    return null;
  }

  const isBackupPhase = progress.phase === 'backup';
  const isPlacePhase = progress.phase === 'place_cache';
  const message =
    progress.message.trim().length > 0
      ? progress.message
      : isBackupPhase
        ? 'Auto backup…'
        : isPlacePhase
          ? 'Looking up places…'
          : 'Building trips…';

  const showMeter = progress.total > 0;
  const displayStep = showMeter
    ? Math.min(progress.completed + (ratio < 1 ? 1 : 0), progress.total)
    : 0;

  const onDismiss = () => {
    if (isBackupPhase) {
      return;
    }
    if (isBackgroundWorkCycleRunning()) {
      requestBackgroundWorkAbort();
      return;
    }
    clearBackgroundWorkProgress();
  };

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-40, 120],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          paddingTop: insets.top + BANNER_TOP_GAP,
          paddingHorizontal: BANNER_SIDE_INSET,
        },
      ]}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: softPrimaryFill(tokens.primary, 0.35),
            shadowColor: colors.primary,
            minHeight: BACKGROUND_WORK_BANNER_BODY_HEIGHT - BANNER_TOP_GAP,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.wash,
            { backgroundColor: softPrimaryFill(tokens.primary, 0.2) },
          ]}
        />

        <View style={styles.row}>
          <LivePulse color={colors.primary} />
          <Text
            className="flex-1 text-sm font-semibold"
            numberOfLines={1}
            style={{ color: colors.foreground }}
          >
            {message}
          </Text>
          {showMeter ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: softPrimaryFill(tokens.primary, 0.18) },
              ]}
            >
              <Text
                className="text-xs font-bold tabular-nums"
                style={{ color: colors.primary }}
              >
                {displayStep}/{progress.total}
              </Text>
            </View>
          ) : null}
          {isBackupPhase ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop background work"
              hitSlop={10}
              onPress={onDismiss}
              style={styles.dismiss}
            >
              <X size={18} color={colors.mutedForeground} strokeWidth={2.25} />
            </Pressable>
          )}
        </View>

        {showMeter ? (
          <View
            style={[
              styles.meterTrack,
              { backgroundColor: softPrimaryFill(tokens.primary, 0.16) },
            ]}
          >
            <Animated.View
              style={[
                styles.meterFill,
                {
                  backgroundColor: colors.primary,
                  width: meterWidth.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            >
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.shimmer,
                  {
                    transform: [{ translateX: shimmerTranslate }],
                  },
                ]}
              />
            </Animated.View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    elevation: 100,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    gap: 9,
    overflow: 'hidden',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pulseHost: {
    width: 12,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseRing: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  meterTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 28,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dismiss: {
    padding: 2,
  },
});

export function backgroundWorkBannerOccupiedHeight(topInset: number): number {
  return topInset + BACKGROUND_WORK_BANNER_BODY_HEIGHT;
}
