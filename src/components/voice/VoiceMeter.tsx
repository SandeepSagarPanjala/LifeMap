import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const LIVE_BAR_COUNT = 5;
const BAR_WIDTH = 4;
const BAR_MAX_HEIGHT = 36;

type VoiceLiveMeterProps = {
  level: number;
  accentColor?: string;
};

/** Recording: 5 bars driven by current mic level only. */
export function VoiceLiveMeter({
  level,
  accentColor = '#FF9500',
}: VoiceLiveMeterProps) {
  const scales = useRef(
    Array.from({ length: LIVE_BAR_COUNT }, () => new Animated.Value(0.2)),
  ).current;

  useEffect(() => {
    const animations = scales.map((scale, index) => {
      const wobble = 0.72 + 0.28 * Math.sin(index * 1.35 + level * 4);
      const target = Math.max(0.18, Math.min(1, level * wobble));
      return Animated.timing(scale, {
        toValue: target,
        duration: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
    });
    Animated.parallel(animations).start();
  }, [level, scales]);

  return (
    <View style={styles.liveWrap}>
      {scales.map((scale, index) => (
        <View key={index} style={styles.liveBarSlot}>
          <Animated.View
            style={[
              styles.liveBar,
              {
                backgroundColor: accentColor,
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
    gap: 10,
    minHeight: BAR_MAX_HEIGHT,
    marginTop: 4,
    marginBottom: 8,
  },
  liveBarSlot: {
    height: BAR_MAX_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveBar: {
    width: BAR_WIDTH,
    height: BAR_MAX_HEIGHT,
    borderRadius: 2,
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
