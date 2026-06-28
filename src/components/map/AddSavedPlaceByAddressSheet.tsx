import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet';
import type {BottomSheetModal} from '@gorhom/bottom-sheet';
import {BottomSheetTextInput} from '@gorhom/bottom-sheet';
import {Briefcase, Heart, Home} from 'lucide-react-native';

import {AppBottomSheet} from '@/components/ui/app-bottom-sheet';
import {Text} from '@/components/ui/text';
import type {SavedPlaceKind} from '@/db/repositories/saved-places';
import {useThemeColors} from '@/hooks/use-theme-colors';
import type {AddressGeocodeResult} from '@/lib/place-lookup-types';
import {fetchAddressGeocode} from '@/lib/place-lookup-native';
import {
  MAX_SAVED_PLACE_LABEL_LENGTH,
  type SavedPlaceAddByAddressOptions,
} from '@/lib/saved-places';

const MIN_ADDRESS_LENGTH = 5;

export type AddSavedPlaceByAddressRequest = {
  kind: SavedPlaceKind;
  lat: number;
  lng: number;
  addressLine: string | null;
  favoriteLabel?: string;
};

type Step = 'address' | 'results' | 'save';

type AddSavedPlaceByAddressPanelProps = {
  options: SavedPlaceAddByAddressOptions;
  onClose: () => void;
  onSave: (request: AddSavedPlaceByAddressRequest) => Promise<void>;
};

function defaultKind(options: SavedPlaceAddByAddressOptions): SavedPlaceKind {
  if (options.canSaveHome) {
    return 'home';
  }
  if (options.canSaveWork) {
    return 'work';
  }
  return 'favorite';
}

