import type {SegmentMomentCounts} from '@lifemap/segmentation';

export type MobileMomentCountType = keyof SegmentMomentCounts;

export type MobileMomentTheme = {
  badgeBg: string;
  icon: string;
};

export const MOBILE_MOMENT_THEMES: Record<
  'camera' | 'voice' | 'note' | 'activity',
  MobileMomentTheme
> = {
  camera: {
    badgeBg: '#F2F8FF',
    icon: '#007AFF',
  },
  voice: {
    badgeBg: '#F7F2FF',
    icon: '#AF52DE',
  },
  note: {
    badgeBg: '#FFF8EE',
    icon: '#FF9500',
  },
  activity: {
    badgeBg: '#EAF7F1',
    icon: '#34C759',
  },
};

export const MOBILE_MOMENT_CHIP_ORDER: readonly {
  type: MobileMomentCountType;
  themeKey: keyof typeof MOBILE_MOMENT_THEMES;
  label: string;
}[] = [
  {type: 'photo', themeKey: 'camera', label: 'Photo moments'},
  {type: 'video', themeKey: 'camera', label: 'Video moments'},
  {type: 'voice', themeKey: 'voice', label: 'Voice moments'},
  {type: 'note', themeKey: 'note', label: 'Diary moments'},
  {type: 'activity', themeKey: 'activity', label: 'Activity moments'},
];

export function hasMobileMomentCounts(
  counts: SegmentMomentCounts | undefined,
): counts is SegmentMomentCounts {
  if (counts == null) {
    return false;
  }
  return (
    counts.photo > 0 ||
    counts.video > 0 ||
    counts.voice > 0 ||
    counts.note > 0 ||
    counts.activity > 0
  );
}
