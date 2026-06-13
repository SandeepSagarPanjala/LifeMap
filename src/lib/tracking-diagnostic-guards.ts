export type TrackingMotionGuardState = {
  lastLoggedIsMoving: boolean | null;
  departureWakeActive: boolean;
};

export function createTrackingMotionGuardState(): TrackingMotionGuardState {
  return {
    lastLoggedIsMoving: null,
    departureWakeActive: false,
  };
}

export function resetTrackingMotionGuardState(
  state: TrackingMotionGuardState,
): void {
  state.lastLoggedIsMoving = null;
  state.departureWakeActive = false;
}

/** Log motion_change only when the native moving/still state actually flips. */
export function shouldLogMotionChange(
  state: TrackingMotionGuardState,
  isMoving: boolean,
): boolean {
  if (state.lastLoggedIsMoving === isMoving) {
    return false;
  }

  state.lastLoggedIsMoving = isMoving;
  if (!isMoving) {
    state.departureWakeActive = false;
  }
  return true;
}

/**
 * Apply changePace(true) at most once per moving stint.
 * Resets when motion returns to still.
 */
export function shouldApplyDepartureWake(
  state: TrackingMotionGuardState,
): boolean {
  if (state.departureWakeActive) {
    return false;
  }

  state.departureWakeActive = true;
  return true;
}

export function resetDepartureWake(state: TrackingMotionGuardState): void {
  state.departureWakeActive = false;
}
