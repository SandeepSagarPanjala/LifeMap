import {StyleSheet, View} from 'react-native';

import {SkeletonPulse} from '@/components/ui/skeleton-pulse';

/** Placeholder while history data / map layers prepare — panel opens instantly. */
export function HistoryPanelSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <SkeletonPulse style={styles.kindLine} />
        <SkeletonPulse style={styles.titleLine} />
        <SkeletonPulse style={styles.subtitleLine} />
        <SkeletonPulse style={styles.actionButton} />
      </View>

      <View style={styles.timeline}>
        <View style={styles.dayNav}>
          <SkeletonPulse style={styles.dayNavBtn} />
          <SkeletonPulse style={styles.dayTitle} />
          <SkeletonPulse style={styles.dayNavBtn} />
        </View>
        <SkeletonPulse style={styles.track} />
        <View style={styles.eventNavRow}>
          <SkeletonPulse style={styles.eventNavCircle} />
          <SkeletonPulse style={styles.trackWide} />
          <SkeletonPulse style={styles.eventNavCircle} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  card: {
    minHeight: 118,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  kindLine: {
    width: 48,
    height: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  titleLine: {
    width: '72%',
    height: 16,
    borderRadius: 6,
    marginBottom: 8,
  },
  subtitleLine: {
    width: '40%',
    height: 12,
    borderRadius: 6,
  },
  actionButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  timeline: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dayNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dayTitle: {
    width: 88,
    height: 14,
    borderRadius: 7,
  },
  track: {
    height: 36,
    borderRadius: 18,
    marginBottom: 0,
  },
  eventNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -36,
    height: 36,
  },
  eventNavCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  trackWide: {
    flex: 1,
    height: 36,
    borderRadius: 18,
  },
});
