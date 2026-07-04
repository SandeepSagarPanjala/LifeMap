import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Trash2, Pencil } from 'lucide-react-native';

import { SavedPlaceIcon } from '@/components/map/SavedPlaceIcon';
import { SavedPlacesEmptyState } from '@/components/map/SavedPlacesEmptyState';
import { Text } from '@/components/ui/text';
import { BOTTOM_SHEET_SURFACE } from '@/lib/app-constants';
import type { SavedPlaceRow } from '@/db/repositories/saved-places';
import { savedPlaceDisplayLabel } from '@/lib/saved-places';
import { SAVED_PLACE_MAP_STYLE } from '@/lib/saved-places-map';
import { useThemeColors } from '@/hooks/use-theme-colors';

type SavedPlacesSheetProps = {
  visible: boolean;
  places: SavedPlaceRow[];
  canAddByAddress: boolean;
  onClose: () => void;
  onSelectPlace: (place: SavedPlaceRow) => void;
  onBeginEdit: (place: SavedPlaceRow) => void;
  onDelete: (place: SavedPlaceRow) => Promise<void>;
  onAddByAddress: () => void;
};

function sortPlaces(places: SavedPlaceRow[]): SavedPlaceRow[] {
  const order: Record<SavedPlaceRow['kind'], number> = {
    home: 0,
    work: 1,
    favorite: 2,
  };
  return [...places].sort((a, b) => {
    const kindDiff = order[a.kind] - order[b.kind];
    if (kindDiff !== 0) {
      return kindDiff;
    }
    return a.label.localeCompare(b.label);
  });
}

export function SavedPlacesSheet({
  visible,
  places,
  canAddByAddress,
  onClose,
  onSelectPlace,
  onBeginEdit,
  onDelete,
  onAddByAddress,
}: SavedPlacesSheetProps) {
  const colors = useThemeColors();
  const sorted = useMemo(() => sortPlaces(places), [places]);

  const confirmDelete = (place: SavedPlaceRow) => {
    Alert.alert(
      `Remove ${savedPlaceDisplayLabel(place)}?`,
      'Visits here will show times only, without this label.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void onDelete(place);
          },
        },
      ],
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="h4" className="border-0 pb-0">
          Saved places
        </Text>
        {sorted.length > 0 ? (
          <Text variant="muted" className="mt-1 text-sm">
            Long-press the map to add Home, Work, or a Favorite.
          </Text>
        ) : null}

        {sorted.length === 0 ? (
          <SavedPlacesEmptyState />
        ) : (
          <View style={styles.list}>
            {sorted.map(place => {
              const accent = SAVED_PLACE_MAP_STYLE[place.kind];
              return (
                <View key={place.id} style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${savedPlaceDisplayLabel(
                      place,
                    )} on map`}
                    onPress={() => {
                      onSelectPlace(place);
                      onClose();
                    }}
                    style={styles.rowTap}
                  >
                    <View
                      style={[
                        styles.iconOrb,
                        { backgroundColor: accent.badgeBg },
                      ]}
                    >
                      <SavedPlaceIcon
                        kind={place.kind}
                        size={18}
                        color={accent.icon}
                      />
                    </View>
                    <View style={styles.rowText}>
                      <Text className="font-medium">
                        {savedPlaceDisplayLabel(place)}
                      </Text>
                      {place.addressLine != null ? (
                        <Text
                          variant="muted"
                          className="text-xs"
                          numberOfLines={2}
                        >
                          {place.addressLine}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  {place.kind === 'favorite' ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Rename ${place.label}`}
                      onPress={() => onBeginEdit(place)}
                      style={styles.actionBtn}
                    >
                      <Pencil
                        accessible={false}
                        size={18}
                        color={colors.primary}
                        strokeWidth={2.25}
                      />
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${savedPlaceDisplayLabel(
                      place,
                    )}`}
                    onPress={() => confirmDelete(place)}
                    style={styles.actionBtn}
                  >
                    <Trash2
                      accessible={false}
                      size={18}
                      color={colors.primary}
                      strokeWidth={2.25}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Add saved place by address"
        disabled={!canAddByAddress}
        onPress={onAddByAddress}
        style={[
          styles.addByAddressLink,
          !canAddByAddress && styles.addByAddressLinkDisabled,
        ]}
      >
        <Text
          className="text-center text-sm font-medium"
          style={{ color: canAddByAddress ? colors.primary : '#8E8E93' }}
        >
          Add by address
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: BOTTOM_SHEET_SURFACE.contentPaddingHorizontal,
    paddingTop: BOTTOM_SHEET_SURFACE.contentPaddingTop,
  },
  scrollArea: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 8,
  },
  list: {
    marginTop: 16,
    gap: 8,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  rowText: {
    flex: 1,
  },
  rowTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  iconOrb: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
  },
  addByAddressLink: {
    paddingTop: 12,
    paddingBottom: 20,
    marginBottom: 4,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addByAddressLinkDisabled: {
    opacity: 0.45,
  },
});
