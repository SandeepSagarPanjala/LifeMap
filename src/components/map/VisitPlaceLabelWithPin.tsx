import { MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';

type VisitPlaceLabelWithPinProps = {
  name: string;
  showPin?: boolean;
};

export function VisitPlaceLabelWithPin({
  name,
  showPin = false,
}: VisitPlaceLabelWithPinProps) {
  return (
    <View style={styles.row}>
      {showPin ? (
        <MapPin size={13} color="#8E8E93" fill="#C7C7CC" strokeWidth={2} />
      ) : null}
      <Text
        className="text-base font-semibold"
        numberOfLines={1}
        style={styles.name}
      >
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
    flexShrink: 1,
  },
  name: {
    flexShrink: 1,
  },
});
