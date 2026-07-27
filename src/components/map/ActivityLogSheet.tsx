import {
  memo,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from 'react';
import { APP_COPY, errorMessageOr } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import DraggableFlatList, {
  NestableScrollContainer,
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { ChevronLeft, Download, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SystemEmojiPicker,
  useEmojiKeyboard,
} from 'react-native-system-emoji-picker';

import { ActivityFieldsEditor } from '@/components/map/ActivityFieldsEditor';
import type { ActivityFieldsEditorHandle } from '@/components/map/ActivityFieldsEditor';
import { Text } from '@/components/ui/text';
import { BOTTOM_SHEET_SURFACE } from '@/lib/app-constants';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  archiveActivity,
  listActiveActivities,
  reorderActivities,
  type ActivityRow,
} from '@/db/repositories/activities';
import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { saveActivityMoment } from '@/lib/moments/capture-activity';

const GRID_COLUMNS = 4;
const GRID_GAP = 12;
const ACTIVITY_TINT = '#F0FDF4';
const EMOJI_PLACEHOLDER = '❓';
const LOG_SHEET_SNAP_RATIO = 0.5;
const LOG_SHEET_HANDLE_HEIGHT = 24;

type SheetMode = 'log' | 'manage';

type ActivityEmojiPickerHandle = {
  open: () => void;
};

const ActivityEmojiPicker = forwardRef<
  ActivityEmojiPickerHandle,
  {
    emoji: string;
    onChangeEmoji: (value: string) => void;
    /** Keep keyboard up and hand off to the label field instead of dismissing first. */
    swapKeyboardOnPick?: boolean;
    onEmojiPicked?: () => void;
  }
>(function ActivityEmojiPicker(
  { emoji, onChangeEmoji, swapKeyboardOnPick = false, onEmojiPicked },
  ref,
) {
  const emojiKeyboard = useEmojiKeyboard();
  const emojiKeyboardRef = useRef(emojiKeyboard);
  emojiKeyboardRef.current = emojiKeyboard;
  const openPickerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (openPickerTimerRef.current != null) {
        clearTimeout(openPickerTimerRef.current);
        openPickerTimerRef.current = null;
      }
      emojiKeyboardRef.current.dismiss();
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      open: () => {
        emojiKeyboardRef.current.open();
      },
    }),
    [],
  );

  const openPicker = useCallback(() => {
    if (!swapKeyboardOnPick) {
      Keyboard.dismiss();
    }
    if (openPickerTimerRef.current != null) {
      clearTimeout(openPickerTimerRef.current);
    }
    const delay =
      !swapKeyboardOnPick && Platform.OS === 'ios' ? 80 : 0;
    openPickerTimerRef.current = setTimeout(() => {
      openPickerTimerRef.current = null;
      emojiKeyboardRef.current.open();
    }, delay);
  }, [swapKeyboardOnPick]);

  const handleEmojiSelected = useCallback(
    (value: string) => {
      onChangeEmoji(value);
      // Always dismiss the emoji keyboard; create flow then focuses Label.
      emojiKeyboardRef.current.dismiss();
      onEmojiPicked?.();
    },
    [onChangeEmoji, onEmojiPicked],
  );

  return (
    <View style={styles.emojiPickerWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          emoji && emoji !== EMOJI_PLACEHOLDER
            ? `Change emoji, currently ${emoji}`
            : 'Select emoji'
        }
        onPress={openPicker}
        style={styles.emojiOrbPressable}
      >
        <View style={[styles.emojiOrb, { backgroundColor: ACTIVITY_TINT }]}>
          <Text
            style={[
              styles.emojiOrbText,
              !emoji || emoji === EMOJI_PLACEHOLDER
                ? styles.emojiOrbPlaceholder
                : null,
            ]}
          >
            {emoji || EMOJI_PLACEHOLDER}
          </Text>
        </View>
        {!emoji || emoji === EMOJI_PLACEHOLDER ? (
          <Text style={styles.selectEmojiHint}>Select emoji</Text>
        ) : null}
      </Pressable>
      <SystemEmojiPicker
        ref={emojiKeyboard.ref}
        onEmojiSelected={handleEmojiSelected}
        autoHideAfterSelection={!swapKeyboardOnPick}
        dismissOnTapOutside
        keyboardAppearance="light"
      />
    </View>
  );
});

