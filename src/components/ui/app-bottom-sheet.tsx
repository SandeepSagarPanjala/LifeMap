import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import {Keyboard, StyleSheet} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

const DEFAULT_SNAP_POINTS = ['50%'];

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
  onAnimate?: (fromIndex: number, toIndex: number) => void;
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
  onAnimate,
}: AppBottomSheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();
  const isOpenRef = useRef(false);
  const suppressDismissRef = useRef(false);

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

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
        opacity={0.32}
      />
    ),
    [],
  );

  const contentStyle = useMemo(
    () => ({
      paddingHorizontal: 20,
      paddingTop: 4,
      paddingBottom: Math.max(insets.bottom, 16),
    }),
    [insets.bottom],
  );

  return (
    <BottomSheetModal
      name={name}
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={enableDynamicSizing}
      onDismiss={handleDismiss}
      onAnimate={handleAnimate}
      backdropComponent={renderBackdrop}
      enablePanDownToClose
      enableBlurKeyboardOnGesture
      keyboardBehavior={keyboardBehavior}
      keyboardBlurBehavior={keyboardBlurBehavior}
      android_keyboardInputMode="adjustResize"
      stackBehavior={stackBehavior}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}>
      {rawChildren ? (
        children
      ) : scrollable ? (
        <BottomSheetScrollView
          contentContainerStyle={contentStyle}
          keyboardShouldPersistTaps="handled">
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
