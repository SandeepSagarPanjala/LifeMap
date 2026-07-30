import type { MomentType } from '@/db/repositories/moments';

export type GalleryTypeFilter = 'all' | MomentType;

export const GALLERY_TYPE_FILTER_OPTIONS: {
  value: GalleryTypeFilter;
  label: string;
}[] = [
  { value: 'all', label: 'All' },
  { value: 'photo', label: 'Photos' },
  { value: 'video', label: 'Videos' },
  { value: 'note', label: 'Diary' },
  { value: 'voice', label: 'Voice' },
  { value: 'mood', label: 'Mood' },
  { value: 'activity', label: 'Activity' },
];

export function galleryTypeFilterLabel(filter: GalleryTypeFilter): string {
  return (
    GALLERY_TYPE_FILTER_OPTIONS.find(option => option.value === filter)
      ?.label ?? 'All'
  );
}
