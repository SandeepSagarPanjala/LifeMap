/** Transistor Soft MotionActivityType string values. */
export type MotionActivityType =
  | 'still'
  | 'on_foot'
  | 'walking'
  | 'running'
  | 'on_bicycle'
  | 'in_vehicle'
  | 'unknown';

export function normalizeMotionActivity(
  value: string | null | undefined,
): MotionActivityType | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim().toLowerCase();
  switch (trimmed) {
    case 'still':
    case 'on_foot':
    case 'walking':
    case 'running':
    case 'on_bicycle':
    case 'in_vehicle':
    case 'unknown':
      return trimmed;
    default:
      return null;
  }
}

export function isFootMotionActivity(
  activity: MotionActivityType | null,
): boolean {
  return (
    activity === 'on_foot' ||
    activity === 'walking' ||
    activity === 'running'
  );
}

export function isWheeledMotionActivity(
  activity: MotionActivityType | null,
): boolean {
  return activity === 'in_vehicle' || activity === 'on_bicycle';
}
