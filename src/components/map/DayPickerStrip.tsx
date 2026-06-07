import {format, parseISO} from 'date-fns';
import {Pressable, ScrollView} from 'react-native';

import type {DaySummary} from '@/db/repositories/location-days';
import {Text} from '@/components/ui/text';

type DayPickerStripProps = {
  days: DaySummary[];
  selectedDateKey: string;
  onSelect: (dateKey: string) => void;
};

export function DayPickerStrip({days, selectedDateKey, onSelect}: DayPickerStripProps) {
  if (days.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-1 py-1">
      {days.map(day => {
        const selected = day.dateKey === selectedDateKey;
        const label = format(parseISO(day.dateKey), 'MMM d');

        return (
          <Pressable
            key={day.dateKey}
            accessibilityRole="button"
            onPress={() => onSelect(day.dateKey)}
            className={`rounded-full px-4 py-2 ${
              selected ? 'bg-primary' : 'bg-muted'
            }`}>
            <Text
              className={`text-sm font-medium ${
                selected ? 'text-primary-foreground' : 'text-foreground'
              }`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
