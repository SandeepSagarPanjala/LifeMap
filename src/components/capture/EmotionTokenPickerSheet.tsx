import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  useColorScheme,
  View,
  type KeyboardEvent,
  type ListRenderItem,
  useWindowDimensions,
} from 'react-native';
import {
  BottomSheetFlatList,
  BottomSheetFooter,
  BottomSheetTextInput,
  type BottomSheetFooterProps,
  type BottomSheetModal,
} from '@gorhom/bottom-sheet';
import { Search, X } from 'lucide-react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { AdaptiveGlassSurface } from '@/components/glass/AdaptiveGlassSurface';
import { MapGlassCircleButton } from '@/components/map/MapGlassCircleButton';
import { Text } from '@/components/ui/text';
import { AppBottomSheet } from '@/components/ui/app-bottom-sheet';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { APP_COPY } from '@/lib/app-copy';
import {
  getMoodArtPresentation,
  moodArtVariantLabel,
  type MoodArtVariant,
} from '@/lib/moments/mood-art';
import {
  EMOTION_TOKENS,
  type EmotionSelection,
  type EmotionTokenId,
} from '@/lib/moments/emotion-tokens';

const GRID_COLUMNS = 4;
const GRID_GAP = 12;
/** Resting height — scrolling the grid must not expand past this. */
const SNAP_POINTS = ['62%', '92%'];
const REST_SNAP_INDEX = 0;
const SEARCH_SNAP_INDEX = 1;
const SEARCH_DOCK_HEIGHT = 46;
const SEARCH_DOCK_FADE = 26;
const SEARCH_DOCK_TOP_PADDING = 10;
const SEARCH_DOCK_KEYBOARD_PADDING = 10;
const SEARCH_SCRIM_GRADIENT_ID = 'mood-search-scrim';
const VARIANT_TAB_WIDTH = 44;
const VARIANT_INDICATOR_WIDTH = VARIANT_TAB_WIDTH - 4;
const VARIANT_INDICATOR_HEIGHT = 32;
const VARIANT_SPRING = {
  damping: 17,
  stiffness: 190,
  mass: 0.8,
  reduceMotion: ReduceMotion.System,
};

type EmotionTokenPickerPageProps = {
  selectedEmotionId: EmotionTokenId | null;
  selectedVariant: MoodArtVariant;
  allowedVariants: MoodArtVariant[];
  onSelect: (selection: EmotionSelection) => void;
  onVariantChange: (variant: MoodArtVariant) => void;
  onClose: () => void;
  /** Expand the parent half sheet while search is focused. */
  onSearchFocus?: () => void;
  onSearchBlur?: () => void;
};

type EmotionTokenPickerSheetProps = {
  visible: boolean;
  selectedEmotionId: EmotionTokenId | null;
  selectedVariant: MoodArtVariant;
  allowedVariants: MoodArtVariant[];
  onSelect: (selection: EmotionSelection) => void;
  onVariantChange: (variant: MoodArtVariant) => void;
  onClose: () => void;
  onWillClose?: () => void;
  /** When false, selecting a mood only calls onSelect (parent owns dismissal). */
  closeOnSelect?: boolean;
};

type MoodSearchFooterProps = BottomSheetFooterProps & {
  /** Stable ref the footer publishes its "clear input" handler on. */
  resetRef: MutableRefObject<(() => void) | null>;
  /** Expand the sheet when search focuses — kept as a ref to avoid remounts. */
  onSearchFocusRef: MutableRefObject<(() => void) | null>;
  /** Restore resting height when search blurs. */
  onSearchBlurRef: MutableRefObject<(() => void) | null>;
  /** Select the first filtered mood when the keyboard Done/Search key is pressed. */
  onSubmitSearchRef: MutableRefObject<(() => void) | null>;
  onQueryChange: (query: string) => void;
  onClose: () => void;
};

/**
 * Gorhom renders `footerComponent` as a component type, so this element's
 * identity must stay stable for the whole session — a new identity remounts the
 * text input and drops the keyboard. Everything dynamic (theme, safe area,
 * keyboard) is therefore read inside here, never passed down as props.
 */