function ActivityManageList({
  activities,
  onReorder,
  onBeginEdit,
  onArchive,
}: {
  activities: ActivityRow[];
  onReorder: (data: ActivityRow[]) => void;
  onBeginEdit: (activity: ActivityRow) => void;
  onArchive: (activity: ActivityRow) => void;
}) {
  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ActivityRow>) => (
      <ScaleDecorator activeScale={1.02}>
        <View
          style={[styles.manageRow, isActive ? styles.manageRowDragging : null]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reorder ${item.label}`}
            onLongPress={drag}
            delayLongPress={120}
            style={styles.dragHandle}
          >
            <GripVertical size={18} color="#8E8E93" strokeWidth={2.25} />
          </Pressable>
          <View style={styles.manageRowMain}>
            <View
              style={[
                styles.manageEmojiOrb,
                { backgroundColor: ACTIVITY_TINT },
              ]}
            >
              <Text style={styles.manageEmoji}>{item.emoji}</Text>
            </View>
            <Text style={styles.manageLabel} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
          <View style={styles.manageActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit ${item.label}`}
              onPress={() => onBeginEdit(item)}
              hitSlop={8}
              style={styles.iconAction}
            >
              <Pencil size={16} color="#3A3A3C" strokeWidth={2.25} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.label}`}
              onPress={() => onArchive(item)}
              style={styles.iconAction}
            >
              <Trash2 size={16} color="#FF3B30" strokeWidth={2.25} />
            </Pressable>
          </View>
        </View>
      </ScaleDecorator>
    ),
    [onArchive, onBeginEdit],
  );

  return (
    <DraggableFlatList
      data={activities}
      keyExtractor={item => String(item.id)}
      activationDistance={12}
      onDragEnd={({ data }) => onReorder(data)}
      renderItem={renderItem}
      containerStyle={styles.manageList}
      contentContainerStyle={styles.manageListContent}
      showsVerticalScrollIndicator={false}
    />
  );
}

type ActivityLogSheetProps = {
  visible: boolean;
  onClose: () => void;
  onLogged: () => void | Promise<void>;
  onBeginCreateFirst: () => void;
  onBeginCreate: () => void;
  onBeginEdit: (activity: ActivityRow) => void;
  onBeginStructuredLog: (activity: ActivityRow) => void;
  onBeginCatalog: () => void;
  reloadNonce?: number;
};

const ActivityPickerCell = memo(function ActivityPickerCell({
  activity,
  onPress,
}: {
  activity: ActivityRow;
  onPress: (activity: ActivityRow) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(activity);
  }, [activity, onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log ${activity.label}`}
      onPress={handlePress}
      style={styles.tokenCell}
    >
      <View style={styles.tokenStickerWrap}>
        <View style={[styles.tokenSticker, { backgroundColor: ACTIVITY_TINT }]}>
          <Text style={styles.tokenEmoji}>{activity.emoji}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.tokenLabel}>
        {activity.label}
      </Text>
    </Pressable>
  );
});

