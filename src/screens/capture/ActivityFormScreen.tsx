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
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityReminderSheet } from '@/components/capture/ActivityReminderSheet';
import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { ActivityForm } from '@/components/map/ActivityLogSheet';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import {
  createActivity,
  getActivityById,
  updateActivity,
  updateActivityReminder,
  type ActivityRow,
} from '@/db/repositories/activities';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { ACTIVITY_SCHEMA_VERSION } from '@/lib/activities/activity-definition';
import {
  DEFAULT_ACTIVITY_INTENT,
  type ActivityIntent,
} from '@/lib/activities/activity-intent';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { validateActivityDefinition } from '@/lib/activities/validate-activity-definition';
import { saveActivityMoment } from '@/lib/moments/capture-activity';
import { formatActivityReminderSummary } from '@/lib/activities/activity-tile-style';
import {
  canEnableActivityReminder,
  reminderConfigFromRow,
  syncActivityReminderSchedule,
} from '@/lib/notifications/activity-reminders';
import { ensureNotificationPermission } from '@/lib/notifications/permissions';
import {
  getActivityNotificationsEnabled,
  getNotificationsMasterEnabled,
} from '@/lib/notifications/settings';
import {
  defaultReminderConfig,
  MAX_ACTIVITY_REMINDERS,
  type ActivityReminderConfig,
} from '@/lib/notifications/types';
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
  const [intent, setIntent] = useState<ActivityIntent>(DEFAULT_ACTIVITY_INTENT);
  const [fields, setFields] = useState<ActivityFieldDefinition[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(params.kind === 'edit');
  const [editActivity, setEditActivity] = useState<ActivityRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [reminderConfig, setReminderConfig] = useState<ActivityReminderConfig>(
    () => defaultReminderConfig(),
  );
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);

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

  const persistReminder = useCallback(
    async (activityId: number, config: ActivityReminderConfig) => {
      await updateActivityReminder(activityId, {
        reminderEnabled: config.enabled,
        reminderRepeat: config.repeat,
        reminderTimeMinutes: config.timeMinutes,
        reminderWeekday: config.weekday,
        reminderDayOfMonth: config.dayOfMonth,
        reminderAnchorAt: config.anchorAt,
        reminderSound: config.sound,
      });
      await syncActivityReminderSchedule(activityId);
    },
    [],
  );

  const handleNotifyToggle = useCallback(
    async (next: boolean) => {
      if (!next) {
        const cleared = { ...reminderConfig, enabled: false };
        setReminderConfig(cleared);
        if (editActivity != null) {
          await persistReminder(editActivity.id, cleared);
        }
        return;
      }

      const master = await getNotificationsMasterEnabled();
      const activityMaster = await getActivityNotificationsEnabled();
      if (!master || !activityMaster) {
        Alert.alert(
          'Notifications off',
          'Turn on Notifications and Activity notifications in Settings first.',
        );
        return;
      }

      const permitted = await ensureNotificationPermission();
      if (!permitted) {
        Alert.alert(
          'Permission needed',
          'Enable notifications for LifeMap in system Settings.',
        );
        return;
      }

      const allowed = await canEnableActivityReminder(editActivity?.id);
      if (!allowed) {
        Alert.alert(
          'Limit reached',
          `Only ${MAX_ACTIVITY_REMINDERS} active notifications are allowed.`,
        );
        return;
      }

      setReminderSheetOpen(true);
    },
    [editActivity, persistReminder, reminderConfig],
  );

  const handleReminderSave = useCallback(
    async (config: ActivityReminderConfig) => {
      setReminderSheetOpen(false);
      setReminderConfig(config);
      if (editActivity != null) {
        try {
          await persistReminder(editActivity.id, config);
        } catch (error) {
          Alert.alert(
            APP_COPY.alerts.couldNotSaveActivity,
            errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
          );
        }
      }
    },
    [editActivity, persistReminder],
  );

  const handleSubmit = useCallback(async () => {
    if (!canSave) {
      return;
    }
    const fieldsForSave =
      editActivity?.source === 'healthkit'
        ? editActivity.fields
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
      if (params.kind === 'create-first') {
        const created = await createActivity({
          emoji: validated.definition.emoji,
          label: validated.definition.name,
          fields: validated.definition.fields,
          source: 'blank',
          intent,
        });
        if (reminderConfig.enabled) {
          await persistReminder(created.id, reminderConfig);
        }
        if (created.fields.length === 0) {
          await saveActivityMoment(created);
          popToMap();
          return;
        }
        goBack();
        return;
      }
      if (params.kind === 'create') {
        const created = await createActivity({
          emoji: validated.definition.emoji,
          label: validated.definition.name,
          fields: validated.definition.fields,
          source: 'blank',
          intent,
        });
        if (reminderConfig.enabled) {
          await persistReminder(created.id, reminderConfig);
        }
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
        intent,
      });
      await persistReminder(editActivity.id, reminderConfig);
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
    intent,
    label,
    params.kind,
    persistReminder,
    popToMap,
    reminderConfig,
  ]);

  useEffect(() => {
    if (params.kind !== 'edit') {
      setEmoji('');
      setLabel('');
      setIntent(DEFAULT_ACTIVITY_INTENT);
      setFields([]);
      setLoading(false);
      setEditActivity(null);
      setLoadError(null);
      setReminderConfig(defaultReminderConfig());
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
        setIntent(row.intent);
        setFields(row.fields);
        setReminderConfig(reminderConfigFromRow(row));
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

  const notifyBelowLabel = (
    <View style={styles.notifyBlock}>
      <View style={styles.notifyRow}>
        <View style={styles.notifyTextCol}>
          <Text style={[styles.notifyLabel, { color: colors.foreground }]}>
            Notify me
          </Text>
          {reminderConfig.enabled ? (
            <Text
              style={[styles.notifySummary, { color: colors.mutedForeground }]}
            >
              {formatActivityReminderSummary(reminderConfig)}
            </Text>
          ) : (
            <Text
              style={[styles.notifySummary, { color: colors.mutedForeground }]}
            >
              Off
            </Text>
          )}
        </View>
        <Switch
          value={reminderConfig.enabled}
          onValueChange={value => {
            void handleNotifyToggle(value);
          }}
          trackColor={{ false: '#E5E5EA', true: colors.primary }}
        />
      </View>
      {reminderConfig.enabled ? (
        <GlassPressable
          accessibilityLabel="Edit reminder"
          onPress={() => setReminderSheetOpen(true)}
          style={styles.editReminderBtn}
        >
          <Text style={[styles.editReminderText, { color: colors.primary }]}>
            Edit schedule
          </Text>
        </GlassPressable>
      ) : null}
    </View>
  );

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
            params.kind === 'edit' ? String(params.activityId) : params.kind
          }
          embedded
          hideFooter
          autoFocusEmoji={false}
          emoji={emoji}
          label={label}
          intent={intent}
          fields={fields}
          saving={saving}
          submitLabel={saveLabel}
          labelInputRef={labelInputRef as RefObject<TextInput | null>}
          openEmojiRef={openEmojiRef}
          belowLabel={notifyBelowLabel}
          lockFields={editActivity?.source === 'healthkit'}
          onChangeEmoji={setEmoji}
          onChangeLabel={setLabel}
          onChangeIntent={setIntent}
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
            <GlassPressable
              accessibilityLabel={saveLabel}
              disabled={!canSave}
              onPress={() => {
                void handleSubmit();
              }}
              style={styles.shadowWrap}
            >
              <AdaptiveGlassSurface style={styles.pill}>
                <View
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
                </View>
              </AdaptiveGlassSurface>
            </GlassPressable>

            <MapGlassCircleButton
              accessibilityLabel="Back"
              onPress={goBack}
              style={styles.closeButton}
            >
              <ChevronLeft size={22} color={colors.primary} strokeWidth={2.25} />
            </MapGlassCircleButton>
          </View>
        </View>
      )}

      <ActivityReminderSheet
        visible={reminderSheetOpen}
        initial={reminderConfig}
        activityLabel={label.trim() || 'Activity'}
        onCancel={() => setReminderSheetOpen(false)}
        onSave={config => {
          void handleReminderSave(config);
        }}
      />
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
  notifyBlock: {
    marginTop: 16,
    marginBottom: 8,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notifyTextCol: {
    flex: 1,
  },
  notifyLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  notifySummary: {
    marginTop: 2,
    fontSize: 13,
  },
  editReminderBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  editReminderText: {
    fontSize: 15,
    fontWeight: '500',
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
  shadowWrap: {},
  pill: {
    borderRadius: 999,
    overflow: 'hidden',
  },
  savePressable: {
    minWidth: 160,
    minHeight: MAP_STACK_BUTTON_SIZE,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePressableDisabled: {
    opacity: 0.45,
  },
  saveLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {},
});
