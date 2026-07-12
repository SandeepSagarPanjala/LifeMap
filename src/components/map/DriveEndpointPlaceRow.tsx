import { StyleSheet, Text, View } from 'react-native';

import { SavedPlaceIcon } from '@/components/map/SavedPlaceIcon';
import { VisitPlaceKindIcon } from '@/components/map/VisitPlaceKindIcon';
import type { DriveEndpointLabel } from '@/lib/drive-endpoint-label';
import { SAVED_PLACE_MAP_STYLE } from '@/lib/saved-places-map';

type DriveEndpointPlaceRowProps = {
  label: DriveEndpointLabel;
  iconSize?: number;
  textStyle?: object;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  align?: 'left' | 'right';
};

export function DriveEndpointPlaceRow({
  label,
  iconSize = 12,
  textStyle,
  numberOfLines = 1,
  ellipsizeMode = 'tail',
  align = 'left',
}: DriveEndpointPlaceRowProps) {
  if (!label.text) {
    return null;
  }

  const rowStyle = [
    styles.row,
    align === 'right' ? styles.rowRight : null,
    align === 'right' ? styles.rowFullWidth : null,
  ];
  const textAlignStyle = align === 'right' ? styles.textRight : null;

  if (label.savedPlace) {
    const accent = SAVED_PLACE_MAP_STYLE[label.savedPlace.kind];
    return (
      <View style={rowStyle}>
        <SavedPlaceIcon
          kind={label.savedPlace.kind}
          size={iconSize}
          color={accent.icon}
        />
        <Text
          style={[styles.text, textStyle, textAlignStyle]}
          numberOfLines={numberOfLines}
          ellipsizeMode={ellipsizeMode}
        >
          {label.text}
        </Text>
      </View>
    );
  }

  return (
    <View style={rowStyle}>
      <VisitPlaceKindIcon
        pinned={label.pinned}
        category={label.poiCategory}
        size={iconSize}
      />
      <Text
        style={[styles.text, textStyle, textAlignStyle]}
        numberOfLines={numberOfLines}
        ellipsizeMode={ellipsizeMode}
      >
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
    minWidth: 0,
    maxWidth: '100%',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  rowFullWidth: {
    width: '100%',
  },
  text: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  textRight: {
    textAlign: 'right',
  },
});