const MoodSearchFooter = memo(function MoodSearchFooter({
  resetRef,
  onSearchFocusRef,
  onSearchBlurRef,
  onSubmitSearchRef,
  onQueryChange,
  onClose,
  ...footerProps
}: MoodSearchFooterProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [value, setValue] = useState('');
  const [keyboardShown, setKeyboardShown] = useState(false);

  useEffect(() => {
    resetRef.current = () => setValue('');
    return () => {
      resetRef.current = null;
    };
  }, [resetRef]);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => {
      setKeyboardShown(true);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardShown(false);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleChangeText = useCallback(
    (nextValue: string) => {
      setValue(nextValue);
      onQueryChange(nextValue);
    },
    [onQueryChange],
  );

  const handleFocus = useCallback(() => {
    onSearchFocusRef.current?.();
  }, [onSearchFocusRef]);

  const handleBlur = useCallback(() => {
    onSearchBlurRef.current?.();
  }, [onSearchBlurRef]);

  const handleSubmit = useCallback(() => {
    onSubmitSearchRef.current?.();
  }, [onSubmitSearchRef]);

  const mutedColor = colors.mutedForeground;
  const primaryColor = colors.primary;
  const bottomInset = keyboardShown
    ? SEARCH_DOCK_KEYBOARD_PADDING
    : Math.max(insets.bottom, 12);

  return (
    <BottomSheetFooter {...footerProps} bottomInset={0}>
      <View pointerEvents="box-none" style={styles.searchFooter}>
        <Svg
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient
              id={SEARCH_SCRIM_GRADIENT_ID}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
              <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0.94} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#${SEARCH_SCRIM_GRADIENT_ID})`}
          />
        </Svg>
        <View style={[styles.searchDock, { paddingBottom: bottomInset }]}>
          <View style={styles.searchShadow}>
            <AdaptiveGlassSurface style={styles.searchGlass}>
              <Search size={18} color={mutedColor} strokeWidth={2.25} />
              <BottomSheetTextInput
                accessibilityLabel={APP_COPY.diary.searchMoods}
                placeholder={APP_COPY.diary.searchMoods}
                placeholderTextColor={mutedColor}
                value={value}
                onChangeText={handleChangeText}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onSubmitEditing={handleSubmit}
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit
                selectionColor={primaryColor}
                style={[styles.searchInput, { color: colors.cardForeground }]}
              />
            </AdaptiveGlassSurface>
          </View>
          <MapGlassCircleButton
            accessibilityLabel="Close mood picker"
            onPress={onClose}
            size={SEARCH_DOCK_HEIGHT}
          >
            <X size={20} color={primaryColor} strokeWidth={2.25} />
          </MapGlassCircleButton>
        </View>
      </View>
    </BottomSheetFooter>
  );
});

function HighlightedMoodLabel({
  label,
  query,
  selected,
  previewed,
  primaryColor,
  previewBackgroundColor,
}: {
  label: string;
  query: string;
  selected: boolean;
  previewed: boolean;
  primaryColor: string;
  previewBackgroundColor: string;
}) {
  const normalized = query.trim().toLocaleLowerCase();
  const matchIndex =
    normalized.length > 0 ? label.toLocaleLowerCase().indexOf(normalized) : -1;

  if (matchIndex < 0) {
    return (
      <Text
        numberOfLines={1}
        style={[
          styles.tokenLabel,
          previewed
            ? [
                styles.tokenLabelPreviewed,
                { backgroundColor: previewBackgroundColor },
              ]
            : null,
          selected ? { color: primaryColor, fontWeight: '700' } : null,
        ]}
      >
        {label}
      </Text>
    );
  }

  const matchEnd = matchIndex + normalized.length;
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.tokenLabel,
        previewed
          ? [
              styles.tokenLabelPreviewed,
              { backgroundColor: previewBackgroundColor },
            ]
          : null,
        selected ? { color: primaryColor, fontWeight: '700' } : null,
      ]}
    >
      {label.slice(0, matchIndex)}
      <Text style={[styles.tokenLabelMatch, { color: primaryColor }]}>
        {label.slice(matchIndex, matchEnd)}
      </Text>
      {label.slice(matchEnd)}
    </Text>
  );
}

