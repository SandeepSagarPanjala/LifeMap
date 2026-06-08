import {Circle, Marker} from 'react-native-maps';
import {Fragment} from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import {SAVED_PLACE_MAP_STYLE} from '@/lib/saved-places-map';
import {HISTORY_COLORS} from '@/lib/history-timeline';

const MARKER_ANCHOR = {x: 0.5, y: 0.3} as const;
const CIRCLE_STROKE_WIDTH = 1.5;
const MARKER_LABEL_MAX_WIDTH = 84;

type SavedPlacesMapOverlayProps = {
  places: SavedPlaceRow[];
  showCircles: boolean;
  /** Hide the map pin when the callout label already shows this place. */
  hideMarkerPlaceId?: number | null;
};

export function SavedPlacesMapOverlay({
  places,
  showCircles,
  hideMarkerPlaceId = null,
}: SavedPlacesMapOverlayProps) {
  if (places.length === 0) {
    return null;
  }

  return (
    <>
      {places.map(place => {
        const style = SAVED_PLACE_MAP_STYLE[place.kind];
        const center = {latitude: place.lat, longitude: place.lng};
        const showMarker = hideMarkerPlaceId !== place.id;

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
            {showMarker ? (
              <Marker
                coordinate={center}
                anchor={MARKER_ANCHOR}
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
                    <SavedPlaceIcon kind={place.kind} size={16} color={style.icon} />
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
