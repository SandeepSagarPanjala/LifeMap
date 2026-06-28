import {useCallback, useEffect, useRef, type ComponentRef} from 'react';
import {Keyboard, StyleSheet, View} from 'react-native';
import {
  BottomSheetModalProvider,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type {BottomSheetModal} from '@gorhom/bottom-sheet';

import {EditFavoriteLabelPanel} from '@/components/map/EditFavoriteLabelSheet';
import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';

type SavedPlacesEditSheetProps = {
  place: SavedPlaceRow | null;
  onClose: () => void;
  onSave: (place: SavedPlaceRow, label: string) => Promise<void>;
};

/** Gorhom overlay for rename — keyboard handling stays in the library. */
export function SavedPlacesEditSheet({
  place,
  onClose,
  onSave,
}: SavedPlacesEditSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const labelInputRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gorhom needs the sheet presented before focus() works — same as ActivityFormSheet.
  useEffect(() => {
    if (place == null) {
      return;
    }
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      labelInputRef.current?.focus();
    }, 400);
    return () => {
      if (focusTimerRef.current != null) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [place]);

  const dismissKeyboard = useCallback(() => {
    if (focusTimerRef.current != null) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    labelInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const focusLabelInput = useCallback(() => {
    labelInputRef.current?.focus();
  }, []);

  const handleSheetAnimate = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex >= 0 && fromIndex < 0) {
        focusLabelInput();
      }
      if (toIndex === -1) {
        dismissKeyboard();
      }
    },
    [dismissKeyboard, focusLabelInput],
  );

  const requestClose = useCallback(() => {
    dismissKeyboard();
    sheetRef.current?.dismiss();
  }, [dismissKeyboard]);

  const handleDismissed = useCallback(() => {
    dismissKeyboard();
    onClose();
  }, [dismissKeyboard, onClose]);

  const handleSave = useCallback(
    (label: string) => {
      if (place == null) {
        return;
      }
      void onSave(place, label).then(() => {
        requestClose();
      });
    },
    [onSave, place, requestClose],
  );

  return (
    <View
      style={styles.host}
      pointerEvents={place != null ? 'box-none' : 'none'}>
      <BottomSheetModalProvider>
        <AppBottomSheet
          name="saved-places-edit"
          visible={place != null}
          bottomSheetRef={sheetRef}
          onClose={handleDismissed}
          onAnimate={handleSheetAnimate}
          onClosing={dismissKeyboard}
          instantPresent
          stackBehavior="push"
          enableDynamicSizing
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          dismissKeyboardOnClose
          releaseTouchesWhileClosing>
          {place != null ? (
            <EditFavoriteLabelPanel
              key={place.id}
              initialValue={place.label}
              inputRef={labelInputRef}
              onClose={requestClose}
              onSave={handleSave}
            />
          ) : null}
        </AppBottomSheet>
      </BottomSheetModalProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    elevation: 10,
  },
});