const EmotionTokenCell = memo(function EmotionTokenCell({
  token,
  variant,
  selected,
  previewed = false,
  primaryColor,
  query,
  onSelect,
}: {
  token: (typeof EMOTION_TOKENS)[number];
  variant: MoodArtVariant;
  selected: boolean;
  previewed?: boolean;
  primaryColor: string;
  query: string;
  onSelect: (id: EmotionTokenId) => void;
}) {
  const art = getMoodArtPresentation(token.id, variant);
  const handlePress = useCallback(() => {
    onSelect(token.id);
  }, [onSelect, token.id]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={token.label}
      onPress={handlePress}
      style={styles.tokenCell}
    >
      <View style={styles.tokenStickerWrap}>
        <View
          style={[
            styles.tokenSticker,
            {
              backgroundColor: art.emotion.tint,
              borderColor:
                selected && !previewed ? primaryColor : 'transparent',
            },
            selected && !previewed
              ? styles.tokenStickerSelected
              : styles.tokenStickerIdle,
          ]}
        >
          <Image
            source={art.imageSource}
            resizeMode="contain"
            style={styles.tokenImage}
          />
        </View>
      </View>
      <HighlightedMoodLabel
        label={token.label}
        query={query}
        selected={selected}
        previewed={previewed}
        primaryColor={primaryColor}
        previewBackgroundColor={art.emotion.tint}
      />
    </Pressable>
  );
});

function MoodVariantBar({
  allowedVariants,
  selectedVariant,
  onVariantChange,
}: {
  allowedVariants: MoodArtVariant[];
  selectedVariant: MoodArtVariant;
  onVariantChange: (variant: MoodArtVariant) => void;
}) {
  const colors = useThemeColors();
  const colorScheme = useColorScheme();
  const selectedIndex = Math.max(allowedVariants.indexOf(selectedVariant), 0);
  const indicatorBackground =
    colorScheme === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.09)';
  const indicatorX = useSharedValue(selectedIndex * VARIANT_TAB_WIDTH);
  const indicatorOpacity = useSharedValue(1);
  const indicatorScaleX = useSharedValue(1);
  const indicatorScaleY = useSharedValue(1);
  const parentScale = useSharedValue(1);

  useEffect(() => {
    indicatorX.value = withSpring(
      selectedIndex * VARIANT_TAB_WIDTH,
      VARIANT_SPRING,
    );
    indicatorOpacity.value = withSequence(
      withTiming(0.38, {
        duration: 80,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(0.38, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1, {
        duration: 110,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
    indicatorScaleX.value = withSequence(
      withTiming(1.22, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1.22, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, VARIANT_SPRING),
    );
    indicatorScaleY.value = withSequence(
      withTiming(1.18, {
        duration: 120,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withTiming(1.18, {
        duration: 35,
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, VARIANT_SPRING),
    );
    parentScale.value = withSequence(
      withTiming(1.035, {
        duration: 105,
        easing: Easing.out(Easing.quad),
        reduceMotion: ReduceMotion.System,
      }),
      withSpring(1, VARIANT_SPRING),
    );
  }, [
    indicatorOpacity,
    indicatorScaleX,
    indicatorScaleY,
    indicatorX,
    parentScale,
    selectedIndex,
  ]);

  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: indicatorOpacity.value,
    transform: [
      { translateX: indicatorX.value },
      { scaleX: indicatorScaleX.value },
      { scaleY: indicatorScaleY.value },
    ],
  }));
  const parentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: parentScale.value }],
  }));

  return (
    <Animated.View style={[styles.variantShadow, parentStyle]}>
      <AdaptiveGlassSurface style={styles.variantGlass}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.variantSelection,
            { backgroundColor: indicatorBackground },
            indicatorStyle,
          ]}
        />
        {allowedVariants.map(variant => {
          const selected = variant === selectedVariant;
          return (
            <Pressable
              key={variant}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={moodArtVariantLabel(variant)}
              onPress={() => onVariantChange(variant)}
              style={styles.variantTab}
            >
              <Text
                style={[
                  styles.variantLabel,
                  {
                    color: selected ? colors.primary : colors.mutedForeground,
                  },
                  selected ? styles.variantLabelSelected : null,
                ]}
              >
                {moodArtVariantLabel(variant)}
              </Text>
            </Pressable>
          );
        })}
      </AdaptiveGlassSurface>
    </Animated.View>
  );
}

