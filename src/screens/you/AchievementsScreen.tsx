import { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type ImageStyle,
  type StyleProp,
} from 'react-native';
import { X } from 'lucide-react-native';
import LottieView from 'lottie-react-native';
import {
  ColorMatrix,
  grayscale,
} from 'react-native-color-matrix-image-filters';
import Animated, {
  withSpring,
  type EntryAnimationsValues,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY } from '@/lib/app-copy';
import {
  ACHIEVEMENT_BADGES,
  ACHIEVEMENT_IMAGES,
  achievementImageSource,
  achievementUnlockInstruction,
  emptyAchievementsProgress,
  readAchievementsProgress,
  type AchievementBadgeId,
  type AchievementPillar,
  type AchievementsProgressPayload,
} from '@/lib/achievements';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { useAppStore } from '@/stores/app-store';

const CELEBRATION_CONFETTI = require('../../../assets/lottie/celebration-confetti.json');
const LOCKED_GRAYSCALE = grayscale(1);

const H_PAD = 20;
const COL_GAP = 8;
const IMAGE = 72;
const DETAIL_IMAGE_MAX = 280;
const CLOSE_SIZE = Math.round(MAP_STACK_BUTTON_SIZE * 1.15);

const POP_SPRING = { damping: 16, stiffness: 280, mass: 0.7 };

/** Scale-only pop — no opacity (Liquid Glass breaks under opacity fades). */
function badgeDetailPopIn(_values: EntryAnimationsValues) {
  'worklet';
  return {
    initialValues: {
      transform: [{ scale: 0.92 }],
    },
    animations: {
      transform: [{ scale: withSpring(1, POP_SPRING) }],
    },
  };
}

const PILLARS: { id: AchievementPillar; title: string }[] = [
  { id: 'traveler', title: APP_COPY.achievements.pillarTraveler },
  { id: 'explorer', title: APP_COPY.achievements.pillarExplorer },
  { id: 'rhythm', title: APP_COPY.achievements.pillarRhythm },
];

function badgeName(id: AchievementBadgeId): string {
  return APP_COPY.achievements.names[id];
}

function formatEarnedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatProgressValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1);
}

/** Decode all badge PNGs so the pop-up never waits on first decode. */
function preloadAchievementImages() {
  for (const id of Object.keys(ACHIEVEMENT_IMAGES) as AchievementBadgeId[]) {
    const resolved = Image.resolveAssetSource(ACHIEVEMENT_IMAGES[id]);
    if (resolved?.uri) {
      void Image.prefetch(resolved.uri);
    }
  }
}

function AchievementImagePreloader({ size }: { size: number }) {
  return (
    <View
      pointerEvents="none"
      style={styles.preloadHost}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ACHIEVEMENT_BADGES.map(badge => (
        <Image
          key={badge.id}
          source={achievementImageSource(badge.id)}
          style={{ width: size, height: size }}
          resizeMode="contain"
        />
      ))}
    </View>
  );
}

/** Locked badges render grayscale; unlocked stay full color. */
function AchievementBadgeImage({
  id,
  unlocked,
  style,
}: {
  id: AchievementBadgeId;
  unlocked: boolean;
  style: StyleProp<ImageStyle>;
}) {
  const image = (
    <Image
      source={achievementImageSource(id)}
      style={style}
      resizeMode="contain"
    />
  );
  if (unlocked) {
    return image;
  }
  return <ColorMatrix matrix={LOCKED_GRAYSCALE}>{image}</ColorMatrix>;
}

function BadgeCell({
  id,
  unlocked,
  unlockedAt,
  progressLabel,
  onPress,
}: {
  id: AchievementBadgeId;
  unlocked: boolean;
  unlockedAt: string | null;
  progressLabel: string | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.cell}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badgeName(id)}
    >
      <AchievementBadgeImage
        id={id}
        unlocked={unlocked}
        style={styles.image}
      />
      <Text
        variant="small"
        className="mt-2 text-center font-medium"
        numberOfLines={2}
      >
        {badgeName(id)}
      </Text>
      <Text
        variant="muted"
        className="mt-0.5 text-center text-xs"
        numberOfLines={1}
      >
        {unlocked && unlockedAt
          ? APP_COPY.achievements.earned(formatEarnedDate(unlockedAt))
          : (progressLabel ?? APP_COPY.achievements.locked)}
      </Text>
    </Pressable>
  );
}

/**
 * In-screen overlay (not RN Modal) so Liquid Glass can sample the grid behind
 * and badge bitmaps are already warm in this window.
 */
