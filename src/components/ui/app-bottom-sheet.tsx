import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
} from 'react';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
  type BottomSheetModalProps,
} from '@gorhom/bottom-sheet';
import type {BottomSheetModal as BottomSheetModalType} from '@gorhom/bottom-sheet';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {Keyboard, Platform, StyleSheet, type KeyboardEvent} from 'react-native';
import {runOnJS} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const DEFAULT_SNAP_POINTS = ['50%'];

type InterceptableBackdropProps = BottomSheetBackdropProps & {
  onPress: () => void;
};

function InterceptableBackdrop({onPress, ...props}: InterceptableBackdropProps) {
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onPress)();
  });

  return (
    <GestureDetector gesture={tap}>
      <BottomSheetBackdrop {...props} pressBehavior="none" />
    </GestureDetector>
  );
}

type AppBottomSheetProps = {
  name?: string;
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  scrollable?: boolean;
  rawChildren?: boolean;
  snapPoints?: (string | number)[];
  enableDynamicSizing?: boolean;
  stackBehavior?: BottomSheetModalProps['stackBehavior'];
  keyboardBehavior?: BottomSheetModalProps['keyboardBehavior'];
  keyboardBlurBehavior?: BottomSheetModalProps['keyboardBlurBehavior'];
  dismissKeyboardOnClose?: boolean;
  keyboardAware?: boolean;
  scrollRef?: React.RefObject<ComponentRef<typeof BottomSheetScrollView> | null>;
  onAnimate?: (fromIndex: number, toIndex: number) => void;
  /** Return true to keep the sheet open (e.g. dismiss keyboard first). */
  onBackdropPress?: () => boolean;
  enablePanDownToClose?: boolean;
  bottomSheetRef?: React.RefObject<BottomSheetModalType | null>;
};

export function AppBottomSheet({
  name,
  visible,
  onClose,
  children,
  scrollable = false,
  rawChildren = false,
  snapPoints: snapPointsProp,
  enableDynamicSizing = false,
  stackBehavior = 'replace',
  keyboardBehavior = 'interactive',
  keyboardBlurBehavior = 'restore',
  dismissKeyboardOnClose = true,
  keyboardAware = false,
  scrollRef,
  onAnimate,
  onBackdropPress,
  enablePanDownToClose = true,
  bottomSheetRef,
}: AppBottomSheetProps) {
  const ref = useRef<BottomSheetModalType>(null);
  const internalScrollRef = useRef<ComponentRef<typeof BottomSheetScrollView>>(null);
  const insets = useSafeAreaInsets();
  const isOpenRef = useRef(false);
  const suppressDismissRef = useRef(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const snapPointsKey = snapPointsProp?.join('|') ?? '';
  const snapPoints = useMemo(() => {
    if (enableDynamicSizing) {
      return undefined;
    }
    return snapPointsProp ?? DEFAULT_SNAP_POINTS;
  }, [enableDynamicSizing, snapPointsKey, snapPointsProp]);

  useEffect(() => {
    if (visible) {
      suppressDismissRef.current = true;
      const frame = requestAnimationFrame(() => {
        ref.current?.present();
        isOpenRef.current = true;
        suppressDismissRef.current = false;
      });
      return () => {
        cancelAnimationFrame(frame);
        suppressDismissRef.current = false;
      };
    }

    if (!isOpenRef.current) {
      return;
    }

    suppressDismissRef.current = true;
    ref.current?.dismiss();
    isOpenRef.current = false;
    suppressDismissRef.current = false;
  }, [visible]);

  useEffect(() => {
    if (!keyboardAware) {
      setKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: KeyboardEvent) => {
      setKeyboardInset(event.endCoordinates.height);
    };
    const onHide = () => {
      setKeyboardInset(0);
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardAware]);

  const handleDismiss = useCallback(() => {
    if (suppressDismissRef.current) {
      return;
    }
    isOpenRef.current = false;
    onClose();
  }, [onClose]);

  const handleAnimate = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex === -1 && dismissKeyboardOnClose) {
        Keyboard.dismiss();
      }
      onAnimate?.(fromIndex, toIndex);
    },
    [dismissKeyboardOnClose, onAnimate],
  );

  const handleBackdropPress = useCallback(() => {
    if (onBackdropPress?.()) {
      return;
    }
    ref.current?.dismiss();
  }, [onBackdropPress]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => {
      const sharedProps = {
        ...props,
        disappearsOnIndex: -1 as const,
        appearsOnIndex: 0 as const,
        opacity: 0.32,
      };

      if (onBackdropPress) {
        return (
          <InterceptableBackdrop {...sharedProps} onPress={handleBackdropPress} />
        );
      }

      return <BottomSheetBackdrop {...sharedProps} pressBehavior="close" />;
    },
    [handleBackdropPress, onBackdropPress],
  );

  const contentStyle = useMemo(
    () => ({
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: Math.max(insets.bottom, 16) + (keyboardAware ? keyboardInset : 0),
    }),
    [insets.bottom, keyboardAware, keyboardInset],
  );

  const mergedScrollRef = scrollRef ?? internalScrollRef;

  const assignSheetRef = useCallback(
    (instance: BottomSheetModalType | null) => {
      ref.current = instance;
      if (bottomSheetRef) {
        bottomSheetRef.current = instance;
      }
    },
    [bottomSheetRef],
  );

  return (
    <BottomSheetModal
      name={name}
      ref={assignSheetRef}
      snapPoints={snapPoints}
      enableDynamicSizing={enableDynamicSizing}
      onDismiss={handleDismiss}
      onAnimate={handleAnimate}
      backdropComponent={renderBackdrop}
      enablePanDownToClose={enablePanDownToClose}
      enableBlurKeyboardOnGesture
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode="adjustResize"
      stackBehavior={stackBehavior}
      containerStyle={styles.modalContainer}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}>
      {rawChildren ? (
        children
      ) : scrollable ? (
        <BottomSheetScrollView
          ref={mergedScrollRef}
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={keyboardAware}>
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          style={[contentStyle, enableDynamicSizing ? null : styles.fill]}>
          {children}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    zIndex: 1000,
    elevation: 1000,
  },
  fill: {
    flex: 1,
  },
  handle: {
    backgroundColor: '#D1D1D6',
    width: 36,
  },
  background: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
});
