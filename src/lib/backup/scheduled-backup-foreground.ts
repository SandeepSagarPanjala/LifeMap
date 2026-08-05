/**
 * BG→FG hook for scheduled backup UI.
 * AppBootstrap notifies; ScheduledBackupRunner subscribes (no AppState there).
 */

export type ScheduledBackupForegroundListener = () => void;

const listeners = new Set<ScheduledBackupForegroundListener>();

export function subscribeScheduledBackupForeground(
  listener: ScheduledBackupForegroundListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Call from AppBootstrap when returning from background/inactive → active. */
export function notifyScheduledBackupOnForeground(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** @internal — tests */
export function resetScheduledBackupForegroundForTests(): void {
  listeners.clear();
}
