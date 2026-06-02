import {format} from 'date-fns';
import {Modal, Pressable, View} from 'react-native';

import type {LocationPointRow} from '@/db/repositories/location-days';
import {Text} from '@/components/ui/text';

type LocationPointSheetProps = {
  point: LocationPointRow | null;
  onClose: () => void;
};

export function LocationPointSheet({point, onClose}: LocationPointSheetProps) {
  return (
    <Modal visible={point != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="bg-card border-border rounded-t-3xl border px-5 pb-10 pt-5"
          onPress={event => event.stopPropagation()}>
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
                className="bg-primary mt-6 rounded-xl py-3">
                <Text className="text-primary-foreground text-center font-medium">Close</Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