export function ActivityForm({
  emoji,
  label,
  fields,
  saving,
  submitLabel,
  onChangeEmoji,
  onChangeLabel,
  onChangeFields,
  onSubmit,
  onBack,
  compactFooter = false,
  autoFocusEmoji = false,
  labelInputRef,
  openEmojiRef,
}: {
  emoji: string;
  label: string;
  fields: ActivityFieldDefinition[];
  saving: boolean;
  submitLabel: string;
  onChangeEmoji: (value: string) => void;
  onChangeLabel: (value: string) => void;
  onChangeFields: (fields: ActivityFieldDefinition[]) => void;
  onSubmit: () => void;
  onBack?: () => void;
  compactFooter?: boolean;
  autoFocusEmoji?: boolean;
  labelInputRef?: RefObject<ComponentRef<typeof BottomSheetTextInput> | null>;
  openEmojiRef?: RefObject<ActivityEmojiPickerHandle | null>;
}) {
  const canSave = emoji.trim().length > 0 && label.trim().length > 0 && !saving;
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardSwapRef = useRef(false);
  const fieldsEditorRef = useRef<ActivityFieldsEditorHandle>(null);

  const handleBack = useCallback(() => {
    if (fieldsEditorRef.current?.dismissNested()) {
      return;
    }
    onBack?.();
  }, [onBack]);

  const handleEmojiPicked = useCallback(() => {
    if (!autoFocusEmoji) {
      return;
    }
    keyboardSwapRef.current = true;
    labelInputRef?.current?.focus();
  }, [autoFocusEmoji, labelInputRef]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: { endCoordinates: { height: number } }) => {
      keyboardSwapRef.current = false;
      setKeyboardHeight(event.endCoordinates.height);
    };
    const onHide = () => {
      if (keyboardSwapRef.current) {
        return;
      }
      setKeyboardHeight(0);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Keep the form in the visible area above the keyboard (sticky Save stays put).
  const sheetMaxHeight = Math.round(
    keyboardHeight > 0
      ? Math.max(300, windowHeight - keyboardHeight - 12)
      : windowHeight * 0.88,
  );

  return (
    <View style={[styles.formShell, { maxHeight: sheetMaxHeight }]}>
      <NestableScrollContainer
        style={styles.formScroll}
        contentContainerStyle={styles.formScrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formHeader}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={handleBack}
              style={styles.backRow}
            >
              <ChevronLeft size={20} color="#1C1C1E" strokeWidth={2.25} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.formFields}>
          <ActivityEmojiPicker
            ref={openEmojiRef}
            emoji={emoji}
            onChangeEmoji={onChangeEmoji}
            swapKeyboardOnPick={autoFocusEmoji}
            onEmojiPicked={handleEmojiPicked}
          />
          <Text style={styles.fieldLabel}>Label</Text>
          <BottomSheetTextInput
            ref={labelInputRef}
            value={label}
            onChangeText={onChangeLabel}
            placeholder="Gym"
            placeholderTextColor="#8E8E93"
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canSave) {
                onSubmit();
              }
            }}
          />
          <ActivityFieldsEditor
            ref={fieldsEditorRef}
            fields={fields}
            onChangeFields={onChangeFields}
          />
        </View>
      </NestableScrollContainer>

      <View
        style={[
          styles.saveFooter,
          {
            paddingBottom: Math.max(
              insets.bottom,
              compactFooter ? 4 : 12,
            ),
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={submitLabel}
          disabled={!canSave}
          onPress={onSubmit}
          style={[
            styles.primaryButton,
            styles.primaryButtonSticky,
            !canSave ? styles.primaryButtonDisabled : null,
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryButtonLabel}>{submitLabel}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function ActivityLogSheet({
  visible,
  onClose,
  onLogged,
  onBeginCreateFirst,
  onBeginCreate,
  onBeginEdit,
  onBeginStructuredLog,
  onBeginCatalog,
  reloadNonce = 0,
}: ActivityLogSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cellWidth =
    (windowWidth - 40 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const logStepHeight =
    windowHeight * LOG_SHEET_SNAP_RATIO -
    LOG_SHEET_HANDLE_HEIGHT -
    Math.max(insets.bottom, 16) -
    4;

  const [mode, setMode] = useState<SheetMode>('log');
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loggingId, setLoggingId] = useState<number | null>(null);

  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listActiveActivities();
      setActivities(rows);
      return rows;
    } finally {
      setLoading(false);
    }
  }, []);

  const onBeginCreateFirstRef = useRef(onBeginCreateFirst);
  onBeginCreateFirstRef.current = onBeginCreateFirst;

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const rows = await loadActivities();
      if (cancelled) {
        return;
      }
      if (rows.length === 0) {
        onBeginCreateFirstRef.current();
        setMode('manage');
      } else {
        setMode('log');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadActivities, visible]);

  useEffect(() => {
    if (reloadNonce === 0) {
      return;
    }
    void loadActivities();
  }, [loadActivities, reloadNonce]);

  const handleClose = () => {
    setMode('log');
    onClose();
  };

  const handleLogActivity = useCallback(
    async (activity: ActivityRow) => {
      if (loggingId != null) {
        return;
      }
      if (activity.fields.length > 0) {
        onBeginStructuredLog(activity);
        return;
      }
      setLoggingId(activity.id);
      try {
        await saveActivityMoment(activity);
        await onLogged();
        setMode('log');
        onClose();
      } catch (error) {
        Alert.alert(
          APP_COPY.alerts.couldNotLogActivity,
          errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
        );
      } finally {
        setLoggingId(null);
      }
    },
    [loggingId, onBeginStructuredLog, onClose, onLogged],
  );

  const renderActivityCell = useCallback<ListRenderItem<ActivityRow>>(
    ({ item }) => (
      <View style={{ width: cellWidth }}>
        <ActivityPickerCell activity={item} onPress={handleLogActivity} />
      </View>
    ),
    [cellWidth, handleLogActivity],
  );

  const activityKeyExtractor = useCallback(
    (item: ActivityRow) => String(item.id),
    [],
  );

  const handleReorderActivities = useCallback(
    async (data: ActivityRow[]) => {
      setActivities(data);
      try {
        await reorderActivities(data.map(row => row.id));
      } catch {
        await loadActivities();
        Alert.alert(
          APP_COPY.common.couldNotReorder,
          APP_COPY.common.pleaseTryAgain,
        );
      }
    },
    [loadActivities],
  );

  const confirmArchive = (activity: ActivityRow) => {
    Alert.alert(
      `Remove ${activity.label}?`,
      'Past logs keep their emoji and label. You can add it again later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await archiveActivity(activity.id);
              const rows = await loadActivities();
              if (rows.length === 0) {
                onBeginCreateFirst();
                setMode('manage');
              }
              setActivities(rows);
            })();
          },
        },
      ],
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <View
      style={[
        styles.sheetBodyEmbedded,
        {
          paddingBottom: mode === 'log' ? 0 : Math.max(insets.bottom, 16),
        },
      ]}
    >
      {mode === 'log' ? (
        <View style={[styles.stepBody, { height: logStepHeight }]}>
          <View style={styles.stepHeader}>
            <Text variant="h4" className="border-0 pb-0" style={styles.stepTitle}>
              What did you do?
            </Text>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit activities"
                onPress={() => setMode('manage')}
                hitSlop={4}
                style={[
                  styles.headerAction,
                  { backgroundColor: ACTIVITY_TINT },
                ]}
              >
                <Pencil size={15} color={colors.primary} strokeWidth={2.25} />
                <Text style={[styles.headerActionLabel, { color: colors.primary }]}>
                  Edit
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add activity"
                onPress={onBeginCreate}
                hitSlop={4}
                style={[
                  styles.headerAction,
                  { backgroundColor: ACTIVITY_TINT },
                ]}
              >
                <Plus size={16} color={colors.primary} strokeWidth={2.5} />
                <Text style={[styles.headerActionLabel, { color: colors.primary }]}>
                  Add
                </Text>
              </Pressable>
            </View>
          </View>
          {loading ? (
            <View style={styles.loadingBody}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={activities}
              keyExtractor={activityKeyExtractor}
              numColumns={GRID_COLUMNS}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              style={styles.grid}
              renderItem={renderActivityCell}
            />
          )}
        </View>
      ) : null}

      {mode === 'manage' ? (
        <View style={styles.manageBody}>
          <View style={styles.manageHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to activity picker"
              onPress={() => {
                if (activities.length === 0) {
                  handleClose();
                  return;
                }
                setMode('log');
              }}
              style={styles.backRow}
            >
              <ChevronLeft size={20} color="#1C1C1E" strokeWidth={2.25} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
            <View style={styles.manageHeaderActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Install activity templates"
                onPress={onBeginCatalog}
                hitSlop={4}
                style={[
                  styles.headerAction,
                  { backgroundColor: ACTIVITY_TINT },
                ]}
              >
                <Download size={15} color={colors.primary} strokeWidth={2.25} />
                <Text
                  style={[styles.headerActionLabel, { color: colors.primary }]}
                >
                  Templates
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add activity"
                onPress={onBeginCreate}
                hitSlop={4}
                style={[
                  styles.headerAction,
                  { backgroundColor: ACTIVITY_TINT },
                ]}
              >
                <Plus size={16} color={colors.primary} strokeWidth={2.5} />
                <Text
                  style={[styles.headerActionLabel, { color: colors.primary }]}
                >
                  Add
                </Text>
              </Pressable>
            </View>
          </View>

          <ActivityManageList
            activities={activities}
            onReorder={data => {
              void handleReorderActivities(data);
            }}
            onBeginEdit={onBeginEdit}
            onArchive={confirmArchive}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sheetBodyEmbedded: {
    flex: 1,
    paddingHorizontal: BOTTOM_SHEET_SURFACE.contentPaddingHorizontal,
    paddingTop: BOTTOM_SHEET_SURFACE.contentPaddingTop,
    minHeight: 0,
  },
  loadingBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  stepBody: {
    flexDirection: 'column',
  },
  stepHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepTitle: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  headerActionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flex: 1,
    minHeight: 0,
    marginTop: 18,
  },
  gridContent: {
    paddingBottom: 8,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tokenCell: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  tokenStickerWrap: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenSticker: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenEmoji: {
    fontSize: 32,
    lineHeight: Platform.OS === 'android' ? 36 : 34,
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
  },
  formShell: {
    width: '100%',
  },
  formScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  formScrollContent: {
    paddingBottom: 12,
  },
  formBody: {
    paddingBottom: 8,
  },
  formBodyCompact: {
    paddingBottom: 0,
  },
  saveFooter: {
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
  },
  emojiPickerWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  emojiOrbPressable: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emojiOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiOrbText: {
    fontSize: 32,
    lineHeight: Platform.OS === 'android' ? 36 : 34,
    textAlign: 'center',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  emojiOrbPlaceholder: {
    opacity: 0.45,
  },
  selectEmojiHint: {
    fontSize: 13,
    fontWeight: '500',
    color: '#8E8E93',
  },
  formHeader: {
    flexShrink: 0,
  },
  formFields: {
    marginTop: 18,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  primaryButton: {
    marginTop: 20,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
  },
  primaryButtonSticky: {
    marginTop: 0,
    marginBottom: 0,
  },
  primaryButtonCompact: {
    marginTop: 16,
    marginBottom: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  backLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  manageBody: {
    flex: 1,
    minHeight: 0,
  },
  manageHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  manageHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  manageList: {
    flex: 1,
    minHeight: 0,
    marginTop: 12,
  },
  manageListContent: {
    paddingBottom: 8,
  },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  manageRowDragging: {
    borderBottomColor: 'transparent',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  dragHandle: {
    width: 28,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  manageRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  manageEmojiOrb: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manageEmoji: {
    fontSize: 22,
    lineHeight: Platform.OS === 'android' ? 26 : 24,
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
  manageLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  manageActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconAction: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
