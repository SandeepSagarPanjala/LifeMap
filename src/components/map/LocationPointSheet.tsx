import { format } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import type { LocationPointRow } from '@/db/repositories/location-days';
import { Text } from '@/components/ui/text';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';

type LocationPointSheetProps = {
  point: LocationPointRow | null;
  onClose: () => void;
};

export function LocationPointSheet({
  point,
  onClose,
}: LocationPointSheetProps) {
  return (
    <AppBottomSheet
      visible={point != null}
      onClose={onClose}
      enableDynamicSizing
    >
      {point ? (
        <>
          <Text variant="h4" className="border-0 pb-0">
            {format(point.timestamp, 'h:mm a')}
          </Text>
          <Text variant="muted" className="mt-2">
            {format(point.timestamp, 'EEEE, MMMM d, yyyy')}
          </Text>
          <View className="mt-4 gap-2">
            <Text className="text-sm">
              Accuracy:{' '}
              {point.accuracy != null && point.accuracy >= 0
                ? `${Math.round(point.accuracy)} m`
                : 'Unknown'}
            </Text>
            <Text className="text-sm">
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </Text>
            {point.speed != null && point.speed >= 0 ? (
              <Text className="text-sm">
                Speed: {Math.round(point.speed * 3.6)} km/h
              </Text>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={styles.closeBtn}
          >
            <Text className="text-primary-foreground text-center font-medium">
              Close
            </Text>
          </Pressable>
        </>
      ) : null}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  closeBtn: {
    marginTop: 24,
    borderRadius: 12,
    backgroundColor: '#6B4EFF',
    paddingVertical: 12,
  },
});
