/** If no row written for this long while tracking, heartbeat requests a fresh GPS fix. */
export const STATIONARY_PING_MIN_MS = 30 * 60_000;

/** Heartbeat interval (seconds) — Android minimum 60; used to check stationary ping. */
export const HEARTBEAT_CHECK_INTERVAL_SEC = 60;

/** Drift from last save that forces moving mode even if motion API stayed still (m). */
export const HEARTBEAT_DEPARTURE_DISTANCE_METERS = 100;

/** After this long without a save, speed on heartbeat can force moving mode (ms). */
export const DEPARTURE_WATCHDOG_MIN_MS = 15 * 60_000;

/** Minimum speed (m/s) on heartbeat to treat as possible departure (~7 km/h). */
export const MIN_DEPARTURE_SPEED_MS = 2;

/** Ignore speed-based departure when accuracy is worse than this (m). */
export const MAX_DEPARTURE_ACCURACY_METERS = 75;

/** Max plausible speed between consecutive saved points when drawing a line (m/s). ~200 km/h */
export const MAX_PLAUSIBLE_SPEED_MS = 55;

/** Min gap before breaking a map line at the same place (stationary pings). */
export const SAME_PLACE_LINE_BREAK_MS = 2 * 60_000;