/** Picker body for the Mood half-sheet composer. */
export function EmotionTokenPickerPage({
  selectedEmotionId,
  selectedVariant,
  allowedVariants,
  onSelect,
  onVariantChange,
  onClose,
  onSearchFocus,
  onSearchBlur,
}: EmotionTokenPickerPageProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [query, setQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const cellWidth =
    (windowWidth - 40 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;
  const filteredTokens = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return EMOTION_TOKENS;
    }
    return EMOTION_TOKENS.filter(
      token =>
        token.label.toLocaleLowerCase().includes(normalized) ||
        token.id.includes(normalized),
    );
  }, [query]);

  // The page renders full-screen, so the dock has to lift itself above the
  // keyboard — there is no bottom-sheet footer inset doing it here.
  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const selectEmotion = useCallback(
    (emotionId: EmotionTokenId) => {
      const art = getMoodArtPresentation(emotionId, selectedVariant);
      onSelect({ emotion: art.emotion, variant: selectedVariant });
    },
    [onSelect, selectedVariant],
  );

  const handleSubmit = useCallback(() => {
    if (!query.trim()) {
      return;
    }
    const first = filteredTokens[0];
    if (first != null) {
      selectEmotion(first.id);
    }
  }, [filteredTokens, query, selectEmotion]);

  // Done selects the first match — show that as the active highlight while searching.
  const searchPreviewId =
    query.trim().length > 0 ? filteredTokens[0]?.id ?? null : null;

  const renderItem = useCallback<
    ListRenderItem<(typeof EMOTION_TOKENS)[number]>
  >(
    ({ item }) => (
      <View style={{ width: cellWidth }}>
        <EmotionTokenCell
          token={item}
          variant={selectedVariant}
          selected={selectedEmotionId === item.id}
          previewed={item.id === searchPreviewId}
          primaryColor={colors.primary}
          query={query}
          onSelect={selectEmotion}
        />
      </View>
    ),
    [
      cellWidth,
      colors.primary,
      query,
      searchPreviewId,
      selectEmotion,
      selectedEmotionId,
      selectedVariant,
    ],
  );

  return (
    <View style={styles.pagePicker}>
      <View style={styles.pagePickerHeader}>
        <Text variant="h3" className="flex-1 border-0 pb-0">
          {APP_COPY.diary.howAreYouFeeling}
        </Text>
        <MoodVariantBar
          allowedVariants={allowedVariants}
          selectedVariant={selectedVariant}
          onVariantChange={onVariantChange}
        />
      </View>

      <FlatList
        data={filteredTokens}
        keyExtractor={item => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.pageGridContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{APP_COPY.diary.noMoodsFound}</Text>
        }
      />

      <View
        style={[
          styles.pageSearchRow,
          {
            paddingBottom:
              keyboardHeight > 0
                ? keyboardHeight + SEARCH_DOCK_KEYBOARD_PADDING
                : Math.max(insets.bottom, 10),
          },
        ]}
      >
        <View style={styles.pageSearchShadow}>
          <AdaptiveGlassSurface style={styles.pageSearchGlass}>
            <Search
              size={18}
              color={colors.mutedForeground}
              strokeWidth={2.25}
            />
            <TextInput
              accessibilityLabel={APP_COPY.diary.searchMoods}
              placeholder={APP_COPY.diary.searchMoods}
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSubmit}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              returnKeyType="done"
              autoCorrect={false}
              selectionColor={colors.primary}
              style={[styles.pageSearchInput, { color: colors.foreground }]}
            />
          </AdaptiveGlassSurface>
        </View>
        <MapGlassCircleButton
          accessibilityLabel={APP_COPY.common.close}
          onPress={onClose}
          size={46}
        >
          <X size={20} color={colors.primary} strokeWidth={2.25} />
        </MapGlassCircleButton>
      </View>
    </View>
  );
}

