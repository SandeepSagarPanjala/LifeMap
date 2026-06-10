import {Armchair, MapPin} from 'lucide-react-native';
import {StyleSheet, Text, View} from 'react-native';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import type {DriveEndpointLabel} from '@/lib/drive-endpoint-label';
import {HISTORY_COLORS} from '@/lib/history-timeline';
import {SAVED_PLACE_MAP_STYLE} from '@/lib/saved-places-map';

type DriveEndpointPlaceRowProps = {
  label: DriveEndpointLabel;
  iconSize?: number;
  textStyle?: object;
};

export function DriveEndpointPlaceRow({
  label,
  iconSize = 12,
  textStyle,
}: DriveEndpointPlaceRowProps) {
  if (!label.text) {
    return null;
  }

  if (label.savedPlace) {
    const accent = SAVED_PLACE_MAP_STYLE[label.savedPlace.kind];
    return (
      <View style={styles.row}>
        <SavedPlaceIcon
          kind={label.savedPlace.kind}
          size={iconSize}
          color={accent.icon}
        />
        <Text style={[styles.text, textStyle]} numberOfLines={1}>
          {label.text}
        </Text>
      </View>
    );
  }

  if (label.pinned) {
    return (
      <View style={styles.row}>
        <MapPin
          size={iconSize}
          color="#8E8E93"
          fill="#C7C7CC"
          strokeWidth={2}
        />
        <Text style={[styles.text, textStyle]} numberOfLines={1}>
          {label.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Armchair size={iconSize} color={HISTORY_COLORS.stay} strokeWidth={2.25} />
      <Text style={[styles.text, textStyle]} numberOfLines={1}>
        {label.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  text: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
});
