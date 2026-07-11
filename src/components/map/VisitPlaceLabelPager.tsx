import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { VisitPlaceLabelWithPin } from '@/components/map/VisitPlaceLabelWithPin';
import { Text } from '@/components/ui/text';
import type { VisitPlaceDisplay } from '@/lib/place-lookup-types';

type VisitPlaceLabelPagerProps = {
  display: VisitPlaceDisplay;
  /** Browsing only — does not persist until Done. */
  draftPoiId: number | null;
  onDraftPoiIdChange: (poiId: number) => void;
};

/** MapPin 13 + row gap 5 — lines "x of y" up with the label text. */
const COUNT_INDENT_WITH_PIN = 18;

export function VisitPlaceLabelPager({
  display,
  draftPoiId,
  onDraftPoiIdChange,
}: VisitPlaceLabelPagerProps) {
  const candidates = display.candidates;
  const pageIndex = useMemo(() => {
    if (draftPoiId == null) {
      return 0;
    }
    const index = candidates.findIndex(candidate => candidate.id === draftPoiId);
    return index >= 0 ? index : 0;
  }, [candidates, draftPoiId]);

  const selectIndex = useCallback(
    (nextIndex: number) => {
      const clamped = Math.max(0, Math.min(nextIndex, candidates.length - 1));
      const candidate = candidates[clamped];
      if (candidate) {
        onDraftPoiIdChange(candidate.id);
      }
    },
    [candidates, onDraftPoiIdChange],
  );

  const total = candidates.length;
  const showPin = draftPoiId != null;

  if (display.source !== 'lookup' || total <= 1) {
    if (!display.primaryLabel) {
      return null;
    }
    return (
      <View style={styles.wrap}>
        <View style={styles.cluster}>
          <View style={styles.labelBlock}>
            <VisitPlaceLabelWithPin
              name={display.primaryLabel}
              showPin={showPin}
            />
            {total === 1 ? (
              <Text
                variant="muted"
                style={[
                  styles.countText,
                  showPin ? styles.countTextIndented : null,
                ]}
              >
                1 of 1
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  const current = candidates[pageIndex] ?? candidates[0]!;
  const canGoPrev = pageIndex > 0;
  const canGoNext = pageIndex < total - 1;
  const pinVisible = showPin && current.id === draftPoiId;

  return (
    <View style={styles.wrap}>
      <View style={styles.cluster}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous place"
          disabled={!canGoPrev}
          hitSlop={6}
          onPress={() => selectIndex(pageIndex - 1)}
          style={[styles.chevron, !canGoPrev && styles.chevronDisabled]}
        >
          <ChevronLeft
            size={18}
            color={canGoPrev ? '#1C1C1E' : '#C7C7CC'}
            strokeWidth={2.25}
          />
        </Pressable>

        <View style={styles.labelBlock}>
          <VisitPlaceLabelWithPin name={current.name} showPin={pinVisible} />
          <Text
            variant="muted"
            style={[
              styles.countText,
              pinVisible ? styles.countTextIndented : null,
            ]}
          >
            {pageIndex + 1} of {total}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next place"
          disabled={!canGoNext}
          hitSlop={6}
          onPress={() => selectIndex(pageIndex + 1)}
          style={[styles.chevron, !canGoNext && styles.chevronDisabled]}
        >
          <ChevronRight
            size={18}
            color={canGoNext ? '#1C1C1E' : '#C7C7CC'}
            strokeWidth={2.25}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
    gap: 2,
  },
  chevron: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chevronDisabled: {
    opacity: 0.45,
  },
  labelBlock: {
    flexShrink: 1,
    minWidth: 0,
    gap: 1,
  },
  countText: {
    fontSize: 11,
    fontWeight: '500',
  },
  countTextIndented: {
    paddingLeft: COUNT_INDENT_WITH_PIN,
  },
});
