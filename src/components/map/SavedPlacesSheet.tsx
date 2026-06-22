import {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {Trash2, Pencil} from 'lucide-react-native';

import {EditFavoriteLabelPanel} from '@/components/map/EditFavoriteLabelSheet';
import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {Text} from '@/components/ui/text';
import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import {SAVED_PLACE_MAP_STYLE} from '@/lib/saved-places-map';
import {useThemeColors} from '@/hooks/use-theme-colors';

type SavedPlacesSheetProps = {
  visible: boolean;
  places: SavedPlaceRow[];
  onClose: () => void;
  onSelectPlace: (place: SavedPlaceRow) => void;
  onEditLabel: (place: SavedPlaceRow, label: string) => Promise<void>;
  onDelete: (place: SavedPlaceRow) => Promise<void>;
  onWillClose?: () => void;
  snapPoints?: (string | number)[];
  instantPresent?: boolean;
  embedded?: boolean;
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
  onEditLabel,
  onDelete,
  onWillClose,
  snapPoints: snapPointsProp,
  instantPresent = false,
  embedded = false,
}: SavedPlacesSheetProps) {
  const colors = useThemeColors();
  const sorted = useMemo(() => sortPlaces(places), [places]);
  const [editingPlace, setEditingPlace] = useState<SavedPlaceRow | null>(null);
  const listSnapPoints = useMemo(
    () => snapPointsProp ?? (['50%'] as const),
    [snapPointsProp],
  );

  useEffect(() => {
    if (!visible) {
      setEditingPlace(null);
    }
  }, [visible]);

  const closeListSheet = useCallback(() => {
    setEditingPlace(null);
    onClose();
  }, [onClose]);

  const closeEditSheet = useCallback(() => {
    setEditingPlace(null);
  }, []);

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
            onDelete(place);
          },
        },
      ],
    );
  };

  const listContent = (
    <>
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
                    closeListSheet();
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
                    onPress={() => setEditingPlace(place)}
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
    </>
  );

  if (embedded) {
    if (!visible) {
      return null;
    }
    if (editingPlace != null) {
      return (
        <View style={styles.embeddedRoot}>
          <EditFavoriteLabelPanel
            key={editingPlace.id}
            initialValue={editingPlace.label}
            onClose={closeEditSheet}
            onSave={label => {
              onEditLabel(editingPlace, label).then(() => closeEditSheet());
            }}
          />
        </View>
      );
    }
    return (
      <ScrollView
        style={styles.embeddedRoot}
        contentContainerStyle={styles.embeddedScroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {listContent}
      </ScrollView>
    );
  }

  return (
    <>
      <AppBottomSheet
        name="saved-places-list"
        visible={visible}
        onClose={closeListSheet}
        onClosing={onWillClose}
        releaseTouchesWhileClosing={onWillClose != null}
        instantPresent={instantPresent}
        snapPoints={[...listSnapPoints]}
        scrollable>
        {listContent}
      </AppBottomSheet>

      <AppBottomSheet
        name="saved-places-edit"
        visible={editingPlace != null}
        onClose={closeEditSheet}
        stackBehavior="push"
        enableDynamicSizing
        keyboardBehavior="interactive"
        keyboardBlurBehavior="none">
        {editingPlace != null ? (
          <EditFavoriteLabelPanel
            key={editingPlace.id}
            initialValue={editingPlace.label}
            onClose={closeEditSheet}
            onSave={label => {
              onEditLabel(editingPlace, label).then(() => closeEditSheet());
            }}
          />
        ) : null}
      </AppBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    flex: 1,
  },
  embeddedScroll: {
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
  },
});
