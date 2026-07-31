import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import { Alert, Keyboard, StyleSheet, View } from 'react-native';
import {
  BottomSheetModalProvider,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

import { ActivityForm } from '@/components/map/ActivityLogSheet';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import {
  createActivity,
  updateActivity,
  type ActivityRow,
} from '@/db/repositories/activities';
import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { ACTIVITY_SCHEMA_VERSION } from '@/lib/activities/activity-definition';
import {
  DEFAULT_ACTIVITY_INTENT,
  type ActivityIntent,
} from '@/lib/activities/activity-intent';
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
  /** create-first with no fields: save, log, then close manage too. */
  onLoggedAndClose?: () => void;
};

/**
 * Gorhom add / edit activity sheet.
 * Save is a top-right check — no bottom footer fighting the keyboard.
 */
export function ActivityFormSheet({
  request,
  onClose,
  onSaved,
  onLoggedAndClose,
}: ActivityFormSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const scrollRef =
    useRef<ComponentRef<typeof BottomSheetScrollView> | null>(null);
  const labelInputRef =
    useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  const openEmojiRef = useRef<{ open: () => void; dismiss: () => void } | null>(
    null,
  );
  const [emoji, setEmoji] = useState('');
  const [label, setLabel] = useState('');
  const [intent, setIntent] = useState<ActivityIntent>(DEFAULT_ACTIVITY_INTENT);
  const [fields, setFields] = useState<ActivityFieldDefinition[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (request?.kind === 'edit') {
      setEmoji(request.activity.emoji);
      setLabel(request.activity.label);
      setIntent(request.activity.intent);
      setFields(request.activity.fields);
    } else if (request != null) {
      setEmoji('');
      setLabel('');
      setIntent(DEFAULT_ACTIVITY_INTENT);
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
    const fieldsForSave =
      request.kind === 'edit' && request.activity.source === 'healthkit'
        ? request.activity.fields
        : fields;
    const validated = validateActivityDefinition({
      schemaVersion: ACTIVITY_SCHEMA_VERSION,
      name: label,
      emoji,
      fields: fieldsForSave,
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
          intent,
        });
        if (created.fields.length === 0) {
          await saveActivityMoment(created);
          onSaved();
          onLoggedAndClose?.();
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
          intent,
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
        intent,
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
    intent,
    label,
    onLoggedAndClose,
    onSaved,
    request,
    requestClose,
    saving,
  ]);

  const submitLabel =
    request?.kind === 'create-first' && fields.length === 0
      ? 'Save & log'
      : 'Save';
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
          snapPoints={['92%']}
          enableDynamicSizing={false}
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          dismissKeyboardOnClose
          enableContentPanningGesture={false}
          enablePanDownToClose
          scrollable
          scrollRef={scrollRef}
          footerPadding={24}
        >
          {request != null ? (
            <ActivityForm
              key={
                request.kind === 'edit'
                  ? String(request.activity.id)
                  : request.kind
              }
              sheetInputs
              hideFooter
              headerSave
              sheetScrollRef={scrollRef}
              autoFocusEmoji={isCreateFlow}
              emoji={emoji}
              label={label}
              intent={intent}
              fields={fields}
              saving={saving}
              submitLabel={submitLabel}
              labelInputRef={
                labelInputRef as RefObject<ComponentRef<
                  typeof BottomSheetTextInput
                > | null>
              }
              openEmojiRef={openEmojiRef}
              onBack={showBack ? requestClose : undefined}
              onChangeEmoji={setEmoji}
              onChangeLabel={setLabel}
              onChangeIntent={setIntent}
              onChangeFields={setFields}
              lockFields={
                request.kind === 'edit' &&
                request.activity.source === 'healthkit'
              }
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
    zIndex: 20,
    elevation: 20,
  },
});
