import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass/GlassSurface';
import { ActivityForm } from '@/components/map/ActivityLogSheet';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import {
  createActivity,
  getActivityById,
  updateActivity,
  type ActivityRow,
} from '@/db/repositories/activities';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { ACTIVITY_SCHEMA_VERSION } from '@/lib/activities/activity-definition';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { validateActivityDefinition } from '@/lib/activities/validate-activity-definition';
import { saveActivityMoment } from '@/lib/moments/capture-activity';
import type { RootStackParamList } from '@/navigation/types';

/**
 * Full-page add / edit activity (no nav header).
 * Bottom liquid-glass: Save Activity + close — same chrome as Manage.
 */
export function ActivityFormScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ActivityForm'>>();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const params = route.params;

  const labelInputRef = useRef<TextInput>(null);
  const openEmojiRef = useRef<{ open: () => void; dismiss: () => void } | null>(
    null,
  );
  const [emoji, setEmoji] = useState('');
  const [label, setLabel] = useState('');
  const [fields, setFields] = useState<ActivityFieldDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(params.kind === 'edit');
  const [editActivity, setEditActivity] = useState<ActivityRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const canSave =
    emoji.trim().length > 0 && label.trim().length > 0 && !saving && !loading;

  const dismissKeyboard = useCallback(() => {
    labelInputRef.current?.blur();
    openEmojiRef.current?.dismiss();
    Keyboard.dismiss();
  }, []);

  const goBack = useCallback(() => {
    dismissKeyboard();
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [dismissKeyboard, navigation]);

  const popToMap = useCallback(() => {
    dismissKeyboard();
    navigation.popToTop();
  }, [dismissKeyboard, navigation]);

  const handleSubmit = useCallback(async () => {
    if (!canSave) {
      return;
    }
    const validated = validateActivityDefinition({
      schemaVersion: ACTIVITY_SCHEMA_VERSION,
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
      if (params.kind === 'create-first') {
        const created = await createActivity({
          emoji: validated.definition.emoji,
          label: validated.definition.name,
          fields: validated.definition.fields,
          source: 'blank',
        });
        if (created.fields.length === 0) {
          await saveActivityMoment(created);
          popToMap();
          return;
        }
        goBack();
        return;
      }
      if (params.kind === 'create') {
        await createActivity({
          emoji: validated.definition.emoji,
          label: validated.definition.name,
          fields: validated.definition.fields,
          source: 'blank',
        });
        goBack();
        return;
      }
      if (editActivity == null) {
        Alert.alert(
          APP_COPY.alerts.couldNotSaveActivity,
          'Activity not found.',
        );
        return;
      }
      await updateActivity(editActivity.id, {
        emoji: validated.definition.emoji,
        label: validated.definition.name,
        fields: validated.definition.fields,
        source: editActivity.source,
        templateId: editActivity.templateId,
      });
      goBack();
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotSaveActivity,
        errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
      );
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    editActivity,
    emoji,
    fields,
    goBack,
    label,
    params.kind,
    popToMap,
  ]);

  useEffect(() => {
    if (params.kind !== 'edit') {
      setEmoji('');
      setLabel('');
      setFields([]);
      setLoading(false);
      setEditActivity(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const row = await getActivityById(params.activityId);
        if (cancelled) {
          return;
        }
        if (row == null) {
          setLoadError('Activity not found.');
          setLoading(false);
          return;
        }
        setEditActivity(row);
        setEmoji(row.emoji);
        setLabel(row.label);
        setFields(row.fields);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const bottomPad = keyboardOpen
    ? 12
    : MAP_MOMENTS_BAR_HEIGHT +
      Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) +
      16;

  const saveLabel =
    params.kind === 'create-first' && fields.length === 0
      ? 'Save & log'
      : 'Save Activity';

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (loadError != null) {
    return (
      <View
        style={[
          styles.centered,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: insets.bottom,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Text style={styles.errorText}>{loadError}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.body,
          {
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: bottomPad,
          },
        ]}
      >
        <ActivityForm
          key={
            params.kind === 'edit'
              ? String(params.activityId)
              : params.kind
          }
          embedded
          hideFooter
          autoFocusEmoji={false}
          emoji={emoji}
          label={label}
          fields={fields}
          saving={saving}
          submitLabel={saveLabel}
          labelInputRef={labelInputRef as RefObject<TextInput | null>}
          openEmojiRef={openEmojiRef}
          onChangeEmoji={setEmoji}
          onChangeLabel={setLabel}
          onChangeFields={setFields}
          onKeyboardOpenChange={setKeyboardOpen}
          onSubmit={() => {
            void handleSubmit();
          }}
        />
      </View>

      {keyboardOpen ? null : (
        <View
          pointerEvents="box-none"
          style={[
            styles.barWrap,
            { paddingBottom: Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP) },
          ]}
        >
          <View style={styles.barRow}>
            <View style={styles.shadowWrap}>
              <GlassSurface style={styles.pill}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={saveLabel}
                  disabled={!canSave}
                  onPress={() => {
                    void handleSubmit();
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
                      {saveLabel}
                    </Text>
                  )}
                </Pressable>
              </GlassSurface>
            </View>

            <MapGlassCircleButton
              accessibilityLabel="Close"
              onPress={goBack}
              style={styles.closeButton}
            >
              <X size={20} color={colors.primary} strokeWidth={2.25} />
            </MapGlassCircleButton>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 15,
    color: '#FF3B30',
    textAlign: 'center',
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
    minWidth: 148,
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
});
