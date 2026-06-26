import type {ReactNode} from 'react';
import {StyleSheet, View} from 'react-native';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';

/**
 * Transparent stack screen + local gorhom provider.
 * Used by HistoryDatePicker only.
 */
export function SheetCaptureScreen({
  children,
  touchPassthrough = false,
}: {
  children: ReactNode;
  /** Let map touches through while the sheet close animation runs. */
  touchPassthrough?: boolean;
}) {
  return (
    <View
      style={styles.root}
      pointerEvents={touchPassthrough ? 'none' : 'box-none'}>
      <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
