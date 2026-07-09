import { format } from 'date-fns';
import { Pressable, View } from 'react-native';

import type { LocationPointRow } from '@/db/repositories/location-days';
import { Text } from '@/components/ui/text';

type LocationPointListProps = {
  points: LocationPointRow[];
  selectedPointId?: number | null;
  onSelectPoint: (point: LocationPointRow) => void;
};

export function LocationPointList({
  points,
  selectedPointId,
  onSelectPoint,
}: LocationPointListProps) {
  if (points.length === 0) {
    return (
      <Text variant="muted" className="text-center text-sm">
        No location points for this day yet.
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {points.map(point => {
        const selected = selectedPointId === point.id;
        return (
          <Pressable
            key={point.id}
            accessibilityRole="button"
            onPress={() => onSelectPoint(point)}
            className={`rounded-xl border px-3 py-3 ${
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card'
            }`}
          >
            <Text
              className={selected ? 'text-primary font-medium' : 'font-medium'}
            >
              {format(point.timestamp, 'h:mm a')}
            </Text>
            <Text variant="muted" className="mt-1 text-sm">
              {point.accuracy != null && point.accuracy >= 0
                ? `±${Math.round(point.accuracy)} m`
                : 'Accuracy unknown'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
