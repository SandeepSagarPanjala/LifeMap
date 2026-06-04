import {useCallback, useRef} from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import {Pause, Play} from 'lucide-react-native';

import {Text} from '@/components/ui/text';
import type {DetectedTrip} from '@/lib/trip-detection';
import {
  formatTripStats,
  formatTripTimeRange,
} from '@/lib/trip-format';
import type {DistanceUnit} from '@/lib/location-geo';
import {useThemeColors} from '@/hooks/use-theme-colors';

const CARD_WIDTH = Dimensions.get('window').width - 48;
const CARD_GAP = 12;

type TripStripProps = {
  trips: DetectedTrip[];
  selectedIndex: number;
  distanceUnit: DistanceUnit;
  isPlaying: boolean;
  onSelectIndex: (index: number) => void;
  onPlay: () => void;
  onStop: () => void;
};

export function TripStrip({
  trips,
  selectedIndex,
  distanceUnit,
  isPlaying,
  onSelectIndex,
  onPlay,
  onStop,
}: TripStripProps) {
  const colors = useThemeColors();
  const listRef = useRef<FlatList<DetectedTrip>>(null);

  const onScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.x;
      const index = Math.round(offset / (CARD_WIDTH + CARD_GAP));
      if (index >= 0 && index < trips.length && index !== selectedIndex) {
        onSelectIndex(index);
      }
    },
    [onSelectIndex, selectedIndex, trips.length],
  );

  if (trips.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text className="font-medium">No trips yet today</Text>
        <Text variant="muted" className="mt-1 text-sm">
          Keep moving — trips appear as LifeMap saves your path.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        horizontal
        data={trips}
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: CARD_WIDTH + CARD_GAP,
          offset: (CARD_WIDTH + CARD_GAP) * index,
          index,
        })}
        renderItem={({item, index}) => {
          const selected = index === selectedIndex;
          return (
            <View style={[styles.card, {width: CARD_WIDTH}]}>
              <Text variant="muted" className="text-xs uppercase tracking-wide">
                Trip {trips.length - index} of {trips.length}
              </Text>
              <Text className="mt-1 text-lg font-semibold">
                {formatTripTimeRange(item.startAt, item.endAt)}
              </Text>
              <Text variant="muted" className="mt-1 text-sm">
                {formatTripStats(item, distanceUnit)}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isPlaying && selected ? 'Stop trip playback' : 'Play trip'}
                onPress={() => {
                  if (index !== selectedIndex) {
                    onSelectIndex(index);
                  }
                  if (isPlaying && selected) {
                    onStop();
                  } else {
                    onPlay();
                  }
                }}
                style={[styles.playButton, {backgroundColor: colors.primary}]}>
                {isPlaying && selected ? (
                  <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
                ) : (
                  <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                )}
              </Pressable>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 8,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginRight: CARD_GAP,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  playButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
