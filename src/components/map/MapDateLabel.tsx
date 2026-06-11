import {StyleSheet, Text, View} from 'react-native';

import {
  MAP_SETTINGS_SIZE,
  MAP_SETTINGS_TOP_GAP,
} from '@/screens/map/map-screen-constants';

type MapDateLabelProps = {
  label: string;
  topInset: number;
};

export function MapDateLabel({label, topInset}: MapDateLabelProps) {
  const top = topInset + MAP_SETTINGS_TOP_GAP;

  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel={`Map showing ${label}`}
      style={[styles.wrap, {top, height: MAP_SETTINGS_SIZE}]}>
      <View style={styles.pill}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    maxWidth: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    textAlign: 'center',
  },
});
