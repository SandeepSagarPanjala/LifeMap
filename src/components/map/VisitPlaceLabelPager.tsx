import {useCallback, useEffect, useRef, useState} from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {VisitPlaceLabelWithPin} from '@/components/map/VisitPlaceLabelWithPin';
import {Text} from '@/components/ui/text';
import type {VisitPlaceDisplay} from '@/lib/place-lookup-types';

type VisitPlaceLabelPagerProps = {
  display: VisitPlaceDisplay;
  onSelectIndex: (index: number) => void;
};

const PAGE_WIDTH = 220;

export function VisitPlaceLabelPager({
  display,
  onSelectIndex,
}: VisitPlaceLabelPagerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [pageIndex, setPageIndex] = useState(display.selectedIndex);

  useEffect(() => {
    setPageIndex(display.selectedIndex);
  }, [display.selectedIndex]);

  const showUserPin = display.isAreaDefault || display.isTripLabel;
  const candidates = display.candidates;
  if (display.source !== 'lookup' || candidates.length <= 1) {
    if (!display.primaryLabel) {
      return null;
    }
    return (
      <VisitPlaceLabelWithPin
        name={display.primaryLabel}
        showPin={showUserPin}
      />
    );
  }

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextIndex = Math.round(
        event.nativeEvent.contentOffset.x / PAGE_WIDTH,
      );
      const clamped = Math.max(0, Math.min(nextIndex, candidates.length - 1));
      setPageIndex(clamped);
      if (clamped !== display.selectedIndex) {
        onSelectIndex(clamped);
      }
    },
    [candidates.length, display.selectedIndex, onSelectIndex],
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{x: display.selectedIndex * PAGE_WIDTH, y: 0}}
        snapToInterval={PAGE_WIDTH}
        decelerationRate="fast"
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.scroll}>
        {candidates.map((candidate, index) => (
          <View key={`${candidate.name}-${index}`} style={styles.page}>
            <VisitPlaceLabelWithPin
              name={candidate.name}
              showPin={
                showUserPin && index === display.selectedIndex
              }
            />
            <Text variant="muted" className="text-[10px] uppercase tracking-wide">
              {candidate.kind === 'address' ? 'Address' : 'Nearby'}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {candidates.map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[styles.dot, index === pageIndex && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: PAGE_WIDTH,
  },
  scroll: {
    flexGrow: 0,
  },
  page: {
    width: PAGE_WIDTH,
    paddingRight: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#D1D1D6',
  },
  dotActive: {
    backgroundColor: '#8E8E93',
  },
});
