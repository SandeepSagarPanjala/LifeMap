import {
  createTrackingMotionGuardState,
  resetDepartureWake,
  resetTrackingMotionGuardState,
  shouldApplyDepartureWake,
  shouldLogMotionChange,
} from '@/lib/tracking-diagnostic-guards';

describe('tracking diagnostic guards', () => {
  it('logs motion_change only on isMoving transitions', () => {
    const state = createTrackingMotionGuardState();

    expect(shouldLogMotionChange(state, true)).toBe(true);
    expect(shouldLogMotionChange(state, true)).toBe(false);
    expect(shouldLogMotionChange(state, false)).toBe(true);
    expect(shouldLogMotionChange(state, false)).toBe(false);
    expect(shouldLogMotionChange(state, true)).toBe(true);
  });

  it('resets departure wake when motion returns to still', () => {
    const state = createTrackingMotionGuardState();

    expect(shouldApplyDepartureWake(state)).toBe(true);
    expect(shouldApplyDepartureWake(state)).toBe(false);

    shouldLogMotionChange(state, false);

    expect(shouldApplyDepartureWake(state)).toBe(true);
  });

  it('allows departure wake retry after an explicit reset', () => {
    const state = createTrackingMotionGuardState();

    expect(shouldApplyDepartureWake(state)).toBe(true);
    resetDepartureWake(state);
    expect(shouldApplyDepartureWake(state)).toBe(true);
  });

  it('clears all guard state on reset', () => {
    const state = createTrackingMotionGuardState();

    shouldLogMotionChange(state, true);
    shouldApplyDepartureWake(state);
    resetTrackingMotionGuardState(state);

    expect(shouldLogMotionChange(state, true)).toBe(true);
    expect(shouldApplyDepartureWake(state)).toBe(true);
  });
});
