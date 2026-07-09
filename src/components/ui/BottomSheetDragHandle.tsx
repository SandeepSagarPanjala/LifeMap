import { StyleSheet, View } from 'react-native';

import { BOTTOM_SHEET_HANDLE } from '@/lib/app-constants';

/** Drag handle matching gorhom AppBottomSheet. */
export function BottomSheetDragHandle() {
  return (
    <View style={styles.row}>
      <View style={styles.handle} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: BOTTOM_SHEET_HANDLE.rowHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: BOTTOM_SHEET_HANDLE.width,
    height: BOTTOM_SHEET_HANDLE.height,
    borderRadius: BOTTOM_SHEET_HANDLE.borderRadius,
    backgroundColor: BOTTOM_SHEET_HANDLE.color,
  },
});
