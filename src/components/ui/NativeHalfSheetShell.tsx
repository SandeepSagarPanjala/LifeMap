import {useCallback, useEffect, useRef, type ReactNode} from 'react';
import {Pressable, StyleSheet, useWindowDimensions} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {BottomSheetDragHandle} from '@/components/ui/BottomSheetDragHandle';
import {
  BOTTOM_SHEET_BACKDROP,
  BOTTOM_SHEET_SURFACE,
} from '@/components/ui/bottom-sheet-chrome';
import {NativeHalfSheetCloseContext} from '@/components/ui/native-half-sheet-context';

const BACKDROP_FADE_MS = 220;
const SHEET_SLIDE_MS = 280;

type NativeHalfSheetShellProps = {
  children: ReactNode;
  onClose: () => void;
  /** Fraction of screen height, e.g. 0.5 = half sheet. */
  heightRatio?: number;
  /** When false, backdrop taps are ignored (e.g. gorhom overlay is open). */
  backdropDismissEnabled?: boolean;
};

/** Full-width bottom panel; backdrop fades in, sheet slides up. */
export function NativeHalfSheetShell({
  children,
  onClose,
  heightRatio = 0.5,
  backdropDismissEnabled = true,
}: NativeHalfSheetShellProps) {
  const {height: windowHeight} = useWindowDimensions();
  const sheetHeight = windowHeight * heightRatio;
  const closingRef = useRef(false);

  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(sheetHeight);

  useEffect(() => {
    closingRef.current = false;
    backdropOpacity.value = 0;
    sheetTranslateY.value = sheetHeight;
    backdropOpacity.value = withTiming(1, {duration: BACKDROP_FADE_MS});
    sheetTranslateY.value = withTiming(0, {
      duration: SHEET_SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [backdropOpacity, sheetHeight, sheetTranslateY]);

  const finishClose = useCallback(() => {
    closingRef.current = false;
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (!backdropDismissEnabled || closingRef.current) {
      return;
    }
    closingRef.current = true;
    backdropOpacity.value = withTiming(0, {duration: BACKDROP_FADE_MS});
    sheetTranslateY.value = withTiming(
      sheetHeight,
      {duration: SHEET_SLIDE_MS, easing: Easing.in(Easing.cubic)},
      finished => {
        if (finished) {
          runOnJS(finishClose)();
        }
      },
    );
  }, [backdropOpacity, backdropDismissEnabled, finishClose, sheetHeight, sheetTranslateY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{translateY: sheetTranslateY.value}],
  }));

  return (
    <NativeHalfSheetCloseContext.Provider value={requestClose}>
      <Animated.View style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={requestClose}
            style={styles.backdropTap}
          />
        </Animated.View>
        <Animated.View style={[styles.sheet, {height: sheetHeight}, sheetStyle]}>
          <BottomSheetDragHandle />
          <Animated.View style={styles.body}>{children}</Animated.View>
        </Animated.View>
      </Animated.View>
    </NativeHalfSheetCloseContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BOTTOM_SHEET_BACKDROP.color,
  },
  backdropTap: {
    flex: 1,
  },
  sheet: {
    width: '100%',
    backgroundColor: BOTTOM_SHEET_SURFACE.backgroundColor,
    borderTopLeftRadius: BOTTOM_SHEET_SURFACE.cornerRadius,
    borderTopRightRadius: BOTTOM_SHEET_SURFACE.cornerRadius,
    overflow: 'hidden',
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
