import {View} from 'react-native';

import {MomentCountsRow} from '@/components/moments/MomentCountsRow';
import type {MomentCountType, MomentCounts} from '@/lib/moments/moment-counts';
import {hasMomentCounts} from '@/lib/moments/moment-counts';

type DayMomentSummaryBarProps = {
  counts: MomentCounts;
  /** Flush to screen bottom — no margin below the bar. */
  docked?: boolean;
  onPress?: () => void;
  onPressType?: (type: MomentCountType) => void;
};

export function DayMomentSummaryBar({
  counts,
  docked = false,
  onPress,
  onPressType,
}: DayMomentSummaryBarProps) {
  if (!hasMomentCounts(counts)) {
    return null;
  }

  return (
    <View
      className={`mx-4 items-center rounded-xl border border-[#E5E5EA] bg-white px-4 py-3 shadow-sm shadow-black/10${docked ? '' : ' mb-2'}`}>
      <MomentCountsRow counts={counts} onPress={onPress} onPressType={onPressType} />
    </View>
  );
}