export function EmotionTokenPickerSheet({
  visible,
  selectedEmotionId,
  selectedVariant,
  allowedVariants,
  onSelect,
  onVariantChange,
  onClose,
  onWillClose,
  closeOnSelect = true,
}: EmotionTokenPickerSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const cellWidth =
    (windowWidth - 40 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  const [pendingEmotionId, setPendingEmotionId] =
    useState<EmotionTokenId | null>(selectedEmotionId);
  const [query, setQuery] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const filteredTokens = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) {
      return EMOTION_TOKENS;
    }
    return EMOTION_TOKENS.filter(
      token =>
        token.label.toLocaleLowerCase().includes(normalized) ||
        token.id.includes(normalized),
    );
  }, [query]);
  const searchResetRef = useRef<(() => void) | null>(null);
  const onSearchFocusRef = useRef<(() => void) | null>(null);
  const onSearchBlurRef = useRef<(() => void) | null>(null);
  const onSubmitSearchRef = useRef<(() => void) | null>(null);
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      setPendingEmotionId(selectedEmotionId);
      setQuery('');
      searchResetRef.current?.();
    }
  }, [selectedEmotionId, visible]);

  useEffect(() => {
    onSearchFocusRef.current = () => {
      sheetRef.current?.snapToIndex(SEARCH_SNAP_INDEX);
    };
    onSearchBlurRef.current = () => {
      sheetRef.current?.snapToIndex(REST_SNAP_INDEX);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }

    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const dockBottomInset =
    keyboardHeight > 0
      ? SEARCH_DOCK_KEYBOARD_PADDING
      : Math.max(insets.bottom, 12);
  const gridContentStyle = useMemo(
    () => [
      styles.gridContent,
      {
        paddingBottom:
          SEARCH_DOCK_HEIGHT +
          SEARCH_DOCK_TOP_PADDING +
          SEARCH_DOCK_FADE +
          dockBottomInset +
          keyboardHeight,
      },
    ],
    [dockBottomInset, keyboardHeight],
  );

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  const handleEmotionSelect = useCallback(
    (emotionId: EmotionTokenId) => {
      const art = getMoodArtPresentation(emotionId, selectedVariant);
      onSelect({ emotion: art.emotion, variant: selectedVariant });
      if (closeOnSelect) {
        handleClose();
      }
    },
    [closeOnSelect, handleClose, onSelect, selectedVariant],
  );

  useEffect(() => {
    onSubmitSearchRef.current = () => {
      if (!query.trim()) {
        return;
      }
      const first = filteredTokens[0];
      if (first == null) {
        return;
      }
      handleEmotionSelect(first.id);
    };
  }, [filteredTokens, handleEmotionSelect, query]);

  // Done selects the first match — show that as the active highlight while searching.
  const searchPreviewId =
    query.trim().length > 0 ? filteredTokens[0]?.id ?? null : null;

  const handleAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      if (toIndex === -1) {
        onWillClose?.();
      }
    },
    [onWillClose],
  );

  const renderEmotionItem = useCallback<
    ListRenderItem<(typeof EMOTION_TOKENS)[number]>
  >(
    ({ item }) => (
      <View style={{ width: cellWidth }}>
        <EmotionTokenCell
          token={item}
          variant={selectedVariant}
          selected={pendingEmotionId === item.id}
          previewed={item.id === searchPreviewId}
          primaryColor={colors.primary}
          query={query}
          onSelect={handleEmotionSelect}
        />
      </View>
    ),
    [
      cellWidth,
      colors.primary,
      handleEmotionSelect,
      pendingEmotionId,
      query,
      searchPreviewId,
      selectedVariant,
    ],
  );

  const renderSearchFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <MoodSearchFooter
        {...props}
        resetRef={searchResetRef}
        onSearchFocusRef={onSearchFocusRef}
        onSearchBlurRef={onSearchBlurRef}
        onSubmitSearchRef={onSubmitSearchRef}
        onQueryChange={setQuery}
        onClose={handleClose}
      />
    ),
    [handleClose],
  );

  return (
    <AppBottomSheet
      visible={visible}
      onClose={handleClose}
      onAnimate={handleAnimate}
      dismissKeyboardOnClose={false}
      keyboardBehavior="interactive"
      enableContentPanningGesture={false}
      rawChildren
      snapPoints={SNAP_POINTS}
      bottomSheetRef={sheetRef}
      footerComponent={renderSearchFooter}
      footerPadding={0}
    >
      <BottomSheetFlatList
        data={filteredTokens}
        keyExtractor={item => item.id}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={gridContentStyle}
        showsVerticalScrollIndicator={false}
        style={styles.grid}
        renderItem={renderEmotionItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.stepHeader}>
            <Text variant="h4" className="flex-1 border-0 pb-0">
              {APP_COPY.diary.howAreYouFeeling}
            </Text>
            <MoodVariantBar
              allowedVariants={allowedVariants}
              selectedVariant={selectedVariant}
              onVariantChange={onVariantChange}
            />
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>{APP_COPY.diary.noMoodsFound}</Text>
        }
        ListFooterComponent={<View style={styles.gridBottomSpacer} />}
      />
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  pagePicker: {
    flex: 1,
    minHeight: 0,
  },
  pagePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  pageSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  pageSearchShadow: {
    flex: 1,
    borderRadius: 23,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 5 },
    }),
  },
  pageSearchGlass: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 23,
    overflow: 'hidden',
  },
  pageSearchInput: {
    flex: 1,
    height: 46,
    padding: 0,
    fontSize: 15,
  },
  pageGridContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  stepHeader: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  variantShadow: {
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.12,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 5,
      },
    }),
  },
  variantGlass: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderRadius: 20,
    overflow: 'hidden',
  },
  variantTab: {
    width: VARIANT_TAB_WIDTH,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  variantSelection: {
    position: 'absolute',
    left: 5,
    top: 4,
    width: VARIANT_INDICATOR_WIDTH,
    height: VARIANT_INDICATOR_HEIGHT,
    borderRadius: 16,
  },
  variantLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  variantLabelSelected: {
    fontWeight: '700',
  },
  grid: {
    flex: 1,
    minHeight: 0,
  },
  gridContent: {
    flexGrow: 1,
    paddingTop: 4,
    paddingHorizontal: 20,
  },
  gridBottomSpacer: {
    height: 200,
  },
  gridRow: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  tokenCell: {
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  tokenStickerWrap: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tokenSticker: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
  tokenStickerIdle: {
    borderColor: 'transparent',
  },
  tokenStickerSelected: {
    transform: [{ scale: 1.05 }],
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 3 },
      },
      android: {
        elevation: 4,
      },
    }),
  },
  tokenImage: {
    width: 58,
    height: 58,
  },
  tokenLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3A3A3C',
    textAlign: 'center',
  },
  tokenLabelPreviewed: {
    borderRadius: 7,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tokenLabelMatch: {
    fontWeight: '800',
  },
  emptyText: {
    paddingTop: 36,
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
  searchFooter: {
    paddingTop: SEARCH_DOCK_FADE,
  },
  searchDock: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: SEARCH_DOCK_TOP_PADDING,
  },
  searchShadow: {
    flex: 1,
    maxWidth: 280,
    borderRadius: 23,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOpacity: 0.14,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  searchGlass: {
    height: SEARCH_DOCK_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 23,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    height: SEARCH_DOCK_HEIGHT,
    padding: 0,
    fontSize: 15,
  },
});
