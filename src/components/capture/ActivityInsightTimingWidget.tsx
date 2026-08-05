import { Platform, Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import type {
  ReminderTimingKind,
  ReminderTimingSummary,
} from '@/lib/activities/activity-reminder-timing';

type TimingCell = {
  kind: ReminderTimingKind;
  label: string;
  value: number;
};

/**
 * Separate Timing card for activities with notify: On time / Early / Late
 * counts for the visible year. Values open a drill-down list.
 */
export function ActivityInsightTimingWidget({
  summary,
  year,
  tint,
  accent,
  muted,
  onPressKind,
}: {
  summary: ReminderTimingSummary;
  year: number;
  tint: string;
  accent: string;
  muted: string;
  onPressKind: (kind: ReminderTimingKind) => void;
}) {
  const cells: TimingCell[] = [
    { kind: 'on_time', label: 'On time', value: summary.onTime },
    { kind: 'early', label: 'Early', value: summary.early },
    { kind: 'late', label: 'Late', value: summary.late },
  ];

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      style={[styles.section, { backgroundColor: tint }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: accent }]}>Timing</Text>
        <Text style={[styles.year, { color: muted }]}>{year}</Text>
      </View>
      <View style={styles.row}>
        {cells.map(cell => (
          <View key={cell.kind} style={styles.cell}>
            <Text style={[styles.label, { color: muted }]}>{cell.label}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${cell.label} ${cell.value}`}
              onPress={() => onPressKind(cell.kind)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.valueHit,
                pressed ? { opacity: 0.72 } : null,
              ]}
            >
              <RNText
                style={[styles.value, { color: accent }]}
                allowFontScaling={false}
                numberOfLines={1}
              >
                {cell.value}
              </RNText>
            </Pressable>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  year: {
    fontSize: 12,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  cell: {
    flex: 1,
    gap: 2,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
  },
  valueHit: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingVertical: 2,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    ...(Platform.OS === 'android' ? { includeFontPadding: false } : null),
  },
});
