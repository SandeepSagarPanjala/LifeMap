import { useEffect, useRef, type MutableRefObject } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const LIVE_BAR_COUNT = 28;
const BAR_WIDTH = 2.5;
const BAR_GAP = 2.5;
const BAR_MAX_HEIGHT = 40;
const BAR_MIN_SCALE = 0.04;
/** How often we sample the latest mic level into the strip. */
const SAMPLE_MS = 48;

type VoiceLiveMeterProps = {
  /** Latest mic level 0..1 — updated via ref so the sheet does not re-render. */
  levelRef: MutableRefObject<number>;
  accentColor?: string;
};

/**
 * Scrolling mic waveform driven by real metering (not random).
 * Samples a ref on an interval and sets bar heights directly — no timing storm.
 */
export function VoiceLiveMeter({
  levelRef,
  accentColor = '#FF9500',
}: VoiceLiveMeterProps) {
  const historyRef = useRef<number[]>(
    Array.from({ length: LIVE_BAR_COUNT }, () => BAR_MIN_SCALE),
  );
  const scales = useRef(
    Array.from(
      { length: LIVE_BAR_COUNT },
      () => new Animated.Value(BAR_MIN_SCALE),
    ),
  ).current;

  useEffect(() => {
    const id = setInterval(() => {
      const sample = Math.max(
        BAR_MIN_SCALE,
        Math.min(1, levelRef.current ?? BAR_MIN_SCALE),
      );
      const prev = historyRef.current;
      const next = new Array<number>(LIVE_BAR_COUNT);
      for (let i = 0; i < LIVE_BAR_COUNT - 1; i++) {
        next[i] = prev[i + 1]!;
      }
      next[LIVE_BAR_COUNT - 1] = sample;
      historyRef.current = next;

      for (let i = 0; i < LIVE_BAR_COUNT; i++) {
        // Direct set — avoids queuing 28 timing animations per tick.
        scales[i]!.setValue(next[i]!);
      }
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [levelRef, scales]);

  return (
    <View style={styles.liveWrap}>
      {scales.map((scale, index) => (
        <View key={index} style={styles.liveBarSlot}>
          <Animated.View
            style={[
              styles.liveBar,
              {
                backgroundColor: accentColor,
                opacity: 0.45 + (index / (LIVE_BAR_COUNT - 1)) * 0.55,
                transform: [{ scaleY: scale }],
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

type VoicePlaybackMeterProps = {
  progress: number;
  isPlaying?: boolean;
  accentColor?: string;
  trackColor?: string;
};

/** Playback: simple progress track — no fake waveform, no duplicate time labels. */
export function VoicePlaybackMeter({
  progress,
  isPlaying = false,
  accentColor = '#FF9500',
  trackColor = '#E5E7EB',
}: VoicePlaybackMeterProps) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (!isPlaying) {
      pulse.setValue(0.35);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPlaying, pulse]);

  return (
    <View style={styles.playbackWrap}>
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.max(clampedProgress * 100, isPlaying ? 2 : 0)}%`,
              backgroundColor: accentColor,
            },
          ]}
        />
      </View>
      {isPlaying ? (
        <Animated.View
          style={[
            styles.playPulse,
            { backgroundColor: accentColor, opacity: pulse },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  liveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: BAR_GAP,
    minHeight: BAR_MAX_HEIGHT,
    marginTop: 4,
    marginBottom: 8,
    alignSelf: 'center',
  },
  liveBarSlot: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBar: {
    width: BAR_WIDTH,
    height: BAR_MAX_HEIGHT,
    borderRadius: BAR_WIDTH,
  },
  playbackWrap: {
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
    width: '100%',
  },
  track: {
    width: '100%',
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  playPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
