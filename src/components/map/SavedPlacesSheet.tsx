import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {Trash2} from 'lucide-react-native';

import {SavedPlaceIcon} from '@/components/map/SavedPlaceIcon';
import {Text} from '@/components/ui/text';
import type {SavedPlaceRow} from '@/db/repositories/saved-places';
import {savedPlaceDisplayLabel} from '@/lib/saved-places';
import {SAVED_PLACE_MAP_STYLE} from '@/lib/saved-places-map';
import {useThemeColors} from '@/hooks/use-theme-colors';

const SHEET_OFFSCREEN = 420;

type SavedPlacesSheetProps = {
  visible: boolean;
  places: SavedPlaceRow[];
  onClose: () => void;
  onSelectPlace: (place: SavedPlaceRow) => void;
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
  onDelete,
}: SavedPlacesSheetProps) {
  const colors = useThemeColors();
  const sorted = sortPlaces(places);

  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(SHEET_OFFSCREEN)).current;
  const closingRef = useRef(false);

  useLayoutEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);
    }
  }, [visible]);

  const animateIn = useCallback(() => {
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(SHEET_OFFSCREEN);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, sheetTranslateY]);

  const animateOut = useCallback(
    (onDone: () => void) => {
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: SHEET_OFFSCREEN,
          duration: 240,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(({finished}) => {
        if (finished) {
          onDone();
        }
      });
    },
    [backdropOpacity, sheetTranslateY],
  );

  const closeSheet = useCallback(() => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    animateOut(() => {
      closingRef.current = false;
      setMounted(false);
      onClose();
    });
  }, [animateOut, onClose]);

  useEffect(() => {
    if (!visible && mounted && !closingRef.current) {
      closingRef.current = true;
      animateOut(() => {
        closingRef.current = false;
        setMounted(false);
      });
    }
  }, [animateOut, mounted, visible]);

  useEffect(() => {
    if (mounted && visible) {
      animateIn();
    }
  }, [animateIn, mounted, visible]);

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

  if (!mounted) {
    return null;
  }

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={closeSheet}>
      <View style={styles.root}>
        <Animated.View
          pointerEvents="none"
          style={[styles.backdrop, {opacity: backdropOpacity}]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close saved places"
          style={styles.dismissTap}
          onPress={closeSheet}
        />

        <Animated.View
          style={[styles.sheet, {transform: [{translateY: sheetTranslateY}]}]}>
          <View style={styles.handle} />

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
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}>
              {sorted.map(place => {
                const accent = SAVED_PLACE_MAP_STYLE[place.kind];
                return (
                <View key={place.id} style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Show ${savedPlaceDisplayLabel(place)} on map`}
                    onPress={() => {
                      onSelectPlace(place);
                      closeSheet();
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
                      <Text variant="muted" className="text-xs">
                        {place.radiusMeters} m radius
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${place.label}`}
                    onPress={() => confirmDelete(place)}
                    style={styles.deleteBtn}>
                    <Trash2
                      size={18}
                      color={colors.primary}
                      strokeWidth={2.25}
                    />
                  </Pressable>
                </View>
                );
              })}
            </ScrollView>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={closeSheet}
            style={styles.closeBtn}>
            <Text variant="muted" className="text-center font-medium">
              Close
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  dismissTap: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 10,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 24,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    marginBottom: 12,
  },
  list: {
    marginTop: 16,
  },
  listContent: {
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
  deleteBtn: {
    padding: 8,
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 8,
  },
});
