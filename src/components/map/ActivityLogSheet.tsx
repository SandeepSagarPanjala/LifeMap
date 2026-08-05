import {
  memo,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
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
  TextInput,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native';
import {
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { ScrollView } from 'react-native-gesture-handler';
import { Check, ChevronDown, ChevronLeft, Pencil, WandSparkles, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SystemEmojiPicker,
  useEmojiKeyboard,
} from 'react-native-system-emoji-picker';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { ActivityEmojiOrb } from '@/components/map/ActivityEmojiOrb';
import { ActivityFieldsEditor } from '@/components/map/ActivityFieldsEditor';
import type { ActivityFieldsEditorHandle } from '@/components/map/ActivityFieldsEditor';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import {
  BOTTOM_SHEET_SURFACE,
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import {
  ACTIVITY_INTENT_OPTIONS,
  activityIntentLabel,
} from '@/lib/activities/activity-intent';
import {
  listActiveActivities,
  type ActivityRow,
} from '@/db/repositories/activities';
import type { ActivityFieldDefinition } from '@/lib/activities/activity-definition';
import { ACTIVITY_MAX_LABEL_LENGTH } from '@/lib/activities/activity-definition';
import { ACTIVITY_TINT_ONE_TAP } from '@/lib/activities/activity-tile-style';
import { saveActivityMoment } from '@/lib/moments/capture-activity';

const GRID_COLUMNS = 4;
const GRID_GAP = 12;
const ACTIVITY_TINT = ACTIVITY_TINT_ONE_TAP;
const EMOJI_PLACEHOLDER = '❓';

type ActivityEmojiPickerHandle = {
  open: () => void;
  dismiss: () => void;
};

const ActivityEmojiPicker = forwardRef<
  ActivityEmojiPickerHandle,
  {
    emoji: string;
    onChangeEmoji: (value: string) => void;
    /** Keep keyboard up and hand off to the label field instead of dismissing first. */
    swapKeyboardOnPick?: boolean;
    onEmojiPicked?: () => void;
    /** Fired when the emoji keyboard is about to open. */
    onEmojiOpen?: () => void;
    /** Fired when the emoji keyboard is dismissed (Done, pick, or close). */
    onEmojiClose?: () => void;
  }
>(function ActivityEmojiPicker(
  {
    emoji,
    onChangeEmoji,
    swapKeyboardOnPick = false,
    onEmojiPicked,
    onEmojiOpen,
    onEmojiClose,
  },
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
        onEmojiOpen?.();
        emojiKeyboardRef.current.open();
      },
      dismiss: () => {
        emojiKeyboardRef.current.dismiss();
        onEmojiClose?.();
      },
    }),
    [onEmojiClose, onEmojiOpen],
  );

  const openPicker = useCallback(() => {
    onEmojiOpen?.();
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
  }, [onEmojiOpen, swapKeyboardOnPick]);

  const handleEmojiSelected = useCallback(
    (value: string) => {
      onChangeEmoji(value);
      // Always dismiss the emoji keyboard; create flow then focuses Label.
      emojiKeyboardRef.current.dismiss();
      onEmojiClose?.();
      onEmojiPicked?.();
    },
    [onChangeEmoji, onEmojiClose, onEmojiPicked],
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
          <View style={styles.emojiEditBadge} pointerEvents="none">
            <Pencil size={10} color="#15803D" strokeWidth={2.5} />
          </View>
        </View>
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

type ActivityLogSheetProps = {
  visible: boolean;
  onClose: () => void;
  onLogged: () => void | Promise<void>;
  onBeginCreateFirst: () => void;
  onBeginManage: () => void;
  onBeginInsights: () => void;
  onBeginStructuredLog: (activity: ActivityRow) => void;
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
      accessibilityLabel={
        activity.reminderEnabled
          ? `Log ${activity.label}, reminder on`
          : `Log ${activity.label}`
      }
      onPress={handlePress}
      style={styles.tokenCell}
    >
      <ActivityEmojiOrb activity={activity} />
      <Text numberOfLines={1} style={styles.tokenLabel}>
        {activity.label}
      </Text>
    </Pressable>
  );
});

