import type { MomentType } from '@/db/repositories/moments';

export type StorageBreakdownCategory =
  | 'database'
  | 'moment'
  | 'other'
  | 'total';

export type StorageBreakdownItem = {
  key: string;
  label: string;
  count: number | null;
  bytes: number;
  category: StorageBreakdownCategory;
};

const MOMENT_TYPE_LABELS: Record<MomentType, string> = {
  photo: 'Camera',
  voice: 'Voice',
  note: 'Note',
  video: 'Video',
  activity: 'Activity',
};

export const MOMENT_STORAGE_TYPE_ORDER: MomentType[] = [
  'photo',
  'voice',
  'note',
  'activity',
  'video',
];

export function momentTypeLabel(type: MomentType): string {
  return MOMENT_TYPE_LABELS[type] ?? 'Moment';
}

export function sumBreakdownBytes(
  items: Array<Pick<StorageBreakdownItem, 'bytes'>>,
): number {
  return items.reduce((sum, item) => sum + item.bytes, 0);
}
