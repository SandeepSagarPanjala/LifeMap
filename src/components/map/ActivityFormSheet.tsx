import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import { Alert, Keyboard, StyleSheet, View } from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import type { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { ActivityForm } from '@/components/map/ActivityLogSheet';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import {
  createActivity,
  updateActivity,
  type ActivityRow,
} from '@/db/repositories/activities';
import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { validateActivityDefinition } from '@/lib/activities/validate-activity-definition';
import { saveActivityMoment } from '@/lib/moments/capture-activity';

export type ActivityFormRequest =
  | { kind: 'create-first' }
  | { kind: 'create' }
  | { kind: 'edit'; activity: ActivityRow };

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
  const openEmojiRef = useRef<{ open: () => void } | null>(null);
  const [emoji, setEmoji] = useState('');
  const [label, setLabel] = useState('');
  const [fields, setFields] = useState<ActivityFieldDefinition[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (request?.kind === 'edit') {
      setEmoji(request.activity.emoji);
      setLabel(request.activity.label);
      setFields(request.activity.fields);
    } else if (request != null) {
      setEmoji('❓');
      setLabel('');
      setFields([]);
    }
    setSaving(false);
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

  const isCreateFlow =
    request?.kind === 'create' || request?.kind === 'create-first';

  const handleSheetAnimate = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex >= 0 && fromIndex < 0 && isCreateFlow) {
        // Open with the sheet rise — retry next frame if native picker isn't ready yet.
        openEmojiRef.current?.open();
        requestAnimationFrame(() => openEmojiRef.current?.open());
      }
      if (toIndex === -1) {
        dismissKeyboard();
      }
    },
    [dismissKeyboard, isCreateFlow],
  );

  const handleSubmit = useCallback(async () => {
    if (request == null || saving) {
      return;
    }
    const validated = validateActivityDefinition({
      schemaVersion: 1,
      name: label,
      emoji,
      fields,
    });
    if (!validated.ok) {
      Alert.alert('Invalid activity', validated.error);
      return;
    }
    setSaving(true);
    try {
      if (request.kind === 'create-first') {
        const created = await createActivity({
          emoji: validated.definition.emoji,
          label: validated.definition.name,
          fields: validated.definition.fields,
          source: 'blank',
        });
        if (created.fields.length === 0) {
          await saveActivityMoment(created);
          onSaved();
          onLoggedAndClose();
          return;
        }
        onSaved();
        requestClose();
        return;
      }
      if (request.kind === 'create') {
        await createActivity({
          emoji: validated.definition.emoji,
          label: validated.definition.name,
          fields: validated.definition.fields,
          source: 'blank',
        });
        onSaved();
        requestClose();
        return;
      }
      await updateActivity(request.activity.id, {
        emoji: validated.definition.emoji,
        label: validated.definition.name,
        fields: validated.definition.fields,
        source: request.activity.source,
        templateId: request.activity.templateId,
      });
      onSaved();
      requestClose();
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotSaveActivity,
        errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
      );
    } finally {
      setSaving(false);
    }
  }, [
    emoji,
    fields,
    label,
    onLoggedAndClose,
    onSaved,
    request,
    requestClose,
    saving,
  ]);

  const submitLabel = request?.kind === 'create-first' ? 'Save & log' : 'Save';
  const showBack = request?.kind === 'create' || request?.kind === 'edit';

  return (
    <View
      style={styles.host}
      pointerEvents={request != null ? 'box-none' : 'none'}
    >
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
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          dismissKeyboardOnClose
          keyboardAware
          enableContentPanningGesture={false}
          enablePanDownToClose
          footerPadding={0}
        >
          {request != null ? (
            <ActivityForm
              key={
                request.kind === 'edit'
                  ? String(request.activity.id)
                  : request.kind
              }
              compactFooter
              autoFocusEmoji={isCreateFlow}
              emoji={emoji}
              label={label}
              fields={fields}
              saving={saving}
              submitLabel={submitLabel}
              labelInputRef={labelInputRef}
              openEmojiRef={openEmojiRef}
              onBack={showBack ? requestClose : undefined}
              onChangeEmoji={setEmoji}
              onChangeLabel={setLabel}
              onChangeFields={setFields}
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
