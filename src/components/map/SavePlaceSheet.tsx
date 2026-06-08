import {useState} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {Briefcase, Heart, Home} from 'lucide-react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Text} from '@/components/ui/text';
import {useThemeColors} from '@/hooks/use-theme-colors';

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
  const insets = useSafeAreaInsets();
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

  return (
    <Modal
      visible={visible && coordinate != null}
      transparent
      animationType="fade"
      onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={insets.top}>
        <Pressable
          style={[
            styles.backdrop,
            showFavoriteInput ? styles.backdropCentered : null,
          ]}
          onPress={close}>
          <Pressable
            style={[
              showFavoriteInput ? styles.centerCard : styles.sheet,
              showFavoriteInput && {marginTop: insets.top + 24},
            ]}
            onPress={event => event.stopPropagation()}>
            {showFavoriteInput ? (
              <View style={styles.favoriteForm}>
                <Text variant="h4" className="border-0 pb-0">
                  Name this favorite
                </Text>
                <Text variant="muted" className="mt-1 text-sm">
                  150 m radius around this spot
                </Text>
                <TextInput
                  autoFocus
                  placeholder="Favorite name"
                  placeholderTextColor="#8E8E93"
                  value={favoriteName}
                  onChangeText={setFavoriteName}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (favoriteName.trim().length > 0) {
                      void runSave(() =>
                        onSaveFavorite(coordinate!, favoriteName.trim()),
                      );
                    }
                  }}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={saving || favoriteName.trim().length === 0}
                  style={[
                    styles.saveFavoriteBtn,
                    {backgroundColor: colors.primary},
                  ]}
                  onPress={() =>
                    void runSave(() =>
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
                      disabled={saving}
                      style={styles.actionRow}
                      onPress={() =>
                        void runSave(() => onSaveHome(coordinate!))
                      }>
                      <Home size={20} color={colors.primary} strokeWidth={2.25} />
                      <Text className="font-medium">Mark as Home</Text>
                    </Pressable>
                  ) : null}
                  {!hasWork && canSaveWork ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={saving}
                      style={styles.actionRow}
                      onPress={() =>
                        void runSave(() => onSaveWork(coordinate!))
                      }>
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
                  onPress={close}
                  style={styles.cancelBtn}>
                  <Text variant="muted" className="text-center font-medium">
                    Cancel
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdropCentered: {
    justifyContent: 'flex-start',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
    marginTop: 'auto',
  },
  centerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
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
