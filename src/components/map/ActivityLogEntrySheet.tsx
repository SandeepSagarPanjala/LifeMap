import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetTextInput as TextInput } from '@gorhom/bottom-sheet';
import { launchImageLibrary } from 'react-native-image-picker';

import { ActivityFieldCameraModal } from '@/components/map/ActivityFieldCameraModal';
import {
  ActivityFieldMediaRow,
  groupActivityFields,
} from '@/components/map/ActivityFieldMediaRow';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { Text } from '@/components/ui/text';
import type { ActivityRow } from '@/db/repositories/activities';
import {
  type ActivityFieldDefinition,
  type ActivityFieldValue,
  type ActivityValuesMap,
} from '@/lib/activities/activity-definition';
import { persistActivityImage } from '@/lib/activities/persist-activity-image';
import { extractAmountFromImage } from '@/lib/activities/text-recognize-native';
import { assertRequiredValuesFilled } from '@/lib/activities/validate-activity-definition';
import { saveActivityMoment } from '@/lib/moments/capture-activity';
import { resolveMomentContentPath } from '@/lib/moments/moment-media-uri';

type ActivityLogEntrySheetProps = {
  activity: ActivityRow | null;
  onClose: () => void;
  onLogged: () => void | Promise<void>;
};

function formatMoneyInput(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) {
    return '';
  }
  return String(amount);
}

function parseMoneyInput(text: string): number | null {
  let cleaned = text.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot >= 0) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, '');
  }
  if (!cleaned || cleaned === '.') {
    return null;
  }
  const value = Number(cleaned);
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

