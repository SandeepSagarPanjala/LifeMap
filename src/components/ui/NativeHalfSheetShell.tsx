import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BottomSheetDragHandle } from '@/components/ui/BottomSheetDragHandle';
import {
  BOTTOM_SHEET_BACKDROP,
  BOTTOM_SHEET_SURFACE,
} from '@/lib/app-constants';
import { NativeHalfSheetCloseContext } from '@/components/ui/native-half-sheet-context';

const BACKDROP_FADE_MS = 220;
const SHEET_SLIDE_MS = 280;
/** Ignore backdrop taps briefly after content/height swaps so a finger-up
 *  on the newly exposed backdrop cannot dismiss the whole Activity screen. */
const BACKDROP_DISMISS_LOCK_MS = 400;

type NativeHalfSheetShellProps = {
  children: ReactNode;
  /** Return `false` to cancel close and reopen the sheet (e.g. overlay still open). */
  onClose: () => boolean | void;
  /** Fraction of screen height, e.g. 0.5 = half sheet. */
  heightRatio?: number;
  /** When false, backdrop taps are ignored (e.g. gorhom overlay is open). */
  backdropDismissEnabled?: boolean;
  /** Sync check — preferred over `backdropDismissEnabled` when a same-tap
   *  fallthrough can race React state by one frame. */
  isBackdropDismissAllowed?: () => boolean;
  /** Return true if the backdrop press was handled (do not close the shell). */
  onBackdropPress?: () => boolean;
  /** Fires once after the open slide finishes. */
  onOpened?: () => void;
};

/** Full-width bottom panel; backdrop fades in, sheet slides up. */
export function NativeHalfSheetShell({
  children,
  onClose,
  heightRatio = 0.5,
  backdropDismissEnabled = true,
  isBackdropDismissAllowed,
  onBackdropPress,
  onOpened,
}: NativeHalfSheetShellProps) {
  const { height: windowHeight } = useWindowDimensions();
  const targetSheetHeight = windowHeight * heightRatio;
  const closingRef = useRef(false);
  const didOpenRef = useRef(false);
  const backdropLockUntilRef = useRef(0);
  const onOpenedRef = useRef(onOpened);
  onOpenedRef.current = onOpened;
  const backdropDismissEnabledRef = useRef(backdropDismissEnabled);
  backdropDismissEnabledRef.current = backdropDismissEnabled;
  const isBackdropDismissAllowedRef = useRef(isBackdropDismissAllowed);
  isBackdropDismissAllowedRef.current = isBackdropDismissAllowed;
  const onBackdropPressRef = useRef(onBackdropPress);
  onBackdropPressRef.current = onBackdropPress;
  const [isClosing, setIsClosing] = useState(false);

  const backdropOpacity = useSharedValue(0);
  const sheetHeightSV = useSharedValue(targetSheetHeight);
  const sheetTranslateY = useSharedValue(targetSheetHeight);

  const lockBackdropDismiss = useCallback(() => {
    backdropLockUntilRef.current = Date.now() + BACKDROP_DISMISS_LOCK_MS;
  }, []);

  useEffect(() => {
    if (closingRef.current) {
      return;
    }
    if (!didOpenRef.current) {
      sheetHeightSV.value = targetSheetHeight;
      return;
    }
    lockBackdropDismiss();
    sheetHeightSV.value = withTiming(targetSheetHeight, {
      duration: SHEET_SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [lockBackdropDismiss, sheetHeightSV, targetSheetHeight]);

  useEffect(() => {
    if (didOpenRef.current) {
      return;
    }
    didOpenRef.current = true;
    closingRef.current = false;
    setIsClosing(false);
    const notifyOpened = () => {
      onOpenedRef.current?.();
    };
    backdropOpacity.value = 0;
    sheetHeightSV.value = targetSheetHeight;
    sheetTranslateY.value = targetSheetHeight;
    backdropOpacity.value = withTiming(1, { duration: BACKDROP_FADE_MS });
    sheetTranslateY.value = withTiming(
      0,
      {
        duration: SHEET_SLIDE_MS,
        easing: Easing.out(Easing.cubic),
      },
      finished => {
        if (finished) {
          runOnJS(notifyOpened)();
        }
      },
    );
    // Open once on mount; height changes after open are handled separately.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only open
  }, []);

  const reopenSheet = useCallback(() => {
    closingRef.current = false;
    setIsClosing(false);
    backdropOpacity.value = withTiming(1, { duration: BACKDROP_FADE_MS });
    sheetTranslateY.value = withTiming(0, {
      duration: SHEET_SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [backdropOpacity, sheetTranslateY]);

  const finishClose = useCallback(() => {
    if (!closingRef.current) {
      return;
    }
    const closed = onClose();
    if (closed === false) {
      reopenSheet();
      return;
    }
    closingRef.current = false;
    // Screen is popping; keep passthrough until unmount.
  }, [onClose, reopenSheet]);

  const requestClose = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    // Stop intercepting touches as soon as close starts so a failed/pop-blocked
    // navigation can never leave an invisible full-screen blocker over the map.
    setIsClosing(true);
    backdropOpacity.value = withTiming(0, { duration: BACKDROP_FADE_MS });
    sheetTranslateY.value = withTiming(
      sheetHeightSV.value,
      { duration: SHEET_SLIDE_MS, easing: Easing.in(Easing.cubic) },
      finished => {
        // Height animations can cancel this timing; still finish if we meant to close.
        if (finished || closingRef.current) {
          runOnJS(finishClose)();
        }
      },
    );
    // Failsafe: if the close animation is canceled and never finishes, still pop.
    setTimeout(() => {
      if (closingRef.current) {
        finishClose();
      }
    }, SHEET_SLIDE_MS + 120);
  }, [backdropOpacity, finishClose, sheetHeightSV, sheetTranslateY]);

  const handleBackdropPress = useCallback(() => {
    if (Date.now() < backdropLockUntilRef.current) {
      return;
    }
    const allowedByRef = isBackdropDismissAllowedRef.current?.() ?? true;
    if (!allowedByRef || !backdropDismissEnabledRef.current) {
      return;
    }
    if (onBackdropPressRef.current?.()) {
      lockBackdropDismiss();
      return;
    }
    requestClose();
  }, [lockBackdropDismiss, requestClose]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetHeightSV.value,
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  return (
    <NativeHalfSheetCloseContext.Provider value={requestClose}>
      <Animated.View
        pointerEvents={isClosing ? 'none' : 'auto'}
        style={styles.root}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss sheet"
            onPress={handleBackdropPress}
            style={styles.backdropTap}
          />
        </Animated.View>
        <Animated.View style={[styles.sheet, sheetStyle]}>
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
