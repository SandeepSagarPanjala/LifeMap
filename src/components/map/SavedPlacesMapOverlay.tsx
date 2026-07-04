import {useMarkerTracksViewChanges} from '@/hooks/use-marker-tracks-view-changes';
import {Marker} from 'react-native-maps';
import {Fragment} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {MomentCountsRow} from '@/components/moments/MomentCountsRow';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {
  countMomentTypes,
  type MomentCounts,
} from '@/lib/moments/moment-counts';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import {SAVED_PLACE_MAP_STYLE} from '@/lib/saved-places-map';
import {HISTORY_COLORS} from '@/lib/app-constants';

/** Geographic point stays on the home/work badge center — never changes with zoom. */
const SAVED_PLACE_MARKER_ANCHOR = {x: 0.5, y: 0.3} as const;
const MARKER_BADGE_SIZE = 32;
const MARKER_LABEL_GAP = 3;
const MARKER_LABEL_BLOCK_HEIGHT = 18;
const MARKER_COLUMN_HEIGHT =
  MARKER_BADGE_SIZE + MARKER_LABEL_GAP + MARKER_LABEL_BLOCK_HEIGHT;
const CLUSTER_ABOVE_BADGE_GAP = 10;
/** Extra lift so the bubble clears the home badge (not just the anchor point). */
const CLUSTER_EXTRA_LIFT = 32;
/** Bottom-center of bubble; y offset lifts it above the home badge. */
const CLUSTER_MARKER_ANCHOR = {x: 0.5, y: 1} as const;
const CLUSTER_MARKER_CENTER_OFFSET_Y = -(
  Math.round(MARKER_COLUMN_HEIGHT * SAVED_PLACE_MARKER_ANCHOR.y) +
  CLUSTER_ABOVE_BADGE_GAP +
  CLUSTER_EXTRA_LIFT
);
const MARKER_LABEL_MAX_WIDTH = 84;

export type SavedPlaceMomentClusterOnMap = {
  placeId: number;
  counts: MomentCounts;
  onPress?: () => void;
};

type SavedPlacesMapOverlayProps = {
  places: SavedPlaceRow[];
  /** Hide the map pin when the callout label already shows this place. */
  hideMarkerPlaceId?: number | null;
  momentClusters?: SavedPlaceMomentClusterOnMap[];
};

type SavedPlaceMomentClusterMarkerProps = {
  coordinate: {latitude: number; longitude: number};
  counts: MomentCounts;
  onPress?: () => void;
};

/** Re-measures when moment counts change so width/position stay centered on Home. */
function SavedPlaceMomentClusterMarker({
  coordinate,
  counts,
  onPress,
}: SavedPlaceMomentClusterMarkerProps) {
  const layoutSignature = [
    countMomentTypes(counts),
    counts.photo,
    counts.video,
    counts.voice,
    counts.note,
    counts.activity,
  ].join('-');
  const {tracksViewChanges, onLayout} =
    useMarkerTracksViewChanges(layoutSignature);

  return (
    <Marker
      coordinate={coordinate}
      anchor={CLUSTER_MARKER_ANCHOR}
      centerOffset={{x: 0, y: CLUSTER_MARKER_CENTER_OFFSET_Y}}
      zIndex={9}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}>
      <View collapsable={false} onLayout={onLayout}>
        <View style={styles.clusterBubble}>
          <MomentCountsRow counts={counts} layout="stacked" dense />
        </View>
      </View>
    </Marker>
  );
}

export function SavedPlacesMapOverlay({
  places,
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
          return null;
        }

        return (
          <Fragment key={place.id}>
            {showCluster ? (
              <SavedPlaceMomentClusterMarker
                key={[
                  countMomentTypes(cluster.counts),
                  cluster.counts.photo,
                  cluster.counts.video,
                  cluster.counts.voice,
                  cluster.counts.note,
                  cluster.counts.activity,
                ].join('-')}
                coordinate={center}
                counts={cluster.counts}
                onPress={cluster.onPress}
              />
            ) : null}
            {showMarker ? (
              <Marker
                coordinate={center}
                anchor={SAVED_PLACE_MARKER_ANCHOR}
                zIndex={6}
                tracksViewChanges={false}>
                <View style={styles.markerColumn} collapsable={false}>
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
    width: MARKER_LABEL_MAX_WIDTH,
  },
  clusterBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
  },
  markerBadge: {
    width: MARKER_BADGE_SIZE,
    height: MARKER_BADGE_SIZE,
    borderRadius: MARKER_BADGE_SIZE / 2,
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
    marginTop: MARKER_LABEL_GAP,
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
