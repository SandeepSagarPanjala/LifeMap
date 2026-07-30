import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { GlassPressable } from '@/components/glass/GlassPressable';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/use-theme-colors';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
} from '@/lib/app-constants';
import {
  formatTimeMinutes,
  weeklySummaryLabel,
} from '@/lib/notifications/schedule-math';
import {
  WEEKDAY_NAMES,
  type ActivityReminderConfig,
  type ReminderRepeat,
  type ReminderSound,
} from '@/lib/notifications/types';

const REPEAT_OPTIONS: { value: ReminderRepeat; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

type Props = {
  visible: boolean;
  initial: ActivityReminderConfig;
  activityLabel: string;
  onCancel: () => void;
  onSave: (config: ActivityReminderConfig) => void;
};

function minutesFromDate(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function dateFromMinutes(timeMinutes: number, base = new Date()): Date {
  const d = new Date(base);
  d.setHours(Math.floor(timeMinutes / 60), timeMinutes % 60, 0, 0);
  return d;
}

export function ActivityReminderSheet({
  visible,
  initial,
  activityLabel,
  onCancel,
  onSave,
}: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [repeat, setRepeat] = useState<ReminderRepeat>(initial.repeat);
  const [timeMinutes, setTimeMinutes] = useState(initial.timeMinutes);
  const [weekday, setWeekday] = useState(initial.weekday);
  const [dayOfMonth, setDayOfMonth] = useState(initial.dayOfMonth);
  const [anchorAt, setAnchorAt] = useState<Date>(
    initial.anchorAt ?? new Date(),
  );
  const [sound, setSound] = useState<ReminderSound>(initial.sound);
  const [showTimePicker, setShowTimePicker] = useState(Platform.OS === 'ios');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const resetFromInitial = useCallback(() => {
    setRepeat(initial.repeat);
    setTimeMinutes(initial.timeMinutes);
    setWeekday(initial.weekday);
    setDayOfMonth(initial.dayOfMonth);
    setAnchorAt(initial.anchorAt ?? new Date());
    setSound(initial.sound);
  }, [initial]);

  useEffect(() => {
    if (visible) {
      resetFromInitial();
    }
  }, [visible, resetFromInitial]);

  const timeDate = useMemo(() => dateFromMinutes(timeMinutes), [timeMinutes]);
  const footerBottom = Math.max(insets.bottom, MAP_MOMENTS_BAR_GAP);
  const scrollBottom =
    MAP_MOMENTS_BAR_HEIGHT + footerBottom + MAP_MOMENTS_BAR_GAP + 20;

  const handleSave = () => {
    onSave({
      enabled: true,
      repeat,
      timeMinutes,
      weekday: repeat === 'weekly' ? weekday : timeDate.getDay(),
      dayOfMonth: repeat === 'monthly' ? dayOfMonth : anchorAt?.getDate() ?? 1,
      anchorAt: repeat === 'never' || repeat === 'monthly' ? anchorAt : null,
      sound,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View
        style={[
          styles.root,
          {
            backgroundColor: colors.background,
            paddingTop: Math.max(insets.top, 12),
          },
        ]}
      >
        <View style={styles.header}>
          <Text className="text-base font-semibold">Notify me</Text>
        </View>

        <Text variant="muted" className="px-4 pb-2 text-sm">
          Reminder for {activityLabel}
        </Text>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: scrollBottom },
          ]}
        >
          <Text className="text-muted-foreground mb-2 px-1 text-xs font-semibold uppercase tracking-wide">
            Repeat
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {REPEAT_OPTIONS.map((option, index) => (
              <Pressable
                key={option.value}
                onPress={() => setRepeat(option.value)}
                style={[
                  styles.row,
                  index > 0
                    ? {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      }
                    : null,
                ]}
              >
                <Text className="flex-1 text-base">{option.label}</Text>
                {repeat === option.value ? (
                  <Text style={{ color: colors.primary }}>✓</Text>
                ) : null}
              </Pressable>
            ))}
          </View>

          {repeat === 'weekly' ? (
            <>
              <Text className="text-muted-foreground mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wide">
                {weeklySummaryLabel(weekday)}
              </Text>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                {WEEKDAY_NAMES.map((name, index) => (
                  <Pressable
                    key={name}
                    onPress={() => setWeekday(index)}
                    style={[
                      styles.row,
                      index > 0
                        ? {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          }
                        : null,
                    ]}
                  >
                    <Text className="flex-1 text-base">{name}</Text>
                    {weekday === index ? (
                      <Text style={{ color: colors.primary }}>✓</Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {repeat === 'never' || repeat === 'monthly' ? (
            <>
              <Text className="text-muted-foreground mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wide">
                Date
              </Text>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Pressable
                  style={styles.row}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text className="flex-1 text-base">
                    {anchorAt.toLocaleDateString(undefined, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                </Pressable>
              </View>
              {showDatePicker ? (
                <DateTimePicker
                  value={anchorAt}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_event, date) => {
                    if (Platform.OS === 'android') {
                      setShowDatePicker(false);
                    }
                    if (date) {
                      setAnchorAt(date);
                      setDayOfMonth(date.getDate());
                    }
                  }}
                />
              ) : null}
            </>
          ) : null}

          <Text className="text-muted-foreground mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wide">
            Time
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {Platform.OS === 'android' && !showTimePicker ? (
              <Pressable
                style={styles.row}
                onPress={() => setShowTimePicker(true)}
              >
                <Text className="flex-1 text-base">
                  {formatTimeMinutes(timeMinutes)}
                </Text>
              </Pressable>
            ) : (
              <DateTimePicker
                value={timeDate}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_event, date) => {
                  if (Platform.OS === 'android') {
                    setShowTimePicker(false);
                  }
                  if (date) {
                    setTimeMinutes(minutesFromDate(date));
                  }
                }}
              />
            )}
          </View>

          <Text className="text-muted-foreground mb-2 mt-5 px-1 text-xs font-semibold uppercase tracking-wide">
            Sound
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.row}>
              <Text className="flex-1 text-base">With sound</Text>
              <Switch
                value={sound === 'ding'}
                onValueChange={on => setSound(on ? 'ding' : 'silent')}
                trackColor={{ false: '#E5E5EA', true: colors.primary }}
              />
            </View>
            <Text variant="muted" className="px-4 pb-3 text-sm">
              {sound === 'ding'
                ? 'Plays a short system ding.'
                : 'Silent banner only.'}
            </Text>
          </View>
        </ScrollView>

        <View
          pointerEvents="box-none"
          style={[styles.barWrap, { paddingBottom: footerBottom }]}
        >
          <View style={styles.barRow}>
            <GlassPressable
              accessibilityLabel="Save reminder"
              onPress={handleSave}
              style={styles.shadowWrap}
            >
              <AdaptiveGlassSurface style={styles.pill}>
                <View style={styles.savePressable}>
                  <Check size={18} color={colors.primary} strokeWidth={2.5} />
                  <Text style={[styles.saveLabel, { color: colors.primary }]}>
                    Save
                  </Text>
                </View>
              </AdaptiveGlassSurface>
            </GlassPressable>

            <MapGlassCircleButton
              accessibilityLabel="Close reminder"
              onPress={onCancel}
              style={styles.closeButton}
            >
              <X size={20} color={colors.primary} strokeWidth={2.25} />
            </MapGlassCircleButton>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  scroll: { paddingHorizontal: 16 },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
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
    minWidth: 132,
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
