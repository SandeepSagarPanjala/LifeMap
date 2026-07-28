import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { ActivityFieldCameraModal } from '@/components/map/ActivityFieldCameraModal';
import {
  ActivityFieldMediaRow,
  groupActivityFields,
} from '@/components/map/ActivityFieldMediaRow';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import type { ActivityRow } from '@/db/repositories/activities';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  type ActivityFieldDefinition,
  type ActivityFieldValue,
  type ActivityValuesMap,
} from '@/lib/activities/activity-definition';
import { persistActivityImage } from '@/lib/activities/persist-activity-image';
import { extractAmountFromImage } from '@/lib/activities/text-recognize-native';
import { assertRequiredValuesFilled } from '@/lib/activities/validate-activity-definition';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { saveActivityMoment } from '@/lib/moments/capture-activity';
import { resolveMomentContentPath } from '@/lib/moments/moment-media-uri';

type ActivityLogEntryPanelProps = {
  activity: ActivityRow;
  onBack: () => void;
  onLogged: () => void | Promise<void>;
  /** Full-page layout with reliable keyboard scroll (not half sheet). */
  fullPage?: boolean;
};

type Measurable = {
  measureInWindow: (
    cb: (x: number, y: number, w: number, h: number) => void,
  ) => void;
};

/** iOS number pads have no Return key — toolbar Done dismisses them. */
const NUMERIC_KEYBOARD_ACCESSORY_ID = 'activityLogNumericDone';

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

