/**
 * Map locate-button busy indicator while deferred heavy FG work runs.
 * Visible immediately when work starts; stays up until idle, then +1s hold.
 */

/** Extra time orb stays after heavy resume + bg cycle are both idle. */
export const HEAVY_MAP_WORK_ORB_HOLD_MS = 1_000;

let heavyResumeActive = false;
let backgroundCycleActive = false;
let visible = false;
let revision = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function bump(): void {
  revision += 1;
  for (const listener of listeners) {
    listener();
  }
}

function clearHideTimer(): void {
  if (hideTimer != null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function syncVisible(): void {
  const working = heavyResumeActive || backgroundCycleActive;
  if (working) {
    clearHideTimer();
    if (!visible) {
      visible = true;
      bump();
    }
    return;
  }

  // Idle — keep orb for hold window, then restore bullseye.
  if (!visible) {
    return;
  }
  clearHideTimer();
  hideTimer = setTimeout(() => {
    hideTimer = null;
    if (heavyResumeActive || backgroundCycleActive) {
      return;
    }
    if (visible) {
      visible = false;
      bump();
    }
  }, HEAVY_MAP_WORK_ORB_HOLD_MS);
}

export function setHeavyResumeOrbActive(active: boolean): void {
  if (heavyResumeActive === active) {
    return;
  }
  heavyResumeActive = active;
  syncVisible();
}

export function setBackgroundCycleOrbActive(active: boolean): void {
  if (backgroundCycleActive === active) {
    return;
  }
  backgroundCycleActive = active;
  syncVisible();
}

export function isHeavyMapWorkOrbVisible(): boolean {
  return visible;
}

export function getHeavyMapWorkOrbRevision(): number {
  return revision;
}

export function subscribeHeavyMapWorkOrb(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** @internal — tests */
export function resetHeavyMapWorkOrbForTests(): void {
  clearHideTimer();
  heavyResumeActive = false;
  backgroundCycleActive = false;
  visible = false;
  revision = 0;
}
