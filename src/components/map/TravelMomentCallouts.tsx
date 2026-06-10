import {Marker} from 'react-native-maps';
import {StyleSheet, View} from 'react-native';

import {MomentCountsRow} from '@/components/moments/MomentCountsRow';
import type {TravelMomentMarker} from '@/lib/moments/moment-counts';
import {hasMomentCounts} from '@/lib/moments/moment-counts';

const MARKER_ANCHOR = {x: 0.5, y: 0.5} as const;

type TravelMomentCalloutsProps = {
  markers: TravelMomentMarker[];
  onPressMarker?: (marker: TravelMomentMarker) => void;
};

export function TravelMomentCallouts({
  markers,
  onPressMarker,
}: TravelMomentCalloutsProps) {
  if (markers.length === 0) {
    return null;
  }

  return (
    <>
      {markers.map(marker => {
        const tappable = onPressMarker != null && hasMomentCounts(marker.counts);

        return (
          <Marker
            key={marker.key}
            coordinate={marker.coordinate}
            anchor={MARKER_ANCHOR}
            zIndex={8}
            tracksViewChanges={false}
            onPress={tappable ? () => onPressMarker(marker) : undefined}>
            <View style={styles.bubble} collapsable={false}>
              <MomentCountsRow
                counts={marker.counts}
                compact
                onPress={tappable ? () => onPressMarker(marker) : undefined}
              />
            </View>
          </Marker>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
});
