import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

/**
 * Transparent stack screen + local gorhom provider.
 * Reserved for gorhom-only capture flows (none on map today).
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
      pointerEvents={touchPassthrough ? 'none' : 'box-none'}
    >
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
