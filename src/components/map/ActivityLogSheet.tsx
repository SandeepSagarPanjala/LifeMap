import {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import {BottomSheetFlatList, BottomSheetTextInput, BottomSheetView} from '@gorhom/bottom-sheet';
import {ChevronDown, ChevronLeft, ChevronUp, Pencil, Plus, Trash2} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  SystemEmojiPicker,
  useEmojiKeyboard,
} from 'react-native-system-emoji-picker';

import {Text} from '@/components/ui/text';
import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {
  archiveActivity,
  createActivity,
  listActiveActivities,
  moveActivitySortOrder,
  updateActivity,
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
  }, []);

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

type SheetMode = 'log' | 'create-first' | 'manage' | 'create' | 'edit';

type ActivityLogSheetProps = {
  visible: boolean;
  onClose: () => void;
  onLogged: () => void | Promise<void>;
  onWillClose?: () => void;
  snapPoints?: (string | number)[];
  instantPresent?: boolean;
  embedded?: boolean;
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

function ActivityForm({
  title,
  emoji,
  label,
  saving,
  submitLabel,
  onChangeEmoji,
  onChangeLabel,
  onSubmit,
  onBack,
  embedded = false,
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
  embedded?: boolean;
}) {
  const canSave = emoji.trim().length > 0 && label.trim().length > 0 && !saving;
  const LabelInput = embedded ? TextInput : BottomSheetTextInput;

  return (
    <View style={styles.formBody}>
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
        <LabelInput
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
        style={[styles.primaryButton, !canSave ? styles.primaryButtonDisabled : null]}>
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
  onWillClose,
  snapPoints: logSnapPointsProp,
  instantPresent = false,
  embedded = false,
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
  const [saving, setSaving] = useState(false);
  const [loggingId, setLoggingId] = useState<number | null>(null);
  const [emoji, setEmoji] = useState('');
  const [label, setLabel] = useState('');
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null);

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

  useEffect(() => {
    if (!visible) {
      return;
    }
    void (async () => {
      const rows = await loadActivities();
      setMode(rows.length === 0 ? 'create-first' : 'log');
      setEmoji('');
      setLabel('');
      setEditingActivity(null);
    })();
  }, [loadActivities, visible]);

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
        'Could not log activity',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setLoggingId(null);
    }
  };

  const handleCreateActivity = async (logAfterCreate: boolean) => {
    if (saving) {
      return;
    }
    setSaving(true);
    try {
      const created = await createActivity({emoji, label});
      const rows = await loadActivities();
      if (logAfterCreate) {
        await saveActivityMoment(created);
        await onLogged();
        handleClose();
        return;
      }
      setMode(rows.length === 0 ? 'create-first' : 'log');
      setEmoji('');
      setLabel('');
    } catch (error) {
      Alert.alert(
        'Could not save activity',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateActivity = async () => {
    if (!editingActivity || saving) {
      return;
    }
    setSaving(true);
    try {
      await updateActivity(editingActivity.id, {emoji, label});
      await loadActivities();
      setMode('manage');
      setEditingActivity(null);
      setEmoji('');
      setLabel('');
    } catch (error) {
      Alert.alert(
        'Could not update activity',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

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
                setMode('create-first');
              }
              setActivities(rows);
            })();
          },
        },
      ],
    );
  };

  const isFormMode = mode === 'create-first' || mode === 'create' || mode === 'edit';
  const logSnapPoints = logSnapPointsProp ?? (['50%'] as const);
  const snapPoints =
    mode === 'manage' ? (['72%'] as const) : isFormMode ? undefined : logSnapPoints;

  const ActivityList = embedded ? FlatList : BottomSheetFlatList;
  const PanelContainer = embedded ? View : BottomSheetView;
  const logBodyStyle = embedded ? styles.stepBodyEmbedded : [styles.stepBody, {height: logStepHeight}];

  const panelContent = (
    <PanelContainer
      style={[
        embedded ? styles.sheetBodyEmbedded : styles.sheetBody,
        isFormMode ? styles.sheetBodyCompact : null,
        embedded
          ? null
          : {
              paddingBottom: isFormMode
                ? Math.max(insets.bottom, 20) + 8
                : Math.max(insets.bottom, 16),
            },
      ]}>
      {mode === 'log' ? (
        <View style={logBodyStyle}>
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
              <ActivityList
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

        {mode === 'create-first' ? (
          <ActivityForm
            embedded={embedded}
            title="Add your first activity"
            emoji={emoji}
            label={label}
            saving={saving}
            submitLabel="Save & log"
            onChangeEmoji={setEmoji}
            onChangeLabel={setLabel}
            onSubmit={() => {
              void handleCreateActivity(true);
            }}
          />
        ) : null}

        {mode === 'create' ? (
          <ActivityForm
            embedded={embedded}
            title="New activity"
            emoji={emoji}
            label={label}
            saving={saving}
            submitLabel="Save"
            onChangeEmoji={setEmoji}
            onChangeLabel={setLabel}
            onBack={() => setMode('manage')}
            onSubmit={() => {
              void handleCreateActivity(false);
            }}
          />
        ) : null}

        {mode === 'edit' && editingActivity ? (
          <ActivityForm
            embedded={embedded}
            title="Edit activity"
            emoji={emoji}
            label={label}
            saving={saving}
            submitLabel="Save"
            onChangeEmoji={setEmoji}
            onChangeLabel={setLabel}
            onBack={() => {
              setMode('manage');
              setEditingActivity(null);
            }}
            onSubmit={() => {
              void handleUpdateActivity();
            }}
          />
        ) : null}

        {mode === 'manage' ? (
          <View style={styles.manageBody}>
            <View style={styles.manageHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to activity picker"
                onPress={() => setMode(activities.length === 0 ? 'create-first' : 'log')}
                style={styles.backRow}>
                <ChevronLeft size={20} color="#1C1C1E" strokeWidth={2.25} />
                <Text style={styles.backLabel}>Back</Text>
              </Pressable>
              <Text variant="h4" className="border-0 pb-0">
                Your activities
              </Text>
            </View>

            <ActivityList
              data={activities}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={styles.manageListContent}
              showsVerticalScrollIndicator={false}
              style={styles.manageList}
              ListFooterComponent={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add activity"
                  onPress={() => {
                    setEmoji('');
                    setLabel('');
                    setMode('create');
                  }}
                  style={styles.addRow}>
                  <Plus size={18} color={colors.primary} strokeWidth={2.25} />
                  <Text style={[styles.addRowLabel, {color: colors.primary}]}>
                    Add activity
                  </Text>
                </Pressable>
              }
              renderItem={({item, index}) => (
                <View style={styles.manageRow}>
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
                      accessibilityLabel={`Move ${item.label} up`}
                      disabled={index === 0}
                      onPress={() => {
                        void moveActivitySortOrder(item.id, 'up').then(loadActivities);
                      }}
                      style={[styles.iconAction, index === 0 ? styles.iconActionDisabled : null]}>
                      <ChevronUp size={18} color="#3A3A3C" strokeWidth={2.25} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Move ${item.label} down`}
                      disabled={index === activities.length - 1}
                      onPress={() => {
                        void moveActivitySortOrder(item.id, 'down').then(loadActivities);
                      }}
                      style={[
                        styles.iconAction,
                        index === activities.length - 1 ? styles.iconActionDisabled : null,
                      ]}>
                      <ChevronDown size={18} color="#3A3A3C" strokeWidth={2.25} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${item.label}`}
                      onPress={() => {
                        setEditingActivity(item);
                        setEmoji(item.emoji);
                        setLabel(item.label);
                        setMode('edit');
                      }}
                      style={styles.iconAction}>
                      <Pencil size={16} color="#3A3A3C" strokeWidth={2.25} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${item.label}`}
                      onPress={() => confirmArchive(item)}
                      style={styles.iconAction}>
                      <Trash2 size={16} color="#FF3B30" strokeWidth={2.25} />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>
        ) : null}
    </PanelContainer>
  );

  if (embedded) {
    if (!visible) {
      return null;
    }
    return panelContent;
  }

  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      onClosing={onWillClose}
      releaseTouchesWhileClosing={onWillClose != null}
      instantPresent={instantPresent}
      dismissKeyboardOnClose
      keyboardAware={isFormMode}
      enableDynamicSizing={isFormMode}
      rawChildren
      snapPoints={snapPoints ? [...snapPoints] : undefined}>
      {panelContent}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBodyEmbedded: {
    flex: 1,
    paddingTop: 0,
    minHeight: 0,
  },
  stepBodyEmbedded: {
    flex: 1,
    minHeight: 0,
  },
  sheetBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 4,
    minHeight: 320,
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
  sheetBodyCompact: {
    flexGrow: 0,
    minHeight: 0,
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
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
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
  },
  iconActionDisabled: {
    opacity: 0.35,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  addRowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