/** Structured activity log form — prefer fullPage for keyboard reliability. */
export function ActivityLogEntryPanel({
  activity,
  onBack,
  onLogged,
  fullPage = false,
}: ActivityLogEntryPanelProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [values, setValues] = useState<ActivityValuesMap>({});
  const [saving, setSaving] = useState(false);
  const [scanningFieldId, setScanningFieldId] = useState<string | null>(null);
  const [captureField, setCaptureField] =
    useState<ActivityFieldDefinition | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const mountedRef = useRef(true);
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollYRef = useRef(0);
  const keyboardHeightRef = useRef(0);
  const lastFocusedTargetRef = useRef<Measurable | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setValues({});
    setSaving(false);
    setScanningFieldId(null);
    setCaptureField(null);
  }, [activity.id]);

  const fields = useMemo(() => activity.fields ?? [], [activity.fields]);

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
        if (!mountedRef.current) {
          return;
        }
        if (target.type === 'photo') {
          setFieldValue(target.id, { type: 'photo', uri: stored });
          return;
        }
        setFieldValue(target.id, { type: 'scan', uri: stored });
        if (target.extract === 'amount' && target.fillField) {
          const absolute = resolveMomentContentPath(stored);
          const amount = await extractAmountFromImage(absolute);
          if (!mountedRef.current) {
            return;
          }
          if (amount != null) {
            setFieldValue(target.fillField, {
              type: 'money',
              amount,
            });
          } else {
            // Clear a stale Subtotal from an earlier scan — don't leave 22.48 around.
            setFieldValue(target.fillField, undefined);
            Alert.alert(
              'Couldn’t find a total',
              'Enter the amount manually if needed.',
            );
          }
        }
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }
        Alert.alert(
          APP_COPY.alerts.couldNotSaveActivity,
          errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
        );
      } finally {
        if (mountedRef.current) {
          setScanningFieldId(current =>
            current === target.id ? null : current,
          );
        }
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
    if (saving) {
      return false;
    }
    return (
      assertRequiredValuesFilled(
        {
          schemaVersion: activity.schemaVersion,
          name: activity.label,
          emoji: activity.emoji,
          fields,
        },
        values,
      ) == null
    );
  }, [activity, fields, saving, values]);

  const handleSave = useCallback(async () => {
    if (saving) {
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
      await onLogged();
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotLogActivity,
        errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
      );
      setSaving(false);
    }
  }, [activity, fields, onLogged, saving, values]);

  const scrollFocusedIntoView = useCallback(
    (target: Measurable) => {
      if (!fullPage) {
        return;
      }
      const run = () => {
        const kb = keyboardHeightRef.current;
        if (kb <= 0) {
          return;
        }
        const keyboardTop = windowHeight - kb;
        const visibleBottom = keyboardTop - 12;
        target.measureInWindow((_tx, ty, _tw, th) => {
          const fieldBottom = ty + th;
          if (fieldBottom <= visibleBottom) {
            return;
          }
          const delta = fieldBottom - visibleBottom;
          scrollRef.current?.scrollTo({
            y: Math.max(0, scrollYRef.current + delta),
            animated: true,
          });
        });
      };
      requestAnimationFrame(() => {
        setTimeout(run, Platform.OS === 'ios' ? 300 : 120);
      });
    },
    [fullPage, windowHeight],
  );

  const handleInputFocus = useCallback(
    (event: { target?: unknown; currentTarget?: unknown }) => {
      if (!fullPage) {
        return;
      }
      const target = (event.target ?? event.currentTarget) as {
        measureInWindow?: Measurable['measureInWindow'];
      } | null;
      if (target?.measureInWindow == null) {
        return;
      }
      const measurable = target as Measurable;
      lastFocusedTargetRef.current = measurable;
      scrollFocusedIntoView(measurable);
    },
    [fullPage, scrollFocusedIntoView],
  );

  useEffect(() => {
    if (!fullPage) {
      return;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: { endCoordinates: { height: number } }) => {
      const next = event.endCoordinates.height;
      keyboardHeightRef.current = next;
      setKeyboardHeight(next);
      setKeyboardOpen(true);
      if (lastFocusedTargetRef.current != null) {
        scrollFocusedIntoView(lastFocusedTargetRef.current);
      }
    };
    const onHide = () => {
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      setKeyboardOpen(false);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [fullPage, scrollFocusedIntoView]);

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
          onFocus={handleInputFocus}
          keyboardType="decimal-pad"
          inputAccessoryViewID={
            Platform.OS === 'ios' ? NUMERIC_KEYBOARD_ACCESSORY_ID : undefined
          }
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
          onFocus={handleInputFocus}
          keyboardType="decimal-pad"
          inputAccessoryViewID={
            Platform.OS === 'ios' ? NUMERIC_KEYBOARD_ACCESSORY_ID : undefined
          }
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
          onFocus={handleInputFocus}
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          placeholder={`${field.label} of ${activity.label}`}
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
            if (!Number.isFinite(mins) || text.trim() === '' || mins <= 0) {
              setFieldValue(field.id, undefined);
              return;
            }
            setFieldValue(field.id, {
              type: 'duration',
              seconds: mins * 60,
            });
          }}
          onFocus={handleInputFocus}
          keyboardType="number-pad"
          inputAccessoryViewID={
            Platform.OS === 'ios' ? NUMERIC_KEYBOARD_ACCESSORY_ID : undefined
          }
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

  const barBottomPad = Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP);
  const contentBottomPad =
    keyboardOpen && fullPage
      ? 12 + (keyboardHeight > 0 ? Math.round(keyboardHeight * 0.2) : 24)
      : MAP_MOMENTS_BAR_HEIGHT + barBottomPad + 16;

  const showBar = !(fullPage && keyboardOpen);

  return (
    <View style={styles.panel}>
      <KeyboardAvoidingView
        style={styles.panel}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.body,
            fullPage ? styles.bodyBottom : null,
            { paddingBottom: contentBottomPad },
          ]}
          onScroll={event => {
            scrollYRef.current = event.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
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
        </ScrollView>
      </KeyboardAvoidingView>

      {showBar ? (
        <View
          pointerEvents="box-none"
          style={[styles.barWrap, { paddingBottom: barBottomPad }]}
        >
          <View style={styles.barRow}>
            <View style={styles.shadowWrap}>
              <AdaptiveGlassSurface style={styles.pill}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save activity"
                  disabled={!canSave}
                  onPress={() => {
                    void handleSave();
                  }}
                  style={[
                    styles.savePressable,
                    !canSave ? styles.savePressableDisabled : null,
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Text style={[styles.saveLabel, { color: colors.primary }]}>
                      Save
                    </Text>
                  )}
                </Pressable>
              </AdaptiveGlassSurface>
            </View>

            <MapGlassCircleButton
              accessibilityLabel="Back"
              onPress={onBack}
              style={styles.closeButton}
            >
              <X size={20} color={colors.primary} strokeWidth={2.25} />
            </MapGlassCircleButton>
          </View>
        </View>
      ) : null}

      <ActivityFieldCameraModal
        visible={captureField != null}
        fieldLabel={captureField?.label ?? ''}
        onClose={() => setCaptureField(null)}
        onUsePhoto={handleCameraUsePhoto}
      />

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={NUMERIC_KEYBOARD_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={Keyboard.dismiss}
              hitSlop={8}
              style={styles.keyboardAccessoryDone}
            >
              <Text style={styles.keyboardAccessoryDoneLabel}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}
    </View>
  );
}

/** @deprecated Prefer ActivityLogEntryScreen for structured logs. */
export function ActivityLogEntrySheet({
  activity,
  onClose,
  onLogged,
}: {
  activity: ActivityRow | null;
  onClose: () => void;
  onLogged: () => void | Promise<void>;
}) {
  if (activity == null) {
    return null;
  }
  return (
    <ActivityLogEntryPanel
      activity={activity}
      onBack={onClose}
      onLogged={onLogged}
    />
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  body: {
    gap: 12,
    paddingHorizontal: 20,
  },
  bodyBottom: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
  barWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MAP_MOMENTS_SIDE_BTN_GAP,
  },
  shadowWrap: {
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  pill: {
    height: MAP_MOMENTS_BAR_HEIGHT,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  savePressable: {
    alignItems: 'center',
    justifyContent: 'center',
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: 22,
    minWidth: 120,
  },
  savePressableDisabled: {
    opacity: 0.4,
  },
  saveLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
  keyboardAccessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#D1D5DB',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#AEAEB2',
  },
  keyboardAccessoryDone: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  keyboardAccessoryDoneLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#007AFF',
  },
});
