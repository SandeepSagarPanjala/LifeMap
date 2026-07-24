import { StyleSheet, View } from 'react-native';

import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { MAP_STACK_BUTTON_RIGHT } from '@/lib/app-constants';

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
    <MapGlassCircleButton
      accessibilityLabel="Go to current location"
      onPress={onPress}
      style={{ position: 'absolute', bottom, right: MAP_STACK_BUTTON_RIGHT }}
    >
      <MapUserLocationIcon />
    </MapGlassCircleButton>
  );
}

const styles = StyleSheet.create({
  puckRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.92)',
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
