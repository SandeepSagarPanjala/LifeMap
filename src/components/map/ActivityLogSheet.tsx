import {useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject} from 'react';
import {APP_COPY, errorMessageOr} from '@/lib/app-copy';
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
} from 'react-native';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import {ChevronLeft, GripVertical, Pencil, Trash2} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  SystemEmojiPicker,
  useEmojiKeyboard,
} from 'react-native-system-emoji-picker';

import {Text} from '@/components/ui/text';
import {BOTTOM_SHEET_SURFACE} from '@/components/ui/bottom-sheet-chrome';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  archiveActivity,
  listActiveActivities,
  reorderActivities,
  type ActivityRow,
} from '@/db/repositories/activities';
import {saveActivityMoment} from '@/lib/moments/capture-activity';

const GRID_COLUMNS = 4;
const GRID_GAP = 12;
const ACTIVITY_TINT = '#F0FDF4';
const EMOJI_PLACEHOLDER = '🏋️';
const LOG_SHEET_SNAP_RATIO = 0.5;
const LOG_SHEET_HANDLE_HEIGHT = 24;
const LOG_FOOTER_HEIGHT = 44;

type SheetMode = 'log' | 'manage';

function ActivityEmojiPicker({
  emoji,
  onChangeEmoji,
}: {
  emoji: string;
  onChangeEmoji: (value: string) => void;
}) {
  const emojiKeyboard = useEmojiKeyboard();

  useEffect(() => {
    return () => emojiKeyboard.dismiss();
  }, [emojiKeyboard]);

  const openPicker = () => {
    Keyboard.dismiss();
    const delay = Platform.OS === 'ios' ? 80 : 0;
    setTimeout(() => emojiKeyboard.open(), delay);
  };

  return (
    <View style={styles.emojiPickerWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={emoji ? `Change emoji, currently ${emoji}` : 'Pick emoji'}
        onPress={openPicker}
        style={styles.emojiOrbPressable}>
        <View style={[styles.emojiOrb, {backgroundColor: ACTIVITY_TINT}]}>
          <Text
            style={[
              styles.emojiOrbText,
              !emoji ? styles.emojiOrbPlaceholder : null,
            ]}>
            {emoji || EMOJI_PLACEHOLDER}
          </Text>
        </View>
      </Pressable>
      <SystemEmojiPicker
        ref={emojiKeyboard.ref}
        onEmojiSelected={onChangeEmoji}
        autoHideAfterSelection
        dismissOnTapOutside
        keyboardAppearance="light"
      />
    </View>
  );
}

function ActivityManageList({
  activities,
  onReorder,
  onBeginCreate,
  onBeginEdit,
  onArchive,
}: {
  activities: ActivityRow[];
  onReorder: (data: ActivityRow[]) => void;
  onBeginCreate: () => void;
  onBeginEdit: (activity: ActivityRow) => void;
  onArchive: (activity: ActivityRow) => void;
}) {
  const renderItem = useCallback(
    ({item, drag, isActive}: RenderItemParams<ActivityRow>) => (
      <ScaleDecorator activeScale={1.02}>
        <View
          style={[
            styles.manageRow,
            isActive ? styles.manageRowDragging : null,
          ]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Reorder ${item.label}`}
            onPressIn={drag}
            style={styles.dragHandle}>
            <GripVertical size={18} color="#8E8E93" strokeWidth={2.25} />
          </Pressable>
          <View style={styles.manageRowMain}>
            <View style={[styles.manageEmojiOrb, {backgroundColor: ACTIVITY_TINT}]}>
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
              style={styles.iconAction}>
              <Pencil size={16} color="#3A3A3C" strokeWidth={2.25} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.label}`}
              onPress={() => onArchive(item)}
              style={styles.iconAction}>
              <Trash2 size={16} color="#FF3B30" strokeWidth={2.25} />
            </Pressable>
          </View>
        </View>
      </ScaleDecorator>
    ),
    [onArchive, onBeginEdit],
  );

  const footer = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add activity"
      onPress={onBeginCreate}
      style={styles.addActivityButton}>
      <Text style={styles.addActivityButtonLabel}>Add activity</Text>
    </Pressable>
  );

  return (
    <DraggableFlatList
      data={activities}
      keyExtractor={item => String(item.id)}
      activationDistance={12}
      onDragEnd={({data}) => onReorder(data)}
      renderItem={renderItem}
      containerStyle={styles.manageList}
      contentContainerStyle={styles.manageListContent}
      showsVerticalScrollIndicator={false}
      ListFooterComponent={footer}
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
  reloadNonce?: number;
};

function ActivityPickerCell({
  activity,
  onPress,
}: {
  activity: ActivityRow;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log ${activity.label}`}
      onPress={onPress}
      style={styles.tokenCell}>
      <View style={styles.tokenStickerWrap}>
        <View style={[styles.tokenSticker, {backgroundColor: ACTIVITY_TINT}]}>
          <Text style={styles.tokenEmoji}>{activity.emoji}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.tokenLabel}>
        {activity.label}
      </Text>
    </Pressable>
  );
}

export function ActivityForm({
  title,
  emoji,
  label,
  saving,
  submitLabel,
  onChangeEmoji,
  onChangeLabel,
  onSubmit,
  onBack,
  compactFooter = false,
  labelInputRef,
}: {
  title: string;
  emoji: string;
  label: string;
  saving: boolean;
  submitLabel: string;
  onChangeEmoji: (value: string) => void;
  onChangeLabel: (value: string) => void;
  onSubmit: () => void;
  onBack?: () => void;
  compactFooter?: boolean;
  labelInputRef?: RefObject<ComponentRef<typeof BottomSheetTextInput> | null>;
}) {
  const canSave = emoji.trim().length > 0 && label.trim().length > 0 && !saving;

  return (
    <View style={[styles.formBody, compactFooter ? styles.formBodyCompact : null]}>
      <View style={styles.formHeader}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            style={styles.backRow}>
            <ChevronLeft size={20} color="#1C1C1E" strokeWidth={2.25} />
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        ) : null}
        <Text variant="h4" className="border-0 pb-0">
          {title}
        </Text>
        <Text variant="muted" className="mt-1 text-sm">
          Pick an emoji and a short label for this activity.
        </Text>
      </View>

      <View style={styles.formFields}>
        <ActivityEmojiPicker emoji={emoji} onChangeEmoji={onChangeEmoji} />
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
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={submitLabel}
        disabled={!canSave}
        onPress={onSubmit}
        style={[
          styles.primaryButton,
          compactFooter ? styles.primaryButtonCompact : null,
          !canSave ? styles.primaryButtonDisabled : null,
        ]}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.primaryButtonLabel}>{submitLabel}</Text>
        )}
      </Pressable>
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
  reloadNonce = 0,
}: ActivityLogSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
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

  const handleLogActivity = async (activity: ActivityRow) => {
    if (loggingId != null) {
      return;
    }
    setLoggingId(activity.id);
    try {
      await saveActivityMoment(activity);
      await onLogged();
      handleClose();
    } catch (error) {
      Alert.alert(
        APP_COPY.alerts.couldNotLogActivity,
        errorMessageOr(error, APP_COPY.common.pleaseTryAgain),
      );
    } finally {
      setLoggingId(null);
    }
  };

  const handleReorderActivities = useCallback(
    async (data: ActivityRow[]) => {
      setActivities(data);
      try {
        await reorderActivities(data.map(row => row.id));
      } catch {
        await loadActivities();
        Alert.alert(APP_COPY.common.couldNotReorder, APP_COPY.common.pleaseTryAgain);
      }
    },
    [loadActivities],
  );

  const confirmArchive = (activity: ActivityRow) => {
    Alert.alert(
      `Remove ${activity.label}?`,
      'Past logs keep their emoji and label. You can add it again later.',
      [
        {text: 'Cancel', style: 'cancel'},
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
          paddingBottom:
            mode === 'log' ? 0 : Math.max(insets.bottom, 16),
        },
      ]}>
      {mode === 'log' ? (
        <View style={[styles.stepBody, {height: logStepHeight}]}>
          <View style={styles.stepHeader}>
            <Text variant="h4" className="border-0 pb-0">
              What did you do?
            </Text>
          </View>
          {loading ? (
            <View style={styles.loadingBody}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={activities}
              keyExtractor={item => String(item.id)}
              numColumns={GRID_COLUMNS}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.gridContent}
              showsVerticalScrollIndicator={false}
              style={styles.grid}
              renderItem={({item}) => (
                <View style={{width: cellWidth}}>
                  <ActivityPickerCell
                    activity={item}
                    onPress={() => {
                      void handleLogActivity(item);
                    }}
                  />
                </View>
              )}
            />
          )}
          <View style={styles.stepFooterPinned}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage activities"
              onPress={() => setMode('manage')}
              style={styles.footerLink}>
              <Text style={[styles.footerLinkLabel, {color: colors.primary}]}>
                Manage activities
              </Text>
            </Pressable>
          </View>
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
              style={styles.backRow}>
              <ChevronLeft size={20} color="#1C1C1E" strokeWidth={2.25} />
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
            <Text variant="h4" className="border-0 pb-0">
              Your activities
            </Text>
          </View>

          <ActivityManageList
            activities={activities}
            onReorder={data => {
              void handleReorderActivities(data);
            }}
            onBeginCreate={onBeginCreate}
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
  stepFooterPinned: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: LOG_FOOTER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeader: {
    flexShrink: 0,
  },
  grid: {
    flex: 1,
    minHeight: 0,
    marginTop: 18,
  },
  gridContent: {
    paddingBottom: LOG_FOOTER_HEIGHT,
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
    ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
  },
  footerLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: LOG_FOOTER_HEIGHT,
  },
  footerLinkLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  formBody: {
    paddingBottom: 8,
  },
  formBodyCompact: {
    paddingBottom: 0,
  },
  emojiPickerWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  emojiOrbPressable: {
    alignItems: 'center',
    justifyContent: 'center',
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
    ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
  },
  emojiOrbPlaceholder: {
    opacity: 0.45,
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
    shadowOffset: {width: 0, height: 2},
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
    ...(Platform.OS === 'android' ? {includeFontPadding: false} : null),
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
  addActivityButton: {
    marginTop: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: '#007AFF',
  },
  addActivityButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
