import { Pressable, StyleSheet, View } from 'react-native';

/** Same blue as the system map user-location puck and drive accents. */
const MAP_USER_LOCATION_BLUE = '#007AFF';

type MapLocateButtonProps = {
  bottom: number;
  onPress: () => void;
};

/** Mini map puck — matches `showsUserLocation` dot (blue fill, white ring). */
function MapUserLocationIcon() {
  return (
    <View style={styles.puckRing}>
      <View style={styles.puckCore} />
    </View>
  );
}

export function MapLocateButton({ bottom, onPress }: MapLocateButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go to current location"
      onPress={onPress}
      style={[styles.button, { bottom }]}
    >
      <MapUserLocationIcon />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  puckRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
  },
  puckCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: MAP_USER_LOCATION_BLUE,
  },
});
