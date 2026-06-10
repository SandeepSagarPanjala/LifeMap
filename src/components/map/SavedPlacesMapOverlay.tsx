import {Circle, Marker} from 'react-native-maps';
import {Fragment} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {MomentCountsRow} from '@/components/moments/MomentCountsRow';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import type {MomentCounts} from '@/lib/moments/moment-counts';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import {SAVED_PLACE_MAP_STYLE} from '@/lib/saved-places-map';
import {HISTORY_COLORS} from '@/lib/history-timeline';

/** Same anchor for every saved place — pin sticks to saved lat/lng like Sravani Work. */
const SAVED_PLACE_MARKER_ANCHOR = {x: 0.5, y: 0.3} as const;
/** Lift cluster pill above the saved-place badge (Marker.onPress — not Pressable inside Marker). */
const CLUSTER_MARKER_ANCHOR = {x: 0.5, y: 1} as const;
const CLUSTER_MARKER_CENTER_OFFSET = {x: 0, y: -22} as const;
const CIRCLE_STROKE_WIDTH = 1.5;
const MARKER_LABEL_MAX_WIDTH = 84;

export type SavedPlaceMomentClusterOnMap = {
  placeId: number;
  counts: MomentCounts;
  onPress?: () => void;
};

type SavedPlacesMapOverlayProps = {
  places: SavedPlaceRow[];
  showCircles: boolean;
  /** Hide the map pin when the callout label already shows this place. */
  hideMarkerPlaceId?: number | null;
  momentClusters?: SavedPlaceMomentClusterOnMap[];
};

export function SavedPlacesMapOverlay({
  places,
  showCircles,
  hideMarkerPlaceId = null,
  momentClusters = [],
}: SavedPlacesMapOverlayProps) {
  if (places.length === 0) {
    return null;
  }

  const clusterByPlaceId = new Map(
    momentClusters.map(cluster => [cluster.placeId, cluster]),
  );

  return (
    <>
      {places.map(place => {
        const style = SAVED_PLACE_MAP_STYLE[place.kind];
        const center = {latitude: place.lat, longitude: place.lng};
        const showMarker = hideMarkerPlaceId !== place.id;
        const cluster = clusterByPlaceId.get(place.id);
        const showCluster = cluster != null;

        if (!showMarker && !showCluster) {
          return (
            <Fragment key={place.id}>
              {showCircles ? (
                <Circle
                  center={center}
                  radius={place.radiusMeters}
                  fillColor={style.fill}
                  strokeColor={style.stroke}
                  strokeWidth={CIRCLE_STROKE_WIDTH}
                  zIndex={1}
                />
              ) : null}
            </Fragment>
          );
        }

        return (
          <Fragment key={place.id}>
            {showCircles ? (
              <Circle
                center={center}
                radius={place.radiusMeters}
                fillColor={style.fill}
                strokeColor={style.stroke}
                strokeWidth={CIRCLE_STROKE_WIDTH}
                zIndex={1}
              />
            ) : null}
            {showCluster ? (
              <Marker
                coordinate={center}
                anchor={CLUSTER_MARKER_ANCHOR}
                centerOffset={CLUSTER_MARKER_CENTER_OFFSET}
                zIndex={9}
                tracksViewChanges={false}
                onPress={
                  cluster.onPress ? () => cluster.onPress!() : undefined
                }>
                <View style={styles.clusterBubble}>
                  <MomentCountsRow counts={cluster.counts} compact />
                </View>
              </Marker>
            ) : null}
            {showMarker ? (
              <Marker
                coordinate={center}
                anchor={SAVED_PLACE_MARKER_ANCHOR}
                zIndex={6}
                tracksViewChanges={false}>
                <View style={styles.markerColumn}>
                  <View
                    style={[
                      styles.markerBadge,
                      {
                        backgroundColor: style.badgeBg,
                        borderColor: style.stroke,
                      },
                    ]}>
                    <SavedPlaceIcon
                      kind={place.kind}
                      size={16}
                      color={style.icon}
                    />
                  </View>
                  <View style={[styles.labelPill, {borderColor: style.stroke}]}>
                    <Text
                      style={styles.labelText}
                      numberOfLines={1}
                      ellipsizeMode="tail">
                      {savedPlaceDisplayLabel(place)}
                    </Text>
                  </View>
                </View>
              </Marker>
            ) : null}
          </Fragment>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  markerColumn: {
    alignItems: 'center',
    maxWidth: MARKER_LABEL_MAX_WIDTH,
  },
  clusterBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  markerBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  labelPill: {
    marginTop: 3,
    maxWidth: MARKER_LABEL_MAX_WIDTH,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  labelText: {
    fontSize: 10,
    fontWeight: '600',
    color: HISTORY_COLORS.playhead,
    textAlign: 'center',
  },
});
