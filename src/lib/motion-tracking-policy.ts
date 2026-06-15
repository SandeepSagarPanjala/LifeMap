/** If no row written for this long while tracking, heartbeat requests a fresh GPS fix. */
export const STATIONARY_PING_MIN_MS = 30 * 60_000;

/** Shorter backup ping when maximum reliability is on (still at one place). */
export const STATIONARY_PING_MIN_MS_MAX_RELIABILITY = 10 * 60_000;

/** Heartbeat interval (seconds) — Android minimum 60; used to check stationary ping. */
export const HEARTBEAT_CHECK_INTERVAL_SEC = 60;

/** Faster heartbeat when max reliability is on (iOS preventSuspend keeps JS warmer). */
export const HEARTBEAT_CHECK_INTERVAL_SEC_MAX_RELIABILITY = 30;

/** Drift from last save that forces moving mode even if motion API stayed still (m). */
export const HEARTBEAT_DEPARTURE_DISTANCE_METERS = 100;

/** After this long without a save, speed on heartbeat can force moving mode (ms). */
export const DEPARTURE_WATCHDOG_MIN_MS = 5 * 60_000;

/** Max-reliability drives need a much shorter stale window (CVS→Shay gap was minutes). */
export const DEPARTURE_WATCHDOG_MIN_MS_MAX_RELIABILITY = 90_000;

/** Minimum speed (m/s) on heartbeat to treat as drive departure (~10 mph). */
export const MIN_DEPARTURE_SPEED_MS = 4.5;

/** Any GPS fix at or above this speed keeps the SDK in moving mode (~7 km/h). */
export const DRIVE_GPS_WAKE_SPEED_MS = 2.0;

/** Ignore speed-based departure when accuracy is worse than this (m). */
export const MAX_DEPARTURE_ACCURACY_METERS = 75;

/** Stopping threshold for heartbeat getCurrentPosition (m) — see CurrentPositionRequest. */
export const HEARTBEAT_DESIRED_ACCURACY_METERS = 25;

/** Options for heartbeat / headless fresh GPS — centralized per Transistor docs. */
export const HEARTBEAT_CURRENT_POSITION_REQUEST = {
  timeout: 30,
  maximumAge: 0,
  desiredAccuracy: HEARTBEAT_DESIRED_ACCURACY_METERS,
  samples: 1,
  persist: false,
} as const;

/** Max plausible speed between consecutive saved points when drawing a line (m/s). ~200 km/h */
export const MAX_PLAUSIBLE_SPEED_MS = 55;

/** Min gap before breaking a map line at the same place (stationary pings). */
export const SAME_PLACE_LINE_BREAK_MS = 2 * 60_000;
