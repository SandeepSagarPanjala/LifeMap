import {useCallback, useRef, useState} from 'react';
import {Alert, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {SavedPlacesEditSheet} from '@/components/map/SavedPlacesEditSheet';
import {SavedPlacesSheet} from '@/components/map/SavedPlacesSheet';
import {NativeHalfSheetShell} from '@/components/ui/NativeHalfSheetShell';
import {useNativeHalfSheetClose} from '@/components/ui/native-half-sheet-context';
import {
  deleteSavedPlace,
  type SavedPlaceRow,
  updateFavoritePlaceLabel,
} from '@/db/repositories/saved-places';
import {useSavedPlaces} from '@/hooks/use-saved-places';
import type {RootStackParamList} from '@/navigation/types';
import {NATIVE_HALF_SHEET_HEIGHT_RATIO} from '@/navigation/native-half-sheet-capture-options';
import {useSheetCaptureClose} from '@/screens/sheets/use-sheet-capture-close';

function SavedPlacesPanel({
  onSelectPlace,
  onBeginEdit,
}: {
  onSelectPlace: (place: SavedPlaceRow) => void;
  onBeginEdit: (place: SavedPlaceRow) => void;
}) {
  const closeSheet = useNativeHalfSheetClose();
  const {places, refresh: refreshSavedPlaces} = useSavedPlaces();

  const handleDelete = async (place: SavedPlaceRow) => {
    await deleteSavedPlace(place.id);
    await refreshSavedPlaces();
  };

  return (
    <SavedPlacesSheet
      visible
      places={places}
      onClose={closeSheet}
      onSelectPlace={onSelectPlace}
      onBeginEdit={onBeginEdit}
      onDelete={handleDelete}
    />
  );
}

export function SavedPlacesScreen() {
  const navigationClose = useSheetCaptureClose();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const pendingFocusPlaceIdRef = useRef<number | null>(null);
  const [editingPlace, setEditingPlace] = useState<SavedPlaceRow | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const {refresh: refreshSavedPlaces} = useSavedPlaces();

  const openEdit = useCallback((place: SavedPlaceRow) => {
    setEditingPlace(place);
    setEditSheetOpen(true);
  }, []);

  const handleEditDismissed = useCallback(() => {
    setEditingPlace(null);
    setEditSheetOpen(false);
  }, []);

  const finishClose = useCallback(() => {
    if (editSheetOpen) {
      return;
    }
    const focusPlaceId = pendingFocusPlaceIdRef.current;
    pendingFocusPlaceIdRef.current = null;
    navigationClose();
    if (focusPlaceId != null) {
      navigation.navigate({
        name: 'Map',
        params: {focusPlaceId},
        merge: true,
      });
    }
  }, [editSheetOpen, navigation, navigationClose]);

  const handleSelectPlace = useCallback((place: SavedPlaceRow) => {
    pendingFocusPlaceIdRef.current = place.id;
  }, []);

  const handleEditLabel = useCallback(
    async (place: SavedPlaceRow, label: string) => {
      try {
        await updateFavoritePlaceLabel(place.id, label);
        await refreshSavedPlaces();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not rename place';
        Alert.alert('Rename failed', message);
        throw error;
      }
    },
    [refreshSavedPlaces],
  );

  return (
    <View style={styles.root}>
      <View
        pointerEvents={editSheetOpen ? 'none' : 'auto'}
        style={styles.shellHost}>
        <NativeHalfSheetShell
          onClose={finishClose}
          backdropDismissEnabled={!editSheetOpen}
          heightRatio={NATIVE_HALF_SHEET_HEIGHT_RATIO}>
          <SavedPlacesPanel
            onSelectPlace={handleSelectPlace}
            onBeginEdit={openEdit}
          />
        </NativeHalfSheetShell>
      </View>
      <SavedPlacesEditSheet
        place={editingPlace}
        onClose={handleEditDismissed}
        onSave={handleEditLabel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  shellHost: {
    flex: 1,
  },
});
