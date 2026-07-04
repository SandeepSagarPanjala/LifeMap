import {useCallback, useRef, useState} from 'react';
import {APP_COPY, errorMessageOr} from '@/lib/app-copy';
import {Alert, StyleSheet, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {SavedPlacesEditSheet} from '@/components/map/SavedPlacesEditSheet';
import {AddSavedPlaceByAddressSheet} from '@/components/map/AddSavedPlaceByAddressSheet';
import type {AddSavedPlaceByAddressRequest} from '@/components/map/AddSavedPlaceByAddressSheet';
import {SavedPlacesSheet} from '@/components/map/SavedPlacesSheet';
import {NativeHalfSheetShell} from '@/components/ui/NativeHalfSheetShell';
import {useNativeHalfSheetClose} from '@/components/ui/native-half-sheet-context';
import {
  addFavoritePlace,
  deleteSavedPlace,
  type SavedPlaceRow,
  updateFavoritePlaceLabel,
  upsertHomePlace,
  upsertWorkPlace,
} from '@/db/repositories/saved-places';
import {useSavedPlaces} from '@/hooks/use-saved-places';
import {
  MAX_SAVED_PLACES,
  SavedPlaceLimitError,
  savedPlaceAddByAddressOptions,
} from '@/lib/saved-places';
import type {RootStackParamList} from '@/navigation/types';
import {NATIVE_HALF_SHEET_HEIGHT_RATIO} from '@/navigation/native-half-sheet-capture-options';
import {useSheetCaptureClose} from '@/screens/sheets/use-sheet-capture-close';

function SavedPlacesPanel({
  onSelectPlace,
  onBeginEdit,
  onAddByAddress,
}: {
  onSelectPlace: (place: SavedPlaceRow) => void;
  onBeginEdit: (place: SavedPlaceRow) => void;
  onAddByAddress: () => void;
}) {
  const closeSheet = useNativeHalfSheetClose();
  const {places, refresh: refreshSavedPlaces} = useSavedPlaces();
  const addOptions = savedPlaceAddByAddressOptions(places);

  const handleDelete = async (place: SavedPlaceRow) => {
    await deleteSavedPlace(place.id);
    await refreshSavedPlaces();
  };

  return (
    <SavedPlacesSheet
      visible
      places={places}
      canAddByAddress={addOptions.canAddByAddress}
      onClose={closeSheet}
      onSelectPlace={onSelectPlace}
      onBeginEdit={onBeginEdit}
      onDelete={handleDelete}
      onAddByAddress={() => {
        if (!addOptions.canAddByAddress) {
          Alert.alert(
            'Saved place limit reached',
            `You can save up to ${MAX_SAVED_PLACES} places.`,
          );
          return;
        }
        onAddByAddress();
      }}
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
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const {places, refresh: refreshSavedPlaces} = useSavedPlaces();
  const addByAddressOptions = savedPlaceAddByAddressOptions(places);

  const openEdit = useCallback((place: SavedPlaceRow) => {
    setEditingPlace(place);
    setEditSheetOpen(true);
  }, []);

  const handleEditDismissed = useCallback(() => {
    setEditingPlace(null);
    setEditSheetOpen(false);
  }, []);

  const finishClose = useCallback(() => {
    if (editSheetOpen || addressSheetOpen) {
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
  }, [addressSheetOpen, editSheetOpen, navigation, navigationClose]);

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
          error instanceof Error ? error.message : APP_COPY.alerts.couldNotRenamePlace;
        Alert.alert(APP_COPY.savedPlaces.renameFailed, message);
        throw error;
      }
    },
    [refreshSavedPlaces],
  );

  const handleAddByAddress = useCallback(
    async (request: AddSavedPlaceByAddressRequest) => {
      const addressLine = request.addressLine;
      try {
        if (request.kind === 'home') {
          await upsertHomePlace(
            request.lat,
            request.lng,
            undefined,
            addressLine,
          );
        } else if (request.kind === 'work') {
          await upsertWorkPlace(
            request.lat,
            request.lng,
            undefined,
            addressLine,
          );
        } else {
          const label = request.favoriteLabel?.trim();
          if (!label) {
            throw new Error('Favorite name is required');
          }
          await addFavoritePlace(
            request.lat,
            request.lng,
            label,
            undefined,
            addressLine,
          );
        }
        await refreshSavedPlaces();
      } catch (error) {
        if (error instanceof SavedPlaceLimitError) {
          Alert.alert(
            'Saved place limit reached',
            `You can save up to ${MAX_SAVED_PLACES} places.`,
          );
        } else if (error instanceof Error) {
          Alert.alert(APP_COPY.savedPlaces.couldNotSavePlace, error.message);
        }
        throw error;
      }
    },
    [refreshSavedPlaces],
  );

  const overlayOpen = editSheetOpen || addressSheetOpen;

  return (
    <View style={styles.root}>
      <View
        pointerEvents={overlayOpen ? 'none' : 'auto'}
        style={styles.shellHost}>
        <NativeHalfSheetShell
          onClose={finishClose}
          backdropDismissEnabled={!overlayOpen}
          heightRatio={NATIVE_HALF_SHEET_HEIGHT_RATIO}>
          <SavedPlacesPanel
            onSelectPlace={handleSelectPlace}
            onBeginEdit={openEdit}
            onAddByAddress={() => setAddressSheetOpen(true)}
          />
        </NativeHalfSheetShell>
      </View>
      <SavedPlacesEditSheet
        place={editingPlace}
        onClose={handleEditDismissed}
        onSave={handleEditLabel}
      />
      <AddSavedPlaceByAddressSheet
        visible={addressSheetOpen}
        options={addByAddressOptions}
        onClose={() => setAddressSheetOpen(false)}
        onSave={handleAddByAddress}
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