export function ActivityForm({
  emoji,
  label,
  intent,
  fields,
  saving,
  submitLabel,
  onChangeEmoji,
  onChangeLabel,
  onChangeIntent,
  onChangeFields,
  onSubmit,
  onBack,
  compactFooter = false,
  autoFocusEmoji = false,
  embedded = false,
  sheetInputs = false,
  hideFooter = false,
  headerSave = false,
  sheetScrollRef,
  onKeyboardOpenChange,
  labelInputRef,
  openEmojiRef,
  belowLabel,
  lockFields = false,
}: {
  emoji: string;
  label: string;
  intent: ActivityIntent;
  fields: ActivityFieldDefinition[];
  saving: boolean;
  submitLabel: string;
  onChangeEmoji: (value: string) => void;
  onChangeLabel: (value: string) => void;
  onChangeIntent: (value: ActivityIntent) => void;
  onChangeFields: (fields: ActivityFieldDefinition[]) => void;
  onSubmit: () => void;
  onBack?: () => void;
  compactFooter?: boolean;
  autoFocusEmoji?: boolean;
  embedded?: boolean;
  sheetInputs?: boolean;
  hideFooter?: boolean;
  headerSave?: boolean;
  sheetScrollRef?: RefObject<ComponentRef<typeof BottomSheetScrollView> | null>;
  onKeyboardOpenChange?: (open: boolean) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  labelInputRef?: RefObject<any>;
  openEmojiRef?: RefObject<ActivityEmojiPickerHandle | null>;
  belowLabel?: ReactNode;
  /** HealthKit definitions: hide Advanced field editing. */
  lockFields?: boolean;
}) {
  const colors = useThemeColors();
  const LabelInput = sheetInputs ? BottomSheetTextInput : TextInput;
  const canSave = emoji.trim().length > 0 && label.trim().length > 0 && !saving;
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [intentMenuOpen, setIntentMenuOpen] = useState(false);
  const [intentMenuPos, setIntentMenuPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const keyboardHeightRef = useRef(0);
  const keyboardSwapRef = useRef(false);
  const fieldsEditorRef = useRef<ActivityFieldsEditorHandle>(null);
  const formShellRef = useRef<View>(null);
  const intentAnchorRef = useRef<View>(null);
  const scrollYRef = useRef(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const lastFocusedTargetRef = useRef<{
    measureInWindow: (
      cb: (x: number, y: number, w: number, h: number) => void,
    ) => void;
  } | null>(null);
  const emojiKeyboardActiveRef = useRef(false);

  const handleBack = useCallback(() => {
    if (intentMenuOpen) {
      setIntentMenuOpen(false);
      setIntentMenuPos(null);
      return;
    }
    if (fieldsEditorRef.current?.dismissNested()) {
      return;
    }
    onBack?.();
  }, [intentMenuOpen, onBack]);

  const closeIntentMenu = useCallback(() => {
    setIntentMenuOpen(false);
    setIntentMenuPos(null);
  }, []);

  const toggleIntentMenu = useCallback(() => {
    Keyboard.dismiss();
    if (intentMenuOpen) {
      setIntentMenuOpen(false);
      setIntentMenuPos(null);
      return;
    }
    const anchor = intentAnchorRef.current;
    const shell = formShellRef.current;
    if (anchor == null || shell == null) {
      setIntentMenuPos({ top: 120, right: 16 });
      setIntentMenuOpen(true);
      return;
    }
    anchor.measureInWindow((ax, ay, aw, ah) => {
      shell.measureInWindow((sx, sy, sw) => {
        setIntentMenuPos({
          top: ay + ah - sy + 6,
          right: Math.max(8, sx + sw - (ax + aw)),
        });
        setIntentMenuOpen(true);
      });
    });
  }, [intentMenuOpen]);

  const selectIntent = useCallback(
    (value: ActivityIntent) => {
      onChangeIntent(value);
      setIntentMenuOpen(false);
      setIntentMenuPos(null);
    },
    [onChangeIntent],
  );

  const handleEmojiPicked = useCallback(() => {
    emojiKeyboardActiveRef.current = false;
    if (!autoFocusEmoji) {
      return;
    }
    keyboardSwapRef.current = true;
    labelInputRef?.current?.focus();
  }, [autoFocusEmoji, labelInputRef]);

  const handleEmojiOpen = useCallback(() => {
    setIntentMenuOpen(false);
    setIntentMenuPos(null);
    // Emoji is already at the top — don't re-scroll to a previous bottom field.
    emojiKeyboardActiveRef.current = true;
    lastFocusedTargetRef.current = null;
    labelInputRef?.current?.blur();
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    // Emoji keyboard often doesn't keep RN keyboard listeners in sync after
    // Keyboard.dismiss() — force the bottom Done chrome on.
    onKeyboardOpenChange?.(true);
  }, [labelInputRef, onKeyboardOpenChange]);

  const handleEmojiClose = useCallback(() => {
    emojiKeyboardActiveRef.current = false;
    if (!keyboardSwapRef.current) {
      onKeyboardOpenChange?.(false);
    }
  }, [onKeyboardOpenChange]);

  const scrollFocusedIntoView = useCallback(
    (target: {
      measureInWindow: (
        cb: (x: number, y: number, w: number, h: number) => void,
      ) => void;
    }) => {
      if (emojiKeyboardActiveRef.current) {
        return;
      }
      const run = () => {
        if (emojiKeyboardActiveRef.current) {
          return;
        }
        const kb = keyboardHeightRef.current;
        if (kb <= 0) {
          return;
        }
        const keyboardTop = windowHeight - kb;
        const visibleBottom = keyboardTop - 12;
        target.measureInWindow((_tx, ty, _tw, th) => {
          const fieldBottom = ty + th;
          // Already visible above the keyboard — leave scroll alone.
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
    [windowHeight],
  );

  const handleInputFocus = useCallback(
    (event: { target?: unknown; currentTarget?: unknown }) => {
      setIntentMenuOpen(false);
      setIntentMenuPos(null);
      emojiKeyboardActiveRef.current = false;
      if (sheetInputs) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            sheetScrollRef?.current?.scrollToEnd?.({ animated: true });
          }, 250);
        });
        return;
      }
      const target = (event.target ?? event.currentTarget) as {
        measureInWindow?: (
          cb: (x: number, y: number, w: number, h: number) => void,
        ) => void;
      } | null;
      if (target?.measureInWindow == null) {
        return;
      }
      const measurable = target as {
        measureInWindow: (
          cb: (x: number, y: number, w: number, h: number) => void,
        ) => void;
      };
      lastFocusedTargetRef.current = measurable;
      scrollFocusedIntoView(measurable);
    },
    [scrollFocusedIntoView, sheetInputs, sheetScrollRef],
  );

  useEffect(() => {
    if (sheetInputs) {
      return;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (event: { endCoordinates: { height: number } }) => {
      keyboardSwapRef.current = false;
      const next = event.endCoordinates.height;
      keyboardHeightRef.current = next;
      setKeyboardHeight(next);
      onKeyboardOpenChange?.(true);
      if (emojiKeyboardActiveRef.current) {
        return;
      }
      if (lastFocusedTargetRef.current != null) {
        scrollFocusedIntoView(lastFocusedTargetRef.current);
      }
    };
    const onHide = () => {
      if (keyboardSwapRef.current) {
        return;
      }
      // Opening emoji dismisses the text keyboard first — keep emoji chrome.
      if (emojiKeyboardActiveRef.current) {
        return;
      }
      keyboardHeightRef.current = 0;
      setKeyboardHeight(0);
      onKeyboardOpenChange?.(false);
    };
    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
      onKeyboardOpenChange?.(false);
    };
  }, [onKeyboardOpenChange, scrollFocusedIntoView, sheetInputs]);

  const sheetMaxHeight = sheetInputs
    ? undefined
    : keyboardHeight > 0 && !embedded
      ? Math.round(Math.max(300, windowHeight - keyboardHeight - 12))
      : embedded
        ? undefined
        : Math.round(windowHeight * 0.88);

  // Enough room to scroll the last field up to the keyboard; avoid huge empty pad.
  const scrollBottomPad = embedded
    ? 32 + (keyboardHeight > 0 ? Math.round(keyboardHeight * 0.25) : 0)
    : 24 +
      (keyboardHeight > 0
        ? Math.max(24, Math.round(keyboardHeight * 0.35))
        : 0);

  const showFormChrome = onBack != null || headerSave;

  const intentMenuOverlay =
    intentMenuOpen && intentMenuPos != null ? (
      <>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close habit menu"
          onPress={closeIntentMenu}
          style={styles.intentMenuBackdrop}
        />
        <View
          style={[
            styles.intentMenu,
            {
              top: intentMenuPos.top,
              right: intentMenuPos.right,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.intentMenuTitle,
              { color: colors.mutedForeground },
            ]}
          >
            Build or cut back?
          </Text>
          {ACTIVITY_INTENT_OPTIONS.map(option => {
            const selected = option.value === intent;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="menuitem"
                accessibilityState={{ selected }}
                onPress={() => selectIntent(option.value)}
                style={[
                  styles.intentMenuItem,
                  selected ? { backgroundColor: colors.accent } : null,
                ]}
              >
                <Text
                  style={[
                    styles.intentMenuItemLabel,
                    {
                      color: selected
                        ? colors.primary
                        : colors.cardForeground,
                    },
                  ]}
                >
                  {option.label}
                </Text>
                {selected ? (
                  <Check
                    size={17}
                    color={colors.primary}
                    strokeWidth={2.5}
                  />
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </>
    ) : null;

  const formBody = (
    <>
      {showFormChrome ? (
        <View style={styles.formHeader}>
          <View style={styles.formHeaderRow}>
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
            ) : (
              <View style={styles.headerSideSlot} />
            )}
            <View style={styles.headerSpacer} />
            {headerSave ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={submitLabel}
                disabled={!canSave}
                onPress={onSubmit}
                hitSlop={10}
                style={[
                  styles.headerSaveButton,
                  !canSave ? styles.headerSaveButtonDisabled : null,
                ]}
              >
                {saving ? (
                  <ActivityIndicator color="#007AFF" />
                ) : (
                  <Check size={22} color="#007AFF" strokeWidth={2.75} />
                )}
              </Pressable>
            ) : (
              <View style={styles.headerSideSlot} />
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.formFields}>
        <ActivityEmojiPicker
          ref={openEmojiRef}
          emoji={emoji}
          onChangeEmoji={onChangeEmoji}
          swapKeyboardOnPick={autoFocusEmoji}
          onEmojiPicked={handleEmojiPicked}
          onEmojiOpen={handleEmojiOpen}
          onEmojiClose={handleEmojiClose}
        />
        <Text style={styles.fieldLabel}>Label</Text>
        <LabelInput
          ref={labelInputRef}
          value={label}
          onChangeText={onChangeLabel}
          maxLength={ACTIVITY_MAX_LABEL_LENGTH}
          placeholder="Gym"
          placeholderTextColor="#8E8E93"
          style={styles.input}
          returnKeyType="done"
          onFocus={handleInputFocus}
          onSubmitEditing={Keyboard.dismiss}
        />
        <View ref={intentAnchorRef} collapsable={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Habit, ${activityIntentLabel(intent)}`}
            accessibilityState={{ expanded: intentMenuOpen }}
            onPress={toggleIntentMenu}
            style={styles.intentPicker}
          >
            <Text style={styles.intentPickerLabel}>Habit</Text>
            <View style={styles.intentPickerValue}>
              <Text style={styles.intentPickerValueText}>
                {activityIntentLabel(intent)}
              </Text>
              <ChevronDown size={16} color="#8E8E93" strokeWidth={2.25} />
            </View>
          </Pressable>
        </View>
        {belowLabel}
        {lockFields ? (
          <Text style={styles.healthFieldsHint}>
            Fields come from Apple Health and can’t be changed.
          </Text>
        ) : (
          <ActivityFieldsEditor
            ref={fieldsEditorRef}
            fields={fields}
            onChangeFields={onChangeFields}
            sheetInputs={sheetInputs}
            onInputFocus={handleInputFocus}
          />
        )}
      </View>
    </>
  );

  if (sheetInputs) {
    return (
      <View ref={formShellRef} style={styles.formShellSheet} collapsable={false}>
        {formBody}
        {intentMenuOverlay}
      </View>
    );
  }

  return (
    <View
      ref={formShellRef}
      collapsable={false}
      style={[
        styles.formShell,
        embedded ? styles.formShellEmbedded : null,
        embedded ? styles.formShellPadded : null,
        sheetMaxHeight != null ? { maxHeight: sheetMaxHeight } : null,
      ]}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.formScroll}
        contentContainerStyle={[
          styles.formScrollContent,
          embedded ? styles.formScrollContentBottom : null,
          { paddingBottom: scrollBottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        // Parent KeyboardAvoidingView owns inset when embedded.
        automaticallyAdjustKeyboardInsets={!embedded && Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
        onScroll={event => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
          if (intentMenuOpen) {
            closeIntentMenu();
          }
        }}
        scrollEventThrottle={16}
      >
        {formBody}
      </ScrollView>

      {hideFooter ? null : (
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
      )}
      {intentMenuOverlay}
    </View>
  );
}

export function ActivityLogSheet({
  visible,
  onClose,
  onLogged,
  onBeginCreateFirst,
  onBeginManage,
  onBeginInsights,
  onBeginStructuredLog,
  reloadNonce = 0,
}: ActivityLogSheetProps) {
  const colors = useThemeColors();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cellWidth =
    (windowWidth - 40 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const barBottomPad = Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP);

  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const emptyCreateRequestedRef = useRef(false);
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
        if (!emptyCreateRequestedRef.current) {
          emptyCreateRequestedRef.current = true;
          onBeginCreateFirstRef.current();
        }
      } else {
        emptyCreateRequestedRef.current = false;
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

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.sheetBodyEmbedded, { paddingBottom: 0 }]}>
      <View style={styles.stepBody}>
        <View style={styles.stepHeader}>
          <Text variant="h4" className="border-0 pb-0" style={styles.stepTitle}>
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
            keyExtractor={activityKeyExtractor}
            numColumns={GRID_COLUMNS}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={[
              styles.gridContent,
              {
                paddingBottom: MAP_MOMENTS_BAR_HEIGHT + barBottomPad + 16,
              },
            ]}
            showsVerticalScrollIndicator={false}
            style={styles.grid}
            renderItem={renderActivityCell}
          />
        )}

        <View
          pointerEvents="box-none"
          style={[styles.barWrap, { paddingBottom: barBottomPad }]}
        >
          <View style={styles.barRow}>
            <MapGlassCircleButton
              accessibilityLabel="Activity insights"
              onPress={onBeginInsights}
              style={styles.closeButton}
            >
              <WandSparkles
                size={20}
                color={colors.primary}
                strokeWidth={2.25}
              />
            </MapGlassCircleButton>

            <GlassPressable
              accessibilityLabel="Manage activities"
              onPress={onBeginManage}
              style={styles.shadowWrap}
            >
              <AdaptiveGlassSurface style={styles.pill}>
                <View style={styles.managePressable}>
                  <Pencil
                    size={16}
                    color={colors.primary}
                    strokeWidth={2.25}
                  />
                  <Text
                    style={[styles.manageBarLabel, { color: colors.primary }]}
                  >
                    Manage activities
                  </Text>
                </View>
              </AdaptiveGlassSurface>
            </GlassPressable>

            <MapGlassCircleButton
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.closeButton}
            >
              <X size={20} color={colors.primary} strokeWidth={2.25} />
            </MapGlassCircleButton>
          </View>
        </View>
      </View>
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
    flex: 1,
    minHeight: 0,
    flexDirection: 'column',
  },
  stepHeader: {
    flexShrink: 0,
  },
  stepTitle: {
    flexShrink: 0,
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
  managePressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: 18,
  },
  manageBarLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  closeButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
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
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
  },
  formShell: {
    width: '100%',
  },
  formShellSheet: {
    width: '100%',
    paddingBottom: 8,
  },
  formShellEmbedded: {
    flex: 1,
    minHeight: 0,
  },
  formShellPadded: {
    paddingHorizontal: BOTTOM_SHEET_SURFACE.contentPaddingHorizontal,
    paddingTop: BOTTOM_SHEET_SURFACE.contentPaddingTop,
  },
  formScroll: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  formScrollContent: {
    flexGrow: 0,
    paddingBottom: 12,
  },
  /** Same as Manage list: pin form content above the bottom glass bar. */
  formScrollContentBottom: {
    flexGrow: 1,
    justifyContent: 'flex-end',
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
  emojiEditBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formHeader: {
    flexShrink: 0,
  },
  formHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    marginBottom: 4,
  },
  headerSpacer: {
    flex: 1,
  },
  headerSideSlot: {
    width: 36,
    height: 36,
  },
  headerSaveButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveButtonDisabled: {
    opacity: 0.35,
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
  intentPicker: {
    marginTop: 4,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  intentPickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A3A3C',
  },
  intentPickerValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  intentPickerValueText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#007AFF',
    textAlign: 'right',
  },
  intentMenuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 11,
  },
  intentMenu: {
    position: 'absolute',
    zIndex: 21,
    width: 190,
    padding: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  intentMenuTitle: {
    paddingHorizontal: 10,
    paddingTop: 7,
    paddingBottom: 5,
    fontSize: 12,
    fontWeight: '600',
  },
  intentMenuItem: {
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  intentMenuItemLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  healthFieldsHint: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 18,
    color: '#8E8E93',
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
