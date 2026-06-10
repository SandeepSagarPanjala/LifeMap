import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {Text} from '@/components/ui/text';
import {CAPTURE_BUTTON_THEMES} from '@/components/map/map-capture-button-theme';
import {
  clampMoodScore,
  moodBucketForScore,
  MOOD_BUCKETS,
} from '@/lib/moments/mood';

const SHEET_OFFSCREEN = 360;

type MoodPickerSheetProps = {
  visible: boolean;
  score: number;
  onChange: (score: number) => void;
  onClose: () => void;
};

export function MoodPickerSheet({
  visible,
  score,
  onChange,
  onClose,
}: MoodPickerSheetProps) {
  const noteTheme = CAPTURE_BUTTON_THEMES.note;
  const bucket = moodBucketForScore(score);

  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;
  const closingRef = useRef(false);
  const trackWidthRef = useRef(0);

  useLayoutEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);
    }
  }, [visible]);

  const animateIn = useCallback(() => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_OFFSCREEN);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, sheetTranslateY]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SHEET_OFFSCREEN,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished) {
          onDone();
        }
      });
    },
    [backdropOpacity, sheetTranslateY],
  );

  const closeSheet = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    animateOut(() => {
      closingRef.current = false;
      setMounted(false);
      onClose();
    });
  }, [animateOut, onClose]);

  useEffect(() => {
    if (!visible && mounted && !closingRef.current) {
      closingRef.current = true;
      animateOut(() => {
        closingRef.current = false;
        setMounted(false);
      });
    }
  }, [animateOut, mounted, visible]);

  useEffect(() => {
    if (mounted && visible) {
      animateIn();
    }
  }, [animateIn, mounted, visible]);

  const updateScoreFromX = (x: number) => {
    if (trackWidthRef.current <= 0) {
      return;
    }
    onChange(clampMoodScore(x / trackWidthRef.current));
  };

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}>
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, {opacity: backdropOpacity}]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close mood picker"
          style={styles.dismissTap}
          onPress={closeSheet}
        />

        <Animated.View
          style={[styles.sheet, {transform: [{translateY: sheetTranslateY}]}]}>
          <View style={styles.handle} />

          <Text variant="h4" className="border-0 pb-0">
            How are you feeling?
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            Drag the slider or tap a mood below.
          </Text>

          <View
            style={[
              styles.moodBadge,
              {backgroundColor: noteTheme.badgeBg},
            ]}>
            <Text className="text-base font-semibold">{bucket.label}</Text>
          </View>

          <Pressable
            accessibilityRole="adjustable"
            accessibilityLabel="Mood slider"
            onLayout={event => {
              trackWidthRef.current = event.nativeEvent.layout.width;
            }}
            onPress={event => updateScoreFromX(event.nativeEvent.locationX)}
            style={styles.trackWrap}>
            <View style={styles.trackRow}>
              {MOOD_BUCKETS.map(item => (
                <View
                  key={item.label}
                  style={[styles.trackSegment, {backgroundColor: item.gradientStart}]}
                />
              ))}
            </View>
            <View
              pointerEvents="none"
              style={[styles.thumb, {left: `${score * 100}%`}]}
            />
          </Pressable>

          <View style={styles.bucketRow}>
            {MOOD_BUCKETS.map(item => {
              const active = bucket.label === item.label;
              return (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  accessibilityState={{selected: active}}
                  onPress={() =>
                    onChange(clampMoodScore((item.minScore + item.maxScore) / 2))
                  }
                  style={[
                    styles.bucketDot,
                    {
                      backgroundColor: item.gradientStart,
                      opacity: active ? 1 : 0.55,
                      transform: [{scale: active ? 1.15 : 1}],
                    },
                  ]}
                />
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={closeSheet}
            style={[styles.doneButton, {backgroundColor: noteTheme.badgeBg}]}>
            <Text className="font-medium">Done</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dismissTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#D1D5DB',
    marginBottom: 16,
  },
  moodBadge: {
    alignSelf: 'center',
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  trackWrap: {
    height: 28,
    justifyContent: 'center',
  },
  trackRow: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  trackSegment: {
    flex: 1,
  },
  thumb: {
    position: 'absolute',
    top: 4,
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#111827',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  bucketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  bucketDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  doneButton: {
    alignItems: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
});
