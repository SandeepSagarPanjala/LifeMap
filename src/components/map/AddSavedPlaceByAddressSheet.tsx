import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { APP_COPY } from '@/lib/app-copy';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import {
  Briefcase,
  Check,
  ChevronLeft,
  Heart,
  Home,
  Search,
  X,
} from 'lucide-react-native';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { Text } from '@/components/ui/text';
import type { SavedPlaceKind } from '@/db/repositories/saved-places';
import { useThemeColors } from '@/hooks/use-theme-colors';
import type { AddressGeocodeResult } from '@/lib/place-lookup-types';
import { fetchAddressGeocode } from '@/lib/place-lookup-native';
import {
  MAP_MOMENTS_BAR_GAP,
  MAP_MOMENTS_BAR_HEIGHT,
  MAP_MOMENTS_SIDE_BTN_GAP,
  MAP_STACK_BUTTON_SIZE,
  MAX_SAVED_PLACE_LABEL_LENGTH,
} from '@/lib/app-constants';
import type { SavedPlaceAddByAddressOptions } from '@/lib/saved-places';

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
  addressInputRef?: RefObject<ComponentRef<typeof BottomSheetTextInput> | null>;
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

type GlassActionBarProps = {
  primaryLabel: string;
  primaryAccessibilityLabel: string;
  primaryIcon: ReactNode;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  onPrimary: () => void;
  onClose: () => void;
  closeDisabled?: boolean;
  onBack?: () => void;
  backDisabled?: boolean;
};

function GlassActionBar({
  primaryLabel,
  primaryAccessibilityLabel,
  primaryIcon,
  primaryDisabled = false,
  primaryLoading = false,
  onPrimary,
  onClose,
  closeDisabled = false,
  onBack,
  backDisabled = false,
}: GlassActionBarProps) {
  const colors = useThemeColors();

  return (
    <View
      pointerEvents="box-none"
      style={[styles.barWrap, { paddingBottom: MAP_MOMENTS_BAR_GAP }]}
    >
      <View style={styles.barRow}>
        {onBack != null ? (
          <MapGlassCircleButton
            accessibilityLabel="Back"
            disabled={backDisabled}
            onPress={onBack}
            style={styles.sideButton}
          >
            <ChevronLeft
              size={20}
              color={colors.primary}
              strokeWidth={2.25}
            />
          </MapGlassCircleButton>
        ) : null}

        <View style={styles.shadowWrap}>
          <AdaptiveGlassSurface style={styles.pill}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryAccessibilityLabel}
              disabled={primaryDisabled || primaryLoading}
              onPress={onPrimary}
              style={[
                styles.primaryPressable,
                primaryDisabled || primaryLoading
                  ? styles.primaryPressableDisabled
                  : null,
              ]}
            >
              {primaryLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <>
                  {primaryIcon}
                  <Text
                    style={[styles.primaryLabel, { color: colors.primary }]}
                  >
                    {primaryLabel}
                  </Text>
                </>
              )}
            </Pressable>
          </AdaptiveGlassSurface>
        </View>

        <MapGlassCircleButton
          accessibilityLabel="Cancel"
          disabled={closeDisabled}
          onPress={onClose}
          style={styles.sideButton}
        >
          <X size={20} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

function AddSavedPlaceByAddressPanel({
  options,
  addressInputRef,
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
      setLookupError(APP_COPY.alerts.couldNotLookUpAddress);
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
        favoriteLabel: kind === 'favorite' ? trimmedFavoriteLabel : undefined,
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
              ref={addressInputRef}
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
              onSubmitEditing={() => {
                if (canLookup) {
                  void handleLookup();
                }
              }}
            />
          </View>
          {lookupError != null ? (
            <Text className="mt-2 text-sm text-red-600">{lookupError}</Text>
          ) : null}
          <GlassActionBar
            primaryLabel="Continue"
            primaryAccessibilityLabel="Look up address"
            primaryIcon={
              <Search size={16} color={colors.primary} strokeWidth={2.25} />
            }
            primaryDisabled={!canLookup}
            primaryLoading={lookingUp}
            onPrimary={() => {
              void handleLookup();
            }}
            onClose={onClose}
            closeDisabled={lookingUp || saving}
          />
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
                  ]}
                >
                  <Text className={selected ? 'font-medium' : undefined}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <GlassActionBar
            primaryLabel="Continue"
            primaryAccessibilityLabel="Continue with selected address"
            primaryIcon={
              <Check size={16} color={colors.primary} strokeWidth={2.5} />
            }
            primaryDisabled={selectedResult == null}
            onPrimary={() => setStep('save')}
            onClose={onClose}
            onBack={goBack}
          />
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
                  onPress={() => setKind('home')}
                >
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
                  onPress={() => setKind('work')}
                >
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
                  onPress={() => setKind('favorite')}
                >
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
          <GlassActionBar
            primaryLabel="Save"
            primaryAccessibilityLabel="Save saved place by address"
            primaryIcon={
              <Check size={16} color={colors.primary} strokeWidth={2.5} />
            }
            primaryDisabled={!canSave}
            primaryLoading={saving}
            onPrimary={() => {
              void handleSave();
            }}
            onClose={onClose}
            closeDisabled={saving}
            onBack={goBack}
            backDisabled={saving}
          />
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
  const addressInputRef =
    useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gorhom needs the sheet presented before focus() works — same as SavedPlacesEditSheet.
  useEffect(() => {
    if (!visible) {
      return;
    }
    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      addressInputRef.current?.focus();
    }, 400);
    return () => {
      if (focusTimerRef.current != null) {
        clearTimeout(focusTimerRef.current);
        focusTimerRef.current = null;
      }
    };
  }, [visible]);

  const dismissKeyboard = useCallback(() => {
    if (focusTimerRef.current != null) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    addressInputRef.current?.blur();
    Keyboard.dismiss();
  }, []);

  const focusAddressInput = useCallback(() => {
    addressInputRef.current?.focus();
  }, []);

  const handleSheetAnimate = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (toIndex >= 0 && fromIndex < 0) {
        focusAddressInput();
      }
      if (toIndex === -1) {
        dismissKeyboard();
      }
    },
    [dismissKeyboard, focusAddressInput],
  );

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
          onAnimate={handleSheetAnimate}
          onClosing={dismissKeyboard}
          instantPresent
          stackBehavior="push"
          enableDynamicSizing
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          dismissKeyboardOnClose
          releaseTouchesWhileClosing
        >
          {visible ? (
            <AddSavedPlaceByAddressPanel
              key={`add-by-address-${options.hasHome}-${options.hasWork}`}
              options={options}
              addressInputRef={addressInputRef}
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
  barWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MAP_MOMENTS_SIDE_BTN_GAP,
  },
  shadowWrap: {
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 10 },
    }),
  },
  pill: {
    height: MAP_MOMENTS_BAR_HEIGHT,
    borderRadius: MAP_MOMENTS_BAR_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  primaryPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: MAP_MOMENTS_BAR_HEIGHT,
    paddingHorizontal: 18,
  },
  primaryPressableDisabled: {
    opacity: 0.4,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  sideButton: {
    width: MAP_STACK_BUTTON_SIZE,
    height: MAP_STACK_BUTTON_SIZE,
  },
});
