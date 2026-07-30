/** Map HKWorkoutActivityType enum values → emoji + label for LifeMap activities. */
const WORKOUT_META: Record<number, { emoji: string; label: string }> = {
  13: { emoji: '🚴', label: 'Cycling' },
  16: { emoji: '🏃', label: 'Elliptical' },
  37: { emoji: '🏃', label: 'Running' },
  46: { emoji: '🏊', label: 'Swimming' },
  50: { emoji: '🏋️', label: 'Strength Training' },
  52: { emoji: '🚶', label: 'Walking' },
  57: { emoji: '🧘', label: 'Yoga' },
  63: { emoji: '🔥', label: 'HIIT' },
  11: { emoji: '💪', label: 'Cross Training' },
  59: { emoji: '💪', label: 'Core Training' },
  66: { emoji: '🧘', label: 'Pilates' },
  35: { emoji: '🚣', label: 'Rowing' },
  44: { emoji: '🪜', label: 'Stair Climbing' },
  48: { emoji: '🎾', label: 'Tennis' },
  6: { emoji: '🏀', label: 'Basketball' },
  41: { emoji: '⚽', label: 'Soccer' },
  24: { emoji: '🥾', label: 'Hiking' },
  3: { emoji: '🏉', label: 'Australian Football' },
  8: { emoji: '🥊', label: 'Boxing' },
  9: { emoji: '🧗', label: 'Climbing' },
  14: { emoji: '💃', label: 'Dance' },
  64: { emoji: '🪢', label: 'Jump Rope' },
  65: { emoji: '🥊', label: 'Kickboxing' },
  20: { emoji: '🥋', label: 'Martial Arts' },
  29: { emoji: '🧘', label: 'Mind & Body' },
  32: { emoji: '🎮', label: 'Play' },
  33: { emoji: '🧊', label: 'Recovery' },
  45: { emoji: '🏄', label: 'Surfing' },
  60: { emoji: '⛷️', label: 'Cross Country Skiing' },
  61: { emoji: '⛷️', label: 'Downhill Skiing' },
  67: { emoji: '🏂', label: 'Snowboarding' },
  73: { emoji: '🧘', label: 'Cooldown' },
  74: { emoji: '🔥', label: 'Workout' },
};

export function workoutMetaForType(activityType: number): {
  emoji: string;
  label: string;
} {
  return (
    WORKOUT_META[activityType] ?? { emoji: '🏃', label: 'Workout' }
  );
}
