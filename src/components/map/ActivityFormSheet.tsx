import {useCallback, useEffect, useRef, useState, type ComponentRef} from 'react';
import {Alert, Keyboard, StyleSheet, View} from 'react-native';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import type {BottomSheetModal} from '@gorhom/bottom-sheet';
import type {BottomSheetTextInput} from '@gorhom/bottom-sheet';

import {ActivityForm} from '@/components/map/ActivityLogSheet';
import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import {
  createActivity,
  updateActivity,
  type ActivityRow,
} from '@/db/repositories/activities';
import {saveActivityMoment} from '@/lib/moments/capture-activity';

export type ActivityFormRequest =
  | {kind: 'create-first'}
  | {kind: 'create'}
  | {kind: 'edit'; activity: ActivityRow};

type ActivityFormSheetProps = {
  request: ActivityFormRequest | null;
  onClose: () => void;
  onSaved: () => void;
  onLoggedAndClose: () => void;
};

/** Gorhom overlay for add / edit activity — keyboard + emoji label input. */
export function ActivityFormSheet({
  request,
  onClose,
  onSaved,
  onLoggedAndClose,
}: ActivityFormSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const labelInputRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  const [emoji, setEmoji] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (request?.kind === 'edit') {
      setEmoji(request.activity.emoji);
      setLabel(request.activity.label);
    } else if (request != null) {
      setEmoji('');
      setLabel('');
    }
    setSaving(false);
  }, [request]);

  // Gorhom needs the sheet presented before focus() works — same as CaptureNoteScreen.
  useEffect(() => {
    if (request == null) {
      return;
    }
    const timer = setTimeout(() => labelInputRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, [request]);

  const dismissKeyboard = useCallback(() => {
    labelInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const requestClose = useCallback(() => {
    dismissKeyboard();
    sheetRef.current?.dismiss();
  }, [dismissKeyboard]);

  const handleDismissed = useCallback(() => {
    dismissKeyboard();
    onClose();
  }, [dismissKeyboard, onClose]);

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

  const handleSubmit = useCallback(async () => {
    if (request == null || saving) {
      return;
    }
    setSaving(true);
    try {
      if (request.kind === 'create-first') {
        const created = await createActivity({emoji, label});
        await saveActivityMoment(created);
        onSaved();
        onLoggedAndClose();
        return;
      }
      if (request.kind === 'create') {
        await createActivity({emoji, label});
        onSaved();
        requestClose();
        return;
      }
      await updateActivity(request.activity.id, {emoji, label});
      onSaved();
      requestClose();
    } catch (error) {
      Alert.alert(
        'Could not save activity',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    emoji,
    label,
    onLoggedAndClose,
    onSaved,
    request,
    requestClose,
    saving,
  ]);

  const title =
    request?.kind === 'create-first'
      ? 'Add your first activity'
      : request?.kind === 'create'
        ? 'New activity'
        : request?.kind === 'edit'
          ? 'Edit activity'
          : '';

  const submitLabel = request?.kind === 'create-first' ? 'Save & log' : 'Save';
  const showBack =
    request?.kind === 'create' || request?.kind === 'edit';

  return (
    <View
      style={styles.host}
      pointerEvents={request != null ? 'box-none' : 'none'}>
      <BottomSheetModalProvider>
        <AppBottomSheet
          name="activity-form"
          visible={request != null}
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
          footerPadding={12}>
          {request != null ? (
            <ActivityForm
              key={
                request.kind === 'edit'
                  ? String(request.activity.id)
                  : request.kind
              }
              compactFooter
              title={title}
              emoji={emoji}
              label={label}
              saving={saving}
              submitLabel={submitLabel}
              labelInputRef={labelInputRef}
              onBack={showBack ? requestClose : undefined}
              onChangeEmoji={setEmoji}
              onChangeLabel={setLabel}
              onSubmit={() => {
                void handleSubmit();
              }}
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
