import {useMemo} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Trash2, Pencil} from 'lucide-react-native';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {Text} from '@/components/ui/text';
import {BOTTOM_SHEET_SURFACE} from '@/components/ui/bottom-sheet-chrome';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import {SAVED_PLACE_MAP_STYLE} from '@/lib/saved-places-map';
import {useThemeColors} from '@/hooks/use-theme-colors';

type SavedPlacesSheetProps = {
  visible: boolean;
  places: SavedPlaceRow[];
  onClose: () => void;
  onSelectPlace: (place: SavedPlaceRow) => void;
  onBeginEdit: (place: SavedPlaceRow) => void;
  onDelete: (place: SavedPlaceRow) => Promise<void>;
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
  onClose,
  onSelectPlace,
  onBeginEdit,
  onDelete,
}: SavedPlacesSheetProps) {
  const colors = useThemeColors();
  const sorted = useMemo(() => sortPlaces(places), [places]);

  const confirmDelete = (place: SavedPlaceRow) => {
    Alert.alert(
      `Remove ${savedPlaceDisplayLabel(place)}?`,
      'Visits here will show times only, without this label.',
      [
        {text: 'Cancel', style: 'cancel'},
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
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <Text variant="h4" className="border-0 pb-0">
        Saved places
      </Text>
      <Text variant="muted" className="mt-1 text-sm">
        Long-press the map to add Home, Work, or a Favorite.
      </Text>

      {sorted.length === 0 ? (
        <Text variant="muted" className="mt-6 text-sm">
          No saved places yet.
        </Text>
      ) : (
        <View style={styles.list}>
          {sorted.map(place => {
            const accent = SAVED_PLACE_MAP_STYLE[place.kind];
            return (
              <View key={place.id} style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${savedPlaceDisplayLabel(place)} on map`}
                  onPress={() => {
                    onSelectPlace(place);
                    onClose();
                  }}
                  style={styles.rowTap}>
                  <View
                    style={[
                      styles.iconOrb,
                      {backgroundColor: accent.badgeBg},
                    ]}>
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
                        numberOfLines={2}>
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
                    style={styles.actionBtn}>
                    <Pencil
                      size={18}
                      color={colors.primary}
                      strokeWidth={2.25}
                    />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${place.label}`}
                  onPress={() => confirmDelete(place)}
                  style={styles.actionBtn}>
                  <Trash2
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
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: BOTTOM_SHEET_SURFACE.contentPaddingHorizontal,
    paddingTop: BOTTOM_SHEET_SURFACE.contentPaddingTop,
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
});
