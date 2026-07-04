import {useEffect, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Briefcase, Heart, Home} from 'lucide-react-native';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';

import {Text} from '@/components/ui/text';
import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import {useThemeColors} from '@/hooks/use-theme-colors';
import {MAX_SAVED_PLACE_LABEL_LENGTH} from '@/lib/app-constants';

type SavePlaceCoordinate = {
  latitude: number;
  longitude: number;
};

type SavePlaceSheetProps = {
  visible: boolean;
  coordinate: SavePlaceCoordinate | null;
  hasHome: boolean;
  hasWork: boolean;
  canSaveHome: boolean;
  canSaveWork: boolean;
  canSaveFavorite: boolean;
  isAtPlaceLimit: boolean;
  maxPlaces: number;
  onClose: () => void;
  onSaveHome: (coordinate: SavePlaceCoordinate) => Promise<void>;
  onSaveWork: (coordinate: SavePlaceCoordinate) => Promise<void>;
  onSaveFavorite: (
    coordinate: SavePlaceCoordinate,
    name: string,
  ) => Promise<void>;
};

export function SavePlaceSheet({
  visible,
  coordinate,
  hasHome,
  hasWork,
  canSaveHome,
  canSaveWork,
  canSaveFavorite,
  isAtPlaceLimit,
  maxPlaces,
  onClose,
  onSaveHome,
  onSaveWork,
  onSaveFavorite,
}: SavePlaceSheetProps) {
  const colors = useThemeColors();
  const [favoriteName, setFavoriteName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showFavoriteInput, setShowFavoriteInput] = useState(false);

  const reset = () => {
    setFavoriteName('');
    setShowFavoriteInput(false);
    setSaving(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const runSave = async (action: () => Promise<void>) => {
    if (coordinate == null || saving) {
      return;
    }
    setSaving(true);
    try {
      await action();
      close();
    } finally {
      setSaving(false);
    }
  };

  const sheetVisible = visible && coordinate != null;

  useEffect(() => {
    if (!sheetVisible) {
      setFavoriteName('');
      setShowFavoriteInput(false);
      setSaving(false);
    }
  }, [sheetVisible]);

  return (
    <AppBottomSheet
      visible={sheetVisible}
      onClose={close}
      enableDynamicSizing>
      {showFavoriteInput ? (
        <View style={styles.favoriteForm}>
          <Text variant="h4" className="border-0 pb-0">
            Name this favorite
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            150 m radius around this spot
          </Text>
          <BottomSheetTextInput
            autoFocus
            placeholder="Favorite name"
            placeholderTextColor="#8E8E93"
            value={favoriteName}
            onChangeText={setFavoriteName}
            style={styles.input}
            returnKeyType="done"
            maxLength={MAX_SAVED_PLACE_LABEL_LENGTH}
            accessibilityLabel="Map favorite name"
            onSubmitEditing={() => {
              if (favoriteName.trim().length > 0) {
                runSave(() =>
                  onSaveFavorite(coordinate!, favoriteName.trim()),
                );
              }
            }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save favorite place"
            disabled={saving || favoriteName.trim().length === 0}
            style={[
              styles.saveFavoriteBtn,
              {backgroundColor: colors.primary},
            ]}
            onPress={() =>
              runSave(() =>
                onSaveFavorite(coordinate!, favoriteName.trim()),
              )
            }>
            <Text className="text-primary-foreground text-center font-medium">
              Save Favorite
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowFavoriteInput(false)}>
            <Text variant="muted" className="text-center text-sm">
              Back
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text variant="h4" className="border-0 pb-0">
            Save this place
          </Text>
          <Text variant="muted" className="mt-1 text-sm">
            150 m radius · long-press anywhere on the map
          </Text>
          {isAtPlaceLimit ? (
            <Text variant="muted" className="mt-2 text-sm">
              {hasHome && hasWork
                ? `You have ${maxPlaces} saved places. Remove one from Places to add another.`
                : `You have ${maxPlaces} saved places. Remove one to add ${!hasHome ? 'Home' : 'Work'} or a Favorite.`}
            </Text>
          ) : null}
          <View style={styles.actions}>
            {!hasHome && canSaveHome ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark as Home"
                disabled={saving}
                style={styles.actionRow}
                onPress={() => runSave(() => onSaveHome(coordinate!))}>
                <Home size={20} color={colors.primary} strokeWidth={2.25} />
                <Text className="font-medium">Mark as Home</Text>
              </Pressable>
            ) : null}
            {!hasWork && canSaveWork ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark as Work"
                disabled={saving}
                style={styles.actionRow}
                onPress={() => runSave(() => onSaveWork(coordinate!))}>
                <Briefcase
                  size={20}
                  color={colors.primary}
                  strokeWidth={2.25}
                />
                <Text className="font-medium">Mark as Work</Text>
              </Pressable>
            ) : null}
            {canSaveFavorite ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add Favorite"
                disabled={saving}
                style={styles.actionRow}
                onPress={() => setShowFavoriteInput(true)}>
                <Heart
                  size={20}
                  color={colors.primary}
                  strokeWidth={2.25}
                  fill={colors.primary}
                />
                <Text className="font-medium">Add Favorite</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel save place"
            onPress={close}
            style={styles.cancelBtn}>
            <Text variant="muted" className="text-center font-medium">
              Cancel
            </Text>
          </Pressable>
        </>
      )}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 20,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  favoriteForm: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
    marginTop: 4,
  },
  saveFavoriteBtn: {
    borderRadius: 12,
    paddingVertical: 14,
  },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
});