export function ActivityLogEntrySheet({
  activity,
  onClose,
  onLogged,
}: ActivityLogEntrySheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [values, setValues] = useState<ActivityValuesMap>({});
  const [saving, setSaving] = useState(false);
  const [scanningFieldId, setScanningFieldId] = useState<string | null>(null);
  const [captureField, setCaptureField] =
    useState<ActivityFieldDefinition | null>(null);

  useEffect(() => {
    setValues({});
    setSaving(false);
    setScanningFieldId(null);
    setCaptureField(null);
  }, [activity?.id]);

  const fields = useMemo(() => activity?.fields ?? [], [activity?.fields]);

  const setFieldValue = useCallback(
    (fieldId: string, value: ActivityFieldValue | undefined) => {
      setValues(prev => {
        const next = { ...prev };
        if (value == null) {
          delete next[fieldId];
        } else {
          next[fieldId] = value;
        }
        return next;
      });
    },
    [],
  );

  const applyImageToField = useCallback(
    async (target: ActivityFieldDefinition, uri: string) => {
      setScanningFieldId(target.id);
      try {
        const stored = await persistActivityImage(uri);
        if (target.type === 'photo') {
          setFieldValue(target.id, { type: 'photo', uri: stored });
          return;
        }
        setFieldValue(target.id, { type: 'scan', uri: stored });
        if (target.extract === 'amount' && target.fillField) {
          const absolute = resolveMomentContentPath(stored);
          const amount = await extractAmountFromImage(absolute);
          if (amount != null) {
            setFieldValue(target.fillField, {
              type: 'money',
              amount,
            });
          } else {
            Alert.alert(
              'Couldn’t find a total',
              'Enter the amount manually if needed.',
            );
          }
        }
      } catch (error) {
        Alert.alert(
          APP_COPY.alerts.couldNotSaveActivity,
          errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
        );
      } finally {
        setScanningFieldId(null);
      }
    },
    [setFieldValue],
  );

  const handleOpenCamera = useCallback((field: ActivityFieldDefinition) => {
    setCaptureField(field);
  }, []);

  const handleOpenLibrary = useCallback(
    async (field: ActivityFieldDefinition) => {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.9,
        selectionLimit: 1,
      });
      if (result.didCancel || result.errorCode) {
        return;
      }
      const uri = result.assets?.[0]?.uri?.trim();
      if (uri == null) {
        return;
      }
      await applyImageToField(field, uri);
    },
    [applyImageToField],
  );

  const handleCameraUsePhoto = useCallback(
    (uri: string) => {
      if (captureField == null) {
        return;
      }
      void applyImageToField(captureField, uri);
      setCaptureField(null);
    },
    [applyImageToField, captureField],
  );

  const fieldGroups = useMemo(() => groupActivityFields(fields), [fields]);

  const canSave = useMemo(() => {
    if (activity == null || saving) {
      return false;
    }
    return assertRequiredValuesFilled(
      {
        schemaVersion: activity.schemaVersion,
        name: activity.label,
        emoji: activity.emoji,
        fields,
      },
      values,
    ) == null;
  }, [activity, fields, saving, values]);

  const handleSave = useCallback(async () => {
    if (activity == null || saving) {
      return;
    }
    const requiredError = assertRequiredValuesFilled(
      {
        schemaVersion: activity.schemaVersion,
        name: activity.label,
        emoji: activity.emoji,
        fields,
      },
      values,
    );
    if (requiredError) {
      Alert.alert('Missing required fields', requiredError);
      return;
    }
    setSaving(true);
    try {
      await saveActivityMoment(activity, values);
      // Parent may close the capture screen (unmounting this sheet). Avoid
      // dismiss/setState after a successful log that navigates away.
      await onLogged();
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotLogActivity,
        errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
      );
      setSaving(false);
    }
  }, [activity, fields, onLogged, saving, values]);

  const handleDismissed = useCallback(() => {
    onClose();
  }, [onClose]);

  const renderField = (field: ActivityFieldDefinition) => (
    <View key={field.id} style={styles.fieldBlock}>
      {field.type !== 'photo' && field.type !== 'scan' ? (
        <Text style={styles.fieldLabel}>
          {field.label}
          {field.required ? ' *' : ''}
        </Text>
      ) : null}

      {field.type === 'money' ? (
        <TextInput
          value={(() => {
            const current = values[field.id];
            return current?.type === 'money'
              ? formatMoneyInput(current.amount)
              : '';
          })()}
          onChangeText={text => {
            const amount = parseMoneyInput(text);
            setFieldValue(
              field.id,
              amount == null ? undefined : { type: 'money', amount },
            );
          }}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor="#8E8E93"
          style={styles.input}
        />
      ) : null}

      {field.type === 'number' ? (
        <TextInput
          value={(() => {
            const current = values[field.id];
            return current?.type === 'number' ? String(current.value) : '';
          })()}
          onChangeText={text => {
            const cleaned = text.replace(/[^0-9.]/g, '');
            if (!cleaned) {
              setFieldValue(field.id, undefined);
              return;
            }
            const value = Number(cleaned);
            if (!Number.isFinite(value)) {
              return;
            }
            setFieldValue(field.id, { type: 'number', value });
          }}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor="#8E8E93"
          style={styles.input}
        />
      ) : null}

      {field.type === 'text' ? (
        <TextInput
          value={(() => {
            const current = values[field.id];
            return current?.type === 'text' ? current.value : '';
          })()}
          onChangeText={text =>
            setFieldValue(
              field.id,
              text.trim() ? { type: 'text', value: text } : undefined,
            )
          }
          maxLength={120}
          placeholder="Optional note"
          placeholderTextColor="#8E8E93"
          style={styles.input}
        />
      ) : null}

      {field.type === 'choice' ? (
        <View style={styles.chipRow}>
          {(field.options ?? []).map(option => {
            const current = values[field.id];
            const selected =
              current?.type === 'choice' && current.value === option;
            return (
              <Pressable
                key={option}
                onPress={() =>
                  setFieldValue(field.id, { type: 'choice', value: option })
                }
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text
                  style={[
                    styles.chipLabel,
                    selected ? styles.chipLabelSelected : null,
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {field.type === 'duration' ? (
        <TextInput
          value={(() => {
            const current = values[field.id];
            return current?.type === 'duration'
              ? String(Math.round(current.seconds / 60))
              : '';
          })()}
          onChangeText={text => {
            const mins = Number(text.replace(/[^0-9]/g, ''));
            if (!Number.isFinite(mins) || text.trim() === '') {
              setFieldValue(field.id, undefined);
              return;
            }
            setFieldValue(field.id, {
              type: 'duration',
              seconds: mins * 60,
            });
          }}
          keyboardType="number-pad"
          placeholder="Minutes"
          placeholderTextColor="#8E8E93"
          style={styles.input}
        />
      ) : null}

      {field.type === 'toggle' ? (
        <Switch
          value={(() => {
            const current = values[field.id];
            return current?.type === 'toggle' ? current.value : false;
          })()}
          onValueChange={value =>
            setFieldValue(field.id, { type: 'toggle', value })
          }
        />
      ) : null}
    </View>
  );

  return (
    <View
      style={styles.host}
      pointerEvents={activity != null ? 'box-none' : 'none'}
    >
      <BottomSheetModalProvider>
        <AppBottomSheet
          name="activity-log-entry"
          visible={activity != null}
          bottomSheetRef={sheetRef}
          onClose={handleDismissed}
          instantPresent
          stackBehavior="push"
          enableDynamicSizing
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          dismissKeyboardOnClose
          footerPadding={12}
        >
          {activity != null ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.body}
            >
              <Text variant="h4" className="border-0 pb-0">
                {activity.emoji} {activity.label}
              </Text>
              <Text variant="muted" className="mt-1 text-sm">
                Fill in the details, then save.
              </Text>

              {fieldGroups.map(group =>
                group.kind === 'media' ? (
                  <ActivityFieldMediaRow
                    key={group.fields.map(field => field.id).join('-')}
                    fields={group.fields}
                    values={values}
                    scanningFieldId={scanningFieldId}
                    onOpenCamera={handleOpenCamera}
                    onOpenLibrary={field => void handleOpenLibrary(field)}
                    onRemoveImage={field => setFieldValue(field.id, undefined)}
                  />
                ) : (
                  renderField(group.field)
                ),
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save activity"
                disabled={!canSave}
                onPress={() => void handleSave()}
                style={[
                  styles.saveButton,
                  !canSave ? styles.saveButtonDisabled : null,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonLabel}>Save</Text>
                )}
              </Pressable>
            </ScrollView>
          ) : null}
        </AppBottomSheet>
      </BottomSheetModalProvider>

      <ActivityFieldCameraModal
        visible={captureField != null}
        fieldLabel={captureField?.label ?? ''}
        onClose={() => setCaptureField(null)}
        onUsePhoto={handleCameraUsePhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 11,
    elevation: 11,
  },
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1C1C1E',
    backgroundColor: '#FFFFFF',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
  },
  chipSelected: {
    backgroundColor: '#DCFCE7',
  },
  chipLabel: {
    fontSize: 14,
    color: '#3A3A3C',
  },
  chipLabelSelected: {
    color: '#166534',
    fontWeight: '600',
  },
  saveButton: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: '#34C759',
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
