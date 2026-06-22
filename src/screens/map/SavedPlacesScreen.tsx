import {Alert} from 'react-native';
import {useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {SavedPlacesSheet} from '@/components/map/SavedPlacesSheet';
import {
  deleteSavedPlace,
  type SavedPlaceRow,
  updateFavoritePlaceLabel,
} from '@/db/repositories/saved-places';
import {useSavedPlaces} from '@/hooks/use-saved-places';
import type {RootStackParamList} from '@/navigation/types';
import {SheetCaptureScreen} from '@/screens/sheets/SheetCaptureScreen';
import {useSheetCaptureClose} from '@/screens/sheets/use-sheet-capture-close';

const HALF_SHEET_SNAP_POINTS = ['50%'] as const;

export function SavedPlacesScreen() {
  const [touchPassthrough, setTouchPassthrough] = useState(false);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const handleClose = useSheetCaptureClose();
  const {places, refresh: refreshSavedPlaces} = useSavedPlaces();

  const handleSelectPlace = (place: SavedPlaceRow) => {
    navigation.navigate({
      name: 'Map',
      params: {focusPlaceId: place.id},
      merge: true,
    });
  };

  const handleDelete = async (place: SavedPlaceRow) => {
    await deleteSavedPlace(place.id);
    await refreshSavedPlaces();
  };

  const handleEditLabel = async (place: SavedPlaceRow, label: string) => {
    try {
      await updateFavoritePlaceLabel(place.id, label);
      await refreshSavedPlaces();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not rename place';
      Alert.alert('Rename failed', message);
      throw error;
    }
  };

  return (
    <SheetCaptureScreen touchPassthrough={touchPassthrough}>
      <SavedPlacesSheet
        visible
        snapPoints={[...HALF_SHEET_SNAP_POINTS]}
        instantPresent
        onWillClose={() => setTouchPassthrough(true)}
        places={places}
        onClose={handleClose}
        onSelectPlace={handleSelectPlace}
        onEditLabel={handleEditLabel}
        onDelete={handleDelete}
      />
    </SheetCaptureScreen>
  );
}