function AddSavedPlaceByAddressPanel({
  options,
  onClose,
  onSave,
}: AddSavedPlaceByAddressPanelProps) {
  const colors = useThemeColors();
  const [step, setStep] = useState<Step>('address');
  const [address, setAddress] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [results, setResults] = useState<AddressGeocodeResult[]>([]);
  const [selectedResult, setSelectedResult] =
    useState<AddressGeocodeResult | null>(null);
  const [kind, setKind] = useState<SavedPlaceKind>(() => defaultKind(options));
  const [favoriteLabel, setFavoriteLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const trimmedAddress = address.trim();
  const trimmedFavoriteLabel = favoriteLabel.trim();
  const canLookup =
    trimmedAddress.length >= MIN_ADDRESS_LENGTH && !lookingUp && !saving;

  const showHome = options.canSaveHome;
  const showWork = options.canSaveWork;
  const showFavorite = options.canSaveFavorite;
  const onlyFavorite = showFavorite && !showHome && !showWork;

  useEffect(() => {
    if (onlyFavorite) {
      setKind('favorite');
    }
  }, [onlyFavorite]);

  const canSave = useMemo(() => {
    if (selectedResult == null || saving || lookingUp) {
      return false;
    }
    if (kind === 'favorite') {
      return (
        trimmedFavoriteLabel.length > 0 &&
        trimmedFavoriteLabel.length <= MAX_SAVED_PLACE_LABEL_LENGTH
      );
    }
    return kind === 'home' ? showHome : kind === 'work' ? showWork : false;
  }, [
    kind,
    lookingUp,
    saving,
    selectedResult,
    showHome,
    showWork,
    trimmedFavoriteLabel,
  ]);

  const handleLookup = async () => {
    if (!canLookup) {
      return;
    }
    setLookingUp(true);
    setLookupError(null);
    try {
      const matches = await fetchAddressGeocode(trimmedAddress);
      if (matches.length === 0) {
        setLookupError(
          'No matches found. Add city and state, or try a more specific address.',
        );
        return;
      }
      setResults(matches);
      if (matches.length === 1) {
        setSelectedResult(matches[0]!);
        setStep('save');
        return;
      }
      setSelectedResult(null);
      setStep('results');
    } catch {
      setLookupError('Could not look up that address. Try again.');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSave = async () => {
    if (!canSave || selectedResult == null) {
      return;
    }
    setSaving(true);
    try {
      await onSave({
        kind,
        lat: selectedResult.lat,
        lng: selectedResult.lng,
        addressLine: selectedResult.addressLine,
        favoriteLabel:
          kind === 'favorite' ? trimmedFavoriteLabel : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (step === 'save' && results.length > 1) {
      setStep('results');
      return;
    }
    if (step === 'results' || step === 'save') {
      setStep('address');
      setResults([]);
      setSelectedResult(null);
      setLookupError(null);
    }
  };

  return (
    <View accessibilityLabel="Add saved place by address form">
      <Text className="text-lg font-semibold">Add by address</Text>
      {step === 'address' ? (
        <View>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Enter a street address or place name. City and state help narrow
            results; zip code is optional.
          </Text>
          <View>
            <BottomSheetTextInput
              autoFocus
              value={address}
              onChangeText={text => {
                setAddress(text);
                setLookupError(null);
              }}
              placeholder="3925 N Elm St, Denton, TX"
              placeholderTextColor="#8E8E93"
              style={styles.input}
              returnKeyType="search"
              editable={!lookingUp && !saving}
              accessibilityLabel="Saved place address"
            />
          </View>
          {lookupError != null ? (
            <Text className="mt-2 text-sm text-red-600">{lookupError}</Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel add by address"
              onPress={onClose}
              disabled={lookingUp || saving}
              style={[styles.button, styles.cancelButton]}>
              <Text className="font-medium">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Look up address"
              disabled={!canLookup}
              onPress={() => void handleLookup()}
              style={[
                styles.button,
                styles.saveButton,
                !canLookup && styles.saveButtonDisabled,
              ]}>
              {lookingUp ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-semibold text-white">Continue</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 'results' ? (
        <View>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Multiple matches found. Pick the correct one.
          </Text>
          <ScrollView style={styles.resultsList} nestedScrollEnabled>
            {results.map((result, index) => {
              const label =
                result.addressLine ??
                `${result.lat.toFixed(5)}, ${result.lng.toFixed(5)}`;
              const selected =
                selectedResult?.lat === result.lat &&
                selectedResult?.lng === result.lng;
              return (
                <Pressable
                  key={`${result.lat}-${result.lng}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${label}`}
                  onPress={() => setSelectedResult(result)}
                  style={[
                    styles.resultRow,
                    selected && styles.resultRowSelected,
                  ]}>
                  <Text className={selected ? 'font-medium' : undefined}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to address"
              onPress={goBack}
              style={[styles.button, styles.cancelButton]}>
              <Text className="font-medium">Back</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue with selected address"
              disabled={selectedResult == null}
              onPress={() => setStep('save')}
              style={[
                styles.button,
                styles.saveButton,
                selectedResult == null && styles.saveButtonDisabled,
              ]}>
              <Text className="font-semibold text-white">Continue</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {step === 'save' && selectedResult != null ? (
        <View>
          <Text variant="muted" className="mt-1 text-sm leading-5">
            Save as Home, Work, or a Favorite.
          </Text>
          <View style={styles.resolvedAddress}>
            <Text className="text-sm font-medium">
              {selectedResult.addressLine ?? trimmedAddress}
            </Text>
          </View>
          {!onlyFavorite ? (
            <View style={styles.kindActions}>
              {showHome ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark as Home"
                  disabled={saving}
                  style={[
                    styles.kindRow,
                    kind === 'home' && styles.kindRowSelected,
                  ]}
                  onPress={() => setKind('home')}>
                  <Home size={20} color={colors.primary} strokeWidth={2.25} />
                  <Text className="font-medium">Home</Text>
                </Pressable>
              ) : null}
              {showWork ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Mark as Work"
                  disabled={saving}
                  style={[
                    styles.kindRow,
                    kind === 'work' && styles.kindRowSelected,
                  ]}
                  onPress={() => setKind('work')}>
                  <Briefcase
                    size={20}
                    color={colors.primary}
                    strokeWidth={2.25}
                  />
                  <Text className="font-medium">Work</Text>
                </Pressable>
              ) : null}
              {showFavorite ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add Favorite"
                  disabled={saving}
                  style={[
                    styles.kindRow,
                    kind === 'favorite' && styles.kindRowSelected,
                  ]}
                  onPress={() => setKind('favorite')}>
                  <Heart
                    size={20}
                    color={colors.primary}
                    strokeWidth={2.25}
                    fill={kind === 'favorite' ? colors.primary : 'transparent'}
                  />
                  <Text className="font-medium">Favorite</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {kind === 'favorite' ? (
            <View>
              <BottomSheetTextInput
                value={favoriteLabel}
                onChangeText={setFavoriteLabel}
                placeholder="Favorite name"
                placeholderTextColor="#8E8E93"
                style={styles.input}
                returnKeyType="done"
                maxLength={MAX_SAVED_PLACE_LABEL_LENGTH}
                editable={!saving}
                accessibilityLabel="New favorite name"
                onSubmitEditing={() => {
                  if (canSave) {
                    void handleSave();
                  }
                }}
              />
            </View>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={goBack}
              disabled={saving}
              style={[styles.button, styles.cancelButton]}>
              <Text className="font-medium">Back</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save saved place by address"
              disabled={!canSave}
              onPress={() => void handleSave()}
              style={[
                styles.button,
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
              ]}>
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-semibold text-white">Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

type AddSavedPlaceByAddressSheetProps = {
  visible: boolean;
  options: SavedPlaceAddByAddressOptions;
  onClose: () => void;
  onSave: (request: AddSavedPlaceByAddressRequest) => Promise<void>;
};

/** Gorhom overlay for address entry — keyboard handling stays in the library. */
export function AddSavedPlaceByAddressSheet({
  visible,
  options,
  onClose,
  onSave,
}: AddSavedPlaceByAddressSheetProps) {
  const sheetRef = useRef<BottomSheetModal>(null);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const requestClose = useCallback(() => {
    dismissKeyboard();
    sheetRef.current?.dismiss();
  }, [dismissKeyboard]);

  const handleDismissed = useCallback(() => {
    dismissKeyboard();
    onClose();
  }, [dismissKeyboard, onClose]);

  const handleSave = useCallback(
    async (request: AddSavedPlaceByAddressRequest) => {
      await onSave(request);
      requestClose();
    },
    [onSave, requestClose],
  );

  return (
    <View style={styles.host} pointerEvents={visible ? 'box-none' : 'none'}>
      <BottomSheetModalProvider>
        <AppBottomSheet
          name="add-saved-place-by-address"
          visible={visible}
          bottomSheetRef={sheetRef}
          onClose={handleDismissed}
          onClosing={dismissKeyboard}
          instantPresent
          stackBehavior="push"
          enableDynamicSizing
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          dismissKeyboardOnClose
          releaseTouchesWhileClosing>
          {visible ? (
            <AddSavedPlaceByAddressPanel
              key={`add-by-address-${options.hasHome}-${options.hasWork}`}
              options={options}
              onClose={requestClose}
              onSave={handleSave}
            />
          ) : null}
        </AppBottomSheet>
      </BottomSheetModalProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
  },
  input: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D1D6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  resolvedAddress: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  resultsList: {
    marginTop: 12,
    maxHeight: 180,
  },
  resultRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    marginBottom: 8,
  },
  resultRowSelected: {
    borderWidth: 2,
    borderColor: '#6B4EFF',
    backgroundColor: '#F5F3FF',
  },
  kindActions: {
    marginTop: 12,
    gap: 8,
  },
  kindRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
  },
  kindRowSelected: {
    borderWidth: 2,
    borderColor: '#6B4EFF',
    backgroundColor: '#F5F3FF',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  button: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    minHeight: 44,
  },
  cancelButton: {
    backgroundColor: '#F2F2F7',
  },
  saveButton: {
    backgroundColor: '#6B4EFF',
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
});