function BadgeDetailOverlay({
  id,
  unlocked,
  unlockedAt,
  imageSize,
  onClose,
}: {
  id: AchievementBadgeId;
  unlocked: boolean;
  unlockedAt: string | null;
  imageSize: number;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const distanceUnit = useAppStore(state => state.distanceUnit);
  const instruction = achievementUnlockInstruction(id, distanceUnit);

  return (
    <View
      style={styles.overlayRoot}
      pointerEvents="box-none"
      accessibilityViewIsModal
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel={APP_COPY.common.close}
      />
      <View
        style={[
          styles.overlayBody,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        pointerEvents="box-none"
      >
        {/* Animate image only — Liquid Glass must not sit under scale transforms. */}
        <Animated.View
          key={id}
          entering={badgeDetailPopIn}
          style={{ width: imageSize, height: imageSize }}
        >
          <AchievementBadgeImage
            id={id}
            unlocked={unlocked}
            style={{ width: imageSize, height: imageSize }}
          />
        </Animated.View>

        <View style={styles.textGlassShadow}>
          <AdaptiveGlassSurface effect="regular" style={styles.textGlass}>
            <Text
              variant="h2"
              className="text-center"
              style={{ color: colors.foreground }}
            >
              {badgeName(id)}
            </Text>
            {unlocked && unlockedAt ? (
              <Text variant="muted" className="mt-2 text-center">
                {APP_COPY.achievements.earned(formatEarnedDate(unlockedAt))}
              </Text>
            ) : null}
            <Text
              variant="muted"
              className="mt-3 text-center leading-6"
              style={{ color: colors.foreground }}
            >
              {instruction}
            </Text>
          </AdaptiveGlassSurface>
        </View>

        <View style={styles.closeWrap}>
          <MapGlassCircleButton
            accessibilityLabel={APP_COPY.common.close}
            onPress={onClose}
            size={CLOSE_SIZE}
          >
            <X size={22} color={colors.primary} strokeWidth={2.25} />
          </MapGlassCircleButton>
        </View>
      </View>

      {unlocked ? (
        <View pointerEvents="none" style={styles.confettiHost}>
          <LottieView
            key={id}
            source={CELEBRATION_CONFETTI}
            autoPlay
            loop={false}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        </View>
      ) : null}
    </View>
  );
}

export function AchievementsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const detailImageSize = Math.min(DETAIL_IMAGE_MAX, width - H_PAD * 2 - 32);

  const [payload, setPayload] = useState<AchievementsProgressPayload>(() =>
    emptyAchievementsProgress(),
  );
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<AchievementBadgeId | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      const cached = await readAchievementsProgress();
      setPayload(cached ?? emptyAchievementsProgress());
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    preloadAchievementImages();
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      return;
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedId(null);
      return true;
    });
    return () => sub.remove();
  }, [selectedId]);

  const bottomPad =
    insets.bottom + MAP_MOMENTS_BAR_HEIGHT + MAP_MOMENTS_BAR_GAP + 24;

  const selectedUnlock =
    selectedId != null ? payload.unlocks[selectedId] : undefined;
  const selectedUnlocked = selectedUnlock != null;
  const selectedUnlockedAt = selectedUnlock?.unlockedAt ?? null;

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <AchievementImagePreloader size={detailImageSize} />

      <View style={styles.header}>
        <Text variant="h2">{APP_COPY.achievements.title}</Text>
        {loaded ? (
          <Text variant="muted" className="mt-1">
            {APP_COPY.achievements.emptyHint}
          </Text>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: H_PAD,
          paddingBottom: bottomPad,
        }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={selectedId == null}
      >
        {PILLARS.map(pillar => {
          const badges = ACHIEVEMENT_BADGES.filter(b => b.pillar === pillar.id);
          return (
            <View key={pillar.id} style={styles.section}>
              <Text variant="h3" className="mb-3">
                {pillar.title}
              </Text>
              <View style={styles.grid}>
                {badges.map(badge => {
                  const unlock = payload.unlocks[badge.id];
                  const unlocked = unlock != null;
                  const unlockedAt = unlock?.unlockedAt ?? null;
                  const cachedProgress = payload.progress?.[badge.id];
                  const progressLabel =
                    !unlocked && cachedProgress != null
                      ? APP_COPY.achievements.progress(
                          formatProgressValue(cachedProgress.current),
                          formatProgressValue(cachedProgress.threshold),
                        )
                      : null;
                  return (
                    <BadgeCell
                      key={badge.id}
                      id={badge.id}
                      unlocked={unlocked}
                      unlockedAt={unlockedAt}
                      progressLabel={progressLabel}
                      onPress={() => setSelectedId(badge.id)}
                    />
                  );
                })}
              </View>
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
            </View>
          );
        })}
      </ScrollView>

      {selectedId != null ? (
        <BadgeDetailOverlay
          id={selectedId}
          unlocked={selectedUnlocked}
          unlockedAt={selectedUnlockedAt}
          imageSize={detailImageSize}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: H_PAD,
    paddingTop: 12,
    paddingBottom: 16,
  },
  section: {
    marginBottom: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -COL_GAP,
  },
  cell: {
    width: '33.333%',
    paddingHorizontal: COL_GAP,
    marginBottom: 16,
    alignItems: 'center',
  },
  image: {
    width: IMAGE,
    height: IMAGE,
    borderRadius: 0,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 16,
    marginBottom: 20,
    opacity: 0.6,
  },
  preloadHost: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'center',
    paddingHorizontal: H_PAD,
  },
  confettiHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  overlayBody: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
  },
  textGlassShadow: {
    marginTop: 16,
    width: '100%',
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  textGlass: {
    width: '100%',
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  closeWrap: {
    marginTop: 22,
    alignItems: 'center',
  },
});
