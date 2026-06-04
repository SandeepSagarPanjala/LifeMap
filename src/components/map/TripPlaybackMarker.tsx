import {Marker} from 'react-native-maps';
import {StyleSheet, View} from 'react-native';

import type {MapCoordinate} from '@/lib/location-geo';

type TripPlaybackMarkerProps = {
  coordinate: MapCoordinate;
  heading?: number;
};

export function TripPlaybackMarker({coordinate, heading = 0}: TripPlaybackMarkerProps) {
  return (
    <Marker coordinate={coordinate} anchor={{x: 0.5, y: 0.5}} flat tracksViewChanges={false}>
      <View style={[styles.dot, {transform: [{rotate: `${heading}deg`}]}]}>
        <View style={styles.ring} />
        <View style={styles.core} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.25)',
  },
  core: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#007AFF',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
});
