import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

/** Same blue as the system map user-location puck and locate button. */
const MAP_USER_LOCATION_BLUE = '#007AFF';

type UserLocationPuckProps = {
  coordinate: { latitude: number; longitude: number };
};

/**
 * Custom blue puck without MapKit's GPS accuracy halo.
 * `showsUserLocation` draws a giant translucent circle when accuracy is poor
 * (common indoors) — that flash on History exit is this halo, not a bug overlay.
 */
export const UserLocationPuck = memo(function UserLocationPuck({
  coordinate,
}: UserLocationPuckProps) {
  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={20}
      tracksViewChanges={false}
      flat
      tappable={false}
    >
      <View style={styles.halo} pointerEvents="none">
        <View style={styles.ring}>
          <View style={styles.core} />
        </View>
      </View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  halo: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.28,
    shadowRadius: 2,
    elevation: 3,
  },
  core: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: MAP_USER_LOCATION_BLUE,
  },
});
